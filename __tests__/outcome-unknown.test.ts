import {describe, test, expect, jest, beforeEach, afterEach} from '@jest/globals'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {KsmAction, KsmActionError, KsmErrorType, IKsmOperations, unknownOutcomeCause} from '../src/main'

const RECORD_UID = 'BediNKCMG21ztm5xGYgNww'
const OTHER_UID = 'AbcdefghijklmnopqrstuV'
const FOLDER_UID = 'FOLDERabcdefghijklmnop'
const CONFIG = 'eyJ0ZXN0IjogdHJ1ZX0='

const API = 'https://qa.keepersecurity.com/api/rest/sm/v1'
const TIMEOUT_UPDATE = `Request to ${API}/update_secret timed out after 30000ms`
const TIMEOUT_CREATE = `Request to ${API}/create_secret timed out after 30000ms`
const TIMEOUT_ADD_FILE = `Request to ${API}/add_file timed out after 30000ms`
const TIMEOUT_STORAGE = 'Request to https://files.services.qa.keepersecurity.com/ timed out after 300000ms'
const TIMEOUT_READ = `Request to ${API}/get_secret timed out after 30000ms`
const GATEWAY_504 = '<html>\r\n<head><title>504 Gateway Time-out</title></head>\r\n<body><center><h1>504 Gateway Time-out</h1></center></body>\r\n</html>'
const SERVER_UNKNOWN = '{"error":"unknown","message":"unknown error","correlation_id":"0b1c2d3e"}'
const TLS_NOT_OPEN = 'Client network socket disconnected before secure TLS connection was established'

const NEXT_STEP = 'before you run this job again.'

// The words that the action uses to classify an error from its message. A new message must not contain any of them.
const CLASSIFIER_WORDS = ['permission', 'access denied', 'access_denied', 'unauthorized', 'forbidden', 'not editable', 'out of sync', 'not found', 'does not exist']

class FakeKsmOperations implements IKsmOperations {
    calls: string[] = []
    records = new Map<string, any>()
    updateFailures = new Map<string, Error[]>()
    uploadFailures: (Error | null)[] = []
    createFailure: Error | null = null
    getSecretsFailure: Error | null = null

    async getSecrets(options: any, filter?: string[]): Promise<any> {
        this.calls.push('getSecrets')
        if (this.getSecretsFailure) throw this.getSecretsFailure
        const records = (filter || []).map(uid => this.records.get(uid)).filter(Boolean)
        return {records, warnings: []}
    }

    async updateSecret(options: any, record: any): Promise<void> {
        this.calls.push('updateSecret')
        const queue = this.updateFailures.get(record.recordUid)
        const failure = queue?.shift()
        if (failure) throw failure
        this.records.set(record.recordUid, JSON.parse(JSON.stringify(record)))
    }

    async createSecret(options: any, folderUid: string, recordData: any): Promise<string> {
        this.calls.push('createSecret')
        if (this.createFailure) throw this.createFailure
        return 'NEW_RECORD_UID_0000000'
    }

    async uploadFile(options: any, record: any, file: any): Promise<string> {
        this.calls.push('uploadFile')
        const failure = this.uploadFailures.shift()
        if (failure) throw failure
        return 'FILE_UID'
    }

    async downloadFile(file: any): Promise<Uint8Array> {
        return new Uint8Array([1])
    }

    getValue(secrets: any, notation: string): any {
        return ''
    }
}

const loginRecord = (uid: string): any => ({
    recordUid: uid,
    data: {
        title: 'Login',
        type: 'login',
        fields: [
            {type: 'login', value: ['user']},
            {type: 'password', value: ['old']}
        ],
        custom: []
    }
})

const createLogger = (): any => ({
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn(),
    setSecret: jest.fn(),
    setOutput: jest.fn(),
    exportVariable: jest.fn(),
    setFailed: jest.fn(),
    getBooleanInput: jest.fn((name: string) => name === 'fail-on-store-error'),
    getInput: jest.fn((name: string) => (name === 'keeper-secret-config' ? CONFIG : '')),
    getMultilineInput: jest.fn(() => [])
})

const errorLines = (logger: any): string[] => logger.error.mock.calls.map((call: any[]) => String(call[0]))

const resetError = (code: string, message = `read ${code}`): Error => Object.assign(new Error(message), {code})

const storeInput = (uid: string, notation: string): any => ({uid, selector: 'field', notation, destination: 'new-password', operationType: 1, destinationType: 3})

describe('Outcome unknown after a write that lost its reply', () => {
    let ops: FakeKsmOperations
    let logger: any

    const enableCreate = (): void => {
        logger.getBooleanInput = jest.fn((name: string) => name === 'create-if-missing' || name === 'fail-on-store-error')
        logger.getInput = jest.fn((name: string) => ({'keeper-secret-config': CONFIG, 'folder-uid': FOLDER_UID})[name] || '')
    }

    beforeEach(() => {
        ops = new FakeKsmOperations()
        logger = createLogger()
    })

    test('update timeout: one attempt, unknown outcome, no revert claim', async () => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.updateFailures.set(RECORD_UID, [new Error(TIMEOUT_UPDATE)])
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < new-password`])

        await new KsmAction(ops, logger).run()

        expect(ops.calls.filter(call => call === 'updateSecret')).toHaveLength(1)
        const lines = errorLines(logger)
        expect(lines).toContain(`❌ Failed to update ${RECORD_UID}/field/password: ${TIMEOUT_UPDATE}`)
        expect(lines).toContain('❌ 1 store operation(s) failed (1 with unknown outcome)')
        expect(lines).toContain(
            `Operation 1: Outcome unknown for update of record ${RECORD_UID}. The request timed out after 30000ms. Keeper may have applied the change. ` +
                `The action does not retry after this error. Wait a short time, then read the record in the vault ${NEXT_STEP}`
        )
        expect(lines.join('\n')).not.toContain('changes reverted')
        expect(lines.join('\n')).not.toContain('restored its local copy')
        expect(lines.join('\n')).not.toContain('Unexpected error storing')
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed (1 with unknown outcome)')
    })

    test('create timeout: names the title and the folder, and warns about a second record', async () => {
        enableCreate()
        logger.getMultilineInput = jest.fn(() => ['my-token/field/password < new-password'])
        ops.createFailure = new Error(TIMEOUT_CREATE)

        await new KsmAction(ops, logger).run()

        expect(ops.calls.filter(call => call === 'createSecret')).toHaveLength(1)
        const lines = errorLines(logger)
        expect(lines).toContain(`❌ Failed to create my-token/field/password: ${TIMEOUT_CREATE}`)
        expect(lines).toContain(
            `Operation 1: Outcome unknown for create of record "my-token" in folder ${FOLDER_UID}. The request timed out after 30000ms. Keeper may have created the record. ` +
                `A second run can create a second record. Wait a short time, then search the folder for the title ${NEXT_STEP}`
        )
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed (1 with unknown outcome)')
    })

    describe('file upload', () => {
        let workspace: string
        let previousWorkspace: string | undefined

        beforeEach(() => {
            workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ksm-outcome-unknown-'))
            previousWorkspace = process.env.GITHUB_WORKSPACE
            process.env.GITHUB_WORKSPACE = workspace
            fs.writeFileSync(path.join(workspace, 'first.txt'), 'first content')
            fs.writeFileSync(path.join(workspace, 'second.txt'), 'second content')
        })

        afterEach(() => {
            if (previousWorkspace === undefined) {
                delete process.env.GITHUB_WORKSPACE
            } else {
                process.env.GITHUB_WORKSPACE = previousWorkspace
            }
            fs.rmSync(workspace, {recursive: true, force: true})
        })

        test.each([
            ['add_file', TIMEOUT_ADD_FILE, 'The request timed out after 30000ms.'],
            ['storage', TIMEOUT_STORAGE, 'The request timed out after 300000ms.']
        ])('%s timeout: unknown outcome, and the action stops for the record', async (_leg, message, cause) => {
            ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
            ops.uploadFailures = [new Error(message)]
            logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/file/first.txt < file:${path.join(workspace, 'first.txt')}`, `${RECORD_UID}/field/password < new-password`])

            await new KsmAction(ops, logger).run()

            expect(ops.calls.filter(call => call === 'uploadFile')).toHaveLength(1)
            expect(ops.calls).not.toContain('updateSecret')
            expect(errorLines(logger)).toContain(
                `Operation 1: Outcome unknown for file upload to record ${RECORD_UID}. ${cause} Keeper may have added a file entry. The entry may have no content. ` +
                    `The action stops after a failed upload. It does not apply later changes for this record. Wait a short time, then check the record in the vault ${NEXT_STEP}`
            )
        })

        test('a second file that times out does not hide the first file that uploaded', async () => {
            ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
            ops.uploadFailures = [null, new Error(TIMEOUT_ADD_FILE)]
            logger.getMultilineInput = jest.fn(() => [
                `${RECORD_UID}/file/first.txt < file:${path.join(workspace, 'first.txt')}`,
                `${RECORD_UID}/file/second.txt < file:${path.join(workspace, 'second.txt')}`
            ])

            await new KsmAction(ops, logger).run()

            expect(ops.calls.filter(call => call === 'uploadFile')).toHaveLength(2)
            expect(ops.calls).not.toContain('updateSecret')
            const message = errorLines(logger).find(line => line.startsWith('Operation 1: Outcome unknown for file upload')) as string
            expect(message).toContain('The action stops after a failed upload. It does not apply later changes for this record.')
            expect(message).not.toContain('other changes')
            expect(message).not.toContain('did not apply')
        })
    })

    test.each([
        ['ECONNRESET', resetError('ECONNRESET'), 'The connection closed before the action received a reply.'],
        ['EPIPE', resetError('EPIPE', 'write EPIPE'), 'The connection closed before the action received a reply.'],
        ['a 504 page', new Error(GATEWAY_504), 'Keeper replied with HTTP 504.'],
        ['a reply with no body and status 502', new Error('unknown ksm error, code 502'), 'Keeper replied with HTTP 502.'],
        ['a server error body', new Error(SERVER_UNKNOWN), 'Keeper replied with an unknown server error.']
    ])('%s on an update is an unknown outcome', async (_name, failure, cause) => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.updateFailures.set(RECORD_UID, [failure])
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < new-password`])

        await new KsmAction(ops, logger).run()

        const lines = errorLines(logger)
        expect(lines.some(line => line.startsWith(`Operation 1: Outcome unknown for update of record ${RECORD_UID}. ${cause} `))).toBe(true)
        expect(lines.join('\n')).not.toContain('changes reverted')
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed (1 with unknown outcome)')
    })

    test('a timeout of the read that comes before the create is not an unknown outcome', async () => {
        enableCreate()
        logger.getMultilineInput = jest.fn(() => ['my-token/field/password < new-password'])
        ops.createFailure = new Error(TIMEOUT_READ)

        await new KsmAction(ops, logger).run()

        expect(errorLines(logger).join('\n')).not.toContain('Outcome unknown')
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed')
    })

    test.each([
        ['a get_secret timeout', new Error(TIMEOUT_READ)],
        ['ECONNRESET', resetError('ECONNRESET')],
        ['a 504 page', new Error(GATEWAY_504)],
        ['a server error body', new Error(SERVER_UNKNOWN)]
    ])('%s while the action reads the record is not an unknown outcome', async (_name, failure) => {
        ops.getSecretsFailure = failure
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < new-password`])

        await new KsmAction(ops, logger).run()

        expect(ops.calls).not.toContain('updateSecret')
        expect(errorLines(logger).join('\n')).not.toContain('Outcome unknown')
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed')
    })

    test('a definitive rejection keeps its message and logs no revert claim', async () => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.updateFailures.set(RECORD_UID, [new Error('Record is not editable')])
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < new-password`])

        await new KsmAction(ops, logger).run()

        const lines = errorLines(logger)
        expect(lines.some(line => line.startsWith('Operation 1: Permission denied - '))).toBe(true)
        expect(lines).toContain('❌ 1 store operation(s) failed')
        expect(lines.join('\n')).not.toContain('Outcome unknown')
        expect(lines.join('\n')).not.toContain('changes reverted')
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed')
    })

    test('a body with a definitive class keeps that class even when it also looks like a lost reply', async () => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.updateFailures.set(RECORD_UID, [new Error('{"error":"unknown","message":"Record is not editable"}')])
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < new-password`])

        await new KsmAction(ops, logger).run()

        expect(errorLines(logger).some(line => line.startsWith('Operation 1: Permission denied - '))).toBe(true)
        expect(errorLines(logger).join('\n')).not.toContain('Outcome unknown')
    })

    test('a record that was updated stays updated when another record times out', async () => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.records.set(OTHER_UID, loginRecord(OTHER_UID))
        ops.updateFailures.set(RECORD_UID, [new Error(TIMEOUT_UPDATE)])
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < one`, `${OTHER_UID}/field/password < two`])

        await new KsmAction(ops, logger).run()

        expect(ops.records.get(OTHER_UID).data.fields.find((f: any) => f.type === 'password').value[0]).toBe('two')
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed (1 with unknown outcome)')
    })

    test('a timeout after an out of sync retry is an unknown outcome and the action stops', async () => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.updateFailures.set(RECORD_UID, [new Error(`Record ${RECORD_UID} is out of sync`), new Error(TIMEOUT_UPDATE)])
        logger.getMultilineInput = jest.fn(() => [`${RECORD_UID}/field/password < new-password`])

        await new KsmAction(ops, logger).run()

        expect(ops.calls.filter(call => call === 'updateSecret')).toHaveLength(2)
        expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed (1 with unknown outcome)')
    })

    test('the thrown error has the unknown outcome type and keeps the SDK text', async () => {
        ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
        ops.updateFailures.set(RECORD_UID, [new Error(TIMEOUT_UPDATE)])

        const error: any = await new KsmAction(ops, logger).storeFieldValue({} as any, storeInput(RECORD_UID, `${RECORD_UID}/field/password`)).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(KsmActionError)
        expect(error.type).toBe(KsmErrorType.OUTCOME_UNKNOWN)
        expect(error.details).toEqual({originalError: TIMEOUT_UPDATE})
    })

    test('the messages hold none of the words that classify an error', async () => {
        enableCreate()
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ksm-outcome-words-'))
        const previousWorkspace = process.env.GITHUB_WORKSPACE
        process.env.GITHUB_WORKSPACE = workspace
        try {
            fs.writeFileSync(path.join(workspace, 'upload.txt'), 'file content')
            ops.records.set(RECORD_UID, loginRecord(RECORD_UID))
            ops.records.set(OTHER_UID, loginRecord(OTHER_UID))
            ops.updateFailures.set(RECORD_UID, [new Error(TIMEOUT_UPDATE)])
            ops.uploadFailures = [new Error(TIMEOUT_ADD_FILE)]
            ops.createFailure = new Error(TIMEOUT_CREATE)
            logger.getMultilineInput = jest.fn(() => [
                `${RECORD_UID}/field/password < new-password`,
                `${OTHER_UID}/file/upload.txt < file:${path.join(workspace, 'upload.txt')}`,
                'my-token/field/password < new-password'
            ])

            await new KsmAction(ops, logger).run()
        } finally {
            if (previousWorkspace === undefined) {
                delete process.env.GITHUB_WORKSPACE
            } else {
                process.env.GITHUB_WORKSPACE = previousWorkspace
            }
            fs.rmSync(workspace, {recursive: true, force: true})
        }

        const outcomeLines = errorLines(logger).filter(line => line.includes('Outcome unknown'))
        expect(outcomeLines).toHaveLength(3)
        for (const line of outcomeLines) {
            for (const word of CLASSIFIER_WORDS) {
                expect(line.toLowerCase()).not.toContain(word)
            }
        }
    })

    describe('a title in the create message', () => {
        const createMessage = async (title: string): Promise<string> => {
            enableCreate()
            ops.createFailure = new Error(TIMEOUT_CREATE)
            const error: any = await new KsmAction(ops, logger).storeFieldValue({} as any, storeInput(title, `${title}/field/password`)).catch((e: unknown) => e)
            expect(error.type).toBe(KsmErrorType.OUTCOME_UNKNOWN)
            return error.message
        }

        test('stays on one line and is cut at 80 characters', async () => {
            const message = await createMessage(`line one\nline two ${'x'.repeat(120)}`)

            expect(message).not.toMatch(/[\r\n]/)
            expect(message).toContain(`create of record "line one line two ${'x'.repeat(80 - 'line one line two '.length)}" in folder`)
        })

        test('is cut at 80 code points and never inside a surrogate pair', async () => {
            const message = await createMessage('😀'.repeat(100))

            expect(message).toContain(`create of record "${'😀'.repeat(80)}" in folder`)
        })

        test('shows control characters, C1 controls, and bidirectional overrides as spaces', async () => {
            const message = await createMessage('a\u001fb\u007fc\u0085d\u202ee\td')

            expect(message).toContain('create of record "a b c d e d" in folder')
        })

        test('shows a double quote as a single quote', async () => {
            const message = await createMessage('a"b')

            expect(message).toContain(`create of record "a'b" in folder`)
        })
    })

    test('a record UID or folder UID that has the wrong shape is not printed', async () => {
        enableCreate()
        logger.getInput = jest.fn((name: string) => ({'keeper-secret-config': CONFIG, 'folder-uid': 'not a uid\nline two'})[name] || '')
        ops.createFailure = new Error(TIMEOUT_CREATE)

        const created: any = await new KsmAction(ops, logger).storeFieldValue({} as any, storeInput('my-token', 'my-token/field/password')).catch((e: unknown) => e)

        expect(created.message).toMatch(/^Outcome unknown for create of record "my-token"\. /)
        expect(created.message).not.toContain('in folder')

        const badUid = 'bad uid\nline two'
        ops.records.set(badUid, loginRecord(badUid))
        ops.updateFailures.set(badUid, [new Error(TIMEOUT_UPDATE)])

        const updated: any = await new KsmAction(ops, logger).storeFieldValue({} as any, storeInput(badUid, `${badUid}/field/password`)).catch((e: unknown) => e)

        expect(updated.message).toMatch(/^Outcome unknown for update of the record\. /)
    })
})

describe('unknownOutcomeCause', () => {
    test.each([
        ['an update timeout', new Error(TIMEOUT_UPDATE), 'The request timed out after 30000ms.'],
        ['a create timeout', new Error(TIMEOUT_CREATE), 'The request timed out after 30000ms.'],
        ['an add_file timeout', new Error(TIMEOUT_ADD_FILE), 'The request timed out after 30000ms.'],
        ['a storage upload timeout', new Error(TIMEOUT_STORAGE), 'The request timed out after 300000ms.'],
        ['ECONNRESET', resetError('ECONNRESET'), 'The connection closed before the action received a reply.'],
        ['EPIPE', resetError('EPIPE'), 'The connection closed before the action received a reply.'],
        ['a 504 page', new Error(GATEWAY_504), 'Keeper replied with HTTP 504.'],
        ['a 502 page', new Error('<html><head><title>502 Bad Gateway</title></head></html>'), 'Keeper replied with HTTP 502.'],
        ['an upper case 504 page', new Error('<HTML><HEAD><TITLE>504 Gateway Time-out</TITLE></HEAD></HTML>'), 'Keeper replied with HTTP 504.'],
        ['a 502 page with a line break after the title tag', new Error('<title>\n502 Bad Gateway</title>'), 'Keeper replied with HTTP 502.'],
        ['a reply with no body and status 504', new Error('unknown ksm error, code 504'), 'Keeper replied with HTTP 504.'],
        ['a server error body', new Error(SERVER_UNKNOWN), 'Keeper replied with an unknown server error.']
    ])('%s is an unknown outcome', (_name, error, cause) => {
        expect(unknownOutcomeCause(error)).toBe(cause)
    })

    test.each([
        ['a get_secret timeout', new Error(TIMEOUT_READ)],
        ['a get_folders timeout', new Error(`Request to ${API}/get_folders timed out after 30000ms`)],
        ['a reset before the TLS connection opened', resetError('ECONNRESET', TLS_NOT_OPEN)],
        ['a refused connection', resetError('ECONNREFUSED')],
        ['a failed name lookup', resetError('ENOTFOUND')],
        ['a connection timeout', resetError('ETIMEDOUT')],
        ['a 503 page', new Error('<html><head><title>503 Service Temporarily Unavailable</title></head></html>')],
        ['a 408 page', new Error('<html><head><title>408 Request Time-out</title></head></html>')],
        ['a reply with no body and status 503', new Error('unknown ksm error, code 503')],
        ['an access error body', new Error('{"error":"access_denied","message":"Record is not editable"}')],
        ['a body that is not JSON', new Error('{not json')],
        ['an out of sync error', new Error(`Record ${RECORD_UID} is out of sync`)],
        ['a plain message', new Error('something else')],
        ['a message that is not a string', {message: 5}],
        ['a string', 'timed out'],
        ['undefined', undefined],
        ['null', null]
    ])('%s is not an unknown outcome', (_name, error) => {
        expect(unknownOutcomeCause(error)).toBeUndefined()
    })

    test('the pinned SDK still words its errors the way the detector expects', () => {
        const bundle = fs.readFileSync(require.resolve('@keeper-security/secrets-manager-core'), 'utf8')

        expect(bundle).toMatch(/Request to \$\{[^}]+\} timed out after \$\{[^}]+\}ms/)
        expect(bundle).toContain('unknown ksm error, code ${')
    })
})
