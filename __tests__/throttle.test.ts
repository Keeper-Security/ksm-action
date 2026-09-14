import {describe, test, expect, jest, beforeEach, afterEach} from '@jest/globals'
import {KsmAction, IKsmOperations, KsmErrorType, buildThrottleSleep} from '../src/main'
import {KeeperSecrets} from '@keeper-security/secrets-manager-core'

class ThrottleSimulatingKsmOperations implements IKsmOperations {
    throttleDelayMs: number | null = null

    async getSecrets(options: any): Promise<KeeperSecrets> {
        if (this.throttleDelayMs !== null && options.throttleSleep) {
            await options.throttleSleep(this.throttleDelayMs)
        }
        return {records: [], warnings: []} as unknown as KeeperSecrets
    }

    async updateSecret(): Promise<void> {}
    async createSecret(): Promise<string> {
        return 'NEW_UID'
    }
    async uploadFile(): Promise<string> {
        return 'FILE_UID'
    }
    async downloadFile(): Promise<Buffer> {
        return Buffer.from('')
    }
    getValue(): string {
        return ''
    }
}

function createTestLogger(overrides: Record<string, unknown> = {}): any {
    return {
        info: jest.fn(),
        error: jest.fn(),
        warning: jest.fn(),
        debug: jest.fn(),
        setSecret: jest.fn(),
        setOutput: jest.fn(),
        exportVariable: jest.fn(),
        setFailed: jest.fn(),
        getBooleanInput: jest.fn(() => false),
        getInput: jest.fn(() => ''),
        getMultilineInput: jest.fn(() => []),
        ...overrides
    }
}

describe('buildThrottleSleep (unit)', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    test('resolves after the requested delay when under the configured cap', async () => {
        const sleep = buildThrottleSleep(60_000)
        const promise = sleep(5_000)
        jest.advanceTimersByTime(5_000)
        await expect(promise).resolves.toBeUndefined()
    })

    test('rejects immediately with THROTTLE_EXCEEDED when the requested delay exceeds the cap', async () => {
        const sleep = buildThrottleSleep(10_000)
        await expect(sleep(15_000)).rejects.toMatchObject({
            name: 'KsmActionError',
            type: KsmErrorType.THROTTLE_EXCEEDED
        })
    })
})

describe('max-throttle-wait-seconds wiring in run()', () => {
    let mockOps: ThrottleSimulatingKsmOperations

    beforeEach(() => {
        mockOps = new ThrottleSimulatingKsmOperations()
    })

    test('invalid input value fails fast with INVALID_CONFIG, before contacting KSM', async () => {
        const mockLogger = createTestLogger({
            getInput: jest.fn((name: string) => {
                if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
                if (name === 'max-throttle-wait-seconds') return 'not-a-number'
                return ''
            }),
            getMultilineInput: jest.fn(() => ['TestUID/field/login > username'])
        })

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setFailed).toHaveBeenCalledWith(expect.stringContaining('max-throttle-wait-seconds'))
    })

    test('unconfigured run (default 60s cap from action.yml) is unaffected when no throttling occurs', async () => {
        const mockLogger = createTestLogger({
            getInput: jest.fn((name: string) => {
                if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
                if (name === 'max-throttle-wait-seconds') return '60' // value @actions/core supplies from action.yml's default when the user sets nothing
                return ''
            }),
            getMultilineInput: jest.fn(() => ['TestUID/field/login > username'])
        })

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setFailed).not.toHaveBeenCalled()
    })

    test('an unconfigured user is still protected: a breach of the default 60s cap fails cleanly, not a hang', async () => {
        const mockLogger = createTestLogger({
            getInput: jest.fn((name: string) => {
                if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
                if (name === 'max-throttle-wait-seconds') return '60' // default, user never touched this input
                return ''
            }),
            getMultilineInput: jest.fn(() => ['TestUID/field/login > username'])
        })
        mockOps.throttleDelayMs = 90_000 // backend asks to wait 90s, exceeding the 60s default cap

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setFailed).toHaveBeenCalledTimes(1)
        expect(mockLogger.setFailed).toHaveBeenCalledWith(expect.stringContaining('60'))
        expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('at '))
    })
})
