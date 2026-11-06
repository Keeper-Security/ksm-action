import {afterEach, beforeEach, describe, expect, test} from '@jest/globals'
import {spawnSync} from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// The child process loads the network guard first and then the shipped bundle.
const CHILD_SCRIPT = path.join(__dirname, 'fixtures', 'dist-smoke-child.cjs')
const BUNDLE = path.join(__dirname, '..', 'dist', 'index.js')
const RESULT_PREFIX = 'DIST_SMOKE_RESULT '
const RECORD_UID = 'AAAAAAAAAAAAAAAAAAAAAA'
const FILE_UID = 'BBBBBBBBBBBBBBBBBBBBBB'
const ATTACHMENT = [0, 255, 1, 128, 10, 13, 42]
const SYNTHETIC_VALUES = ['synthetic-login', 'synthetic-password', 'synthetic-updated-login']
const STEP_FILE_VARIABLES = ['GITHUB_ENV', 'GITHUB_OUTPUT', 'GITHUB_PATH', 'GITHUB_STATE', 'GITHUB_STEP_SUMMARY']

type ScenarioResult = {
    calls: Record<string, unknown>[]
    outputs: Record<string, string>
    environment: Record<string, string>
    masked: string[]
    failed: string[]
    errors: string[]
    warnings: string[]
}

type SmokeResult = {
    exports: string[]
    scenarios: Record<string, ScenarioResult>
    blocked: string[]
}

const getSecretsCall = {method: 'getSecrets', filter: [RECORD_UID], optionKeys: ['storage', 'throttleSleep'], hostname: 'invalid.example'}

describe('Shipped bundle smoke test', () => {
    let workspace: string

    beforeEach(() => {
        workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ksm-dist-smoke-')))
    })

    afterEach(() => {
        fs.rmSync(workspace, {recursive: true, force: true})
    })

    test('dist/index.js retrieves and stores values with mock operations', () => {
        const env: NodeJS.ProcessEnv = {...process.env, GITHUB_WORKSPACE: workspace}
        for (const name of STEP_FILE_VARIABLES) {
            delete env[name]
        }
        const child = spawnSync(process.execPath, [CHILD_SCRIPT, BUNDLE], {cwd: workspace, env, encoding: 'utf8', timeout: 10000, windowsHide: true})
        const stdoutLines = (child.stdout ?? '').split(/\r?\n/)
        const resultLine = stdoutLines.find(line => line.startsWith(RESULT_PREFIX))
        if (child.status !== 0 || resultLine === undefined) {
            throw new Error(`Bundle smoke run failed (status ${child.status}, signal ${child.signal}, ${child.error?.message ?? 'no spawn error'}):\n${child.stderr}`)
        }
        const result = JSON.parse(resultLine.slice(RESULT_PREFIX.length)) as SmokeResult

        expect(result.exports).toEqual([
            'KsmAction',
            'KsmActionError',
            'KsmErrorType',
            'KsmOperations',
            'buildThrottleSleep',
            'createRunner',
            'default',
            'getRecordUids',
            'parseSecretsInputs',
            'serializeValue'
        ])
        expect(result.blocked).toEqual([])
        for (const [name, scenario] of Object.entries(result.scenarios)) {
            expect({name, failed: scenario.failed, errors: scenario.errors}).toEqual({name, failed: [], errors: []})
        }

        const {output, environment, relativeFile, attachment, store} = result.scenarios
        expect(output.outputs).toEqual({PASSWORD: 'synthetic-password'})
        expect(output.masked).toContain('synthetic-password')
        expect(output.calls).toEqual([getSecretsCall])

        expect(environment.environment).toEqual({SMOKE_LOGIN: 'synthetic-login'})
        expect(environment.masked).toContain('synthetic-login')
        expect(environment.calls).toEqual([getSecretsCall])

        expect(fs.readFileSync(path.join(workspace, 'password.txt'), 'utf8')).toBe('synthetic-password')
        expect(relativeFile.calls).toEqual([getSecretsCall])

        expect(Array.from(fs.readFileSync(path.join(workspace, 'attachment.bin')))).toEqual(ATTACHMENT)
        expect(attachment.calls).toEqual([getSecretsCall, {method: 'downloadFile', argumentCount: 1, fileUid: FILE_UID}])

        if (process.platform !== 'win32') {
            // The child sets umask 022, so new files get mode 644.
            for (const file of ['password.txt', 'attachment.bin']) {
                expect(fs.statSync(path.join(workspace, file)).mode & 0o777).toBe(0o644)
            }
        }

        expect(store.masked).toContain('synthetic-updated-login')
        expect(store.calls).toHaveLength(2)
        expect(store.calls[0]).toEqual(getSecretsCall)
        expect(store.calls[1]).toMatchObject({method: 'updateSecret', optionKeys: ['storage', 'throttleSleep']})
        expect(store.calls[1].record).toMatchObject({
            recordUid: RECORD_UID,
            data: {
                fields: [
                    {type: 'login', value: ['synthetic-updated-login']},
                    {type: 'password', value: ['synthetic-password']}
                ]
            }
        })

        // Only the result line may contain the synthetic values. Log lines must not.
        for (const line of stdoutLines.filter(line => !line.startsWith(RESULT_PREFIX))) {
            for (const value of SYNTHETIC_VALUES) {
                expect(line).not.toContain(value)
            }
        }
    })
})
