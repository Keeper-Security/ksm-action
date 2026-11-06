import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals'
import * as core from '@actions/core'
import {EventEmitter} from 'events'
import {KsmAction, KsmOperations} from '../src/main'

// This file drives the real SDK. Only the HTTPS call is replaced, so the deadline the SDK arms is the one a workflow would get.
const crypto = jest.requireActual<typeof import('crypto')>('crypto')
const https = jest.requireActual<typeof import('https')>('https')

const RECORD_UID = 'AAAAAAAAAAAAAAAAAAAAAA'

function createConfig(): string {
    const {privateKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'})
    return Buffer.from(
        JSON.stringify({
            hostname: 'invalid.example',
            clientId: crypto.randomBytes(64).toString('base64'),
            appKey: crypto.randomBytes(32).toString('base64'),
            privateKey: privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64')
        })
    ).toString('base64')
}

describe('Keeper API request deadline', () => {
    beforeEach(() => {
        jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask']})
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    test('a Keeper API call is still pending after 60 seconds and is aborted after 300 seconds', async () => {
        const config = createConfig()
        let signal: AbortSignal | undefined
        jest.spyOn(https, 'request').mockImplementation(((_url: unknown, options: {signal?: AbortSignal}) => {
            signal = options.signal
            const request = new EventEmitter() as EventEmitter & Record<string, unknown>
            request.write = () => undefined
            request.end = () => undefined
            request.setTimeout = () => undefined
            request.destroy = () => undefined
            signal?.addEventListener('abort', () => request.emit('error', new Error('aborted')))
            return request
        }) as unknown as typeof https.request)
        const logger = {
            debug: jest.fn(),
            info: jest.fn(),
            warning: jest.fn(),
            error: jest.fn(),
            setSecret: jest.fn(),
            setOutput: jest.fn(),
            exportVariable: jest.fn(),
            setFailed: jest.fn(),
            getInput: jest.fn((name: string) => (name === 'keeper-secret-config' ? config : '')),
            getMultilineInput: jest.fn(() => [`${RECORD_UID}/field/login > LOGIN`]),
            getBooleanInput: jest.fn(() => false)
        }

        const finished = new KsmAction(new KsmOperations(), logger as unknown as typeof core).run()
        for (let attempt = 0; attempt < 100 && signal === undefined; attempt++) {
            await new Promise(resolve => setImmediate(resolve))
        }
        expect(signal).toBeDefined()

        await jest.advanceTimersByTimeAsync(60_000)
        expect(signal!.aborted).toBe(false)

        await jest.advanceTimersByTimeAsync(240_000)
        expect(signal!.aborted).toBe(true)

        await finished
        expect(logger.setFailed).toHaveBeenCalled()
    })
})
