import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type {KeeperFileUpload, KeeperRecord, KeeperSecrets, SecretManagerOptions} from '@keeper-security/secrets-manager-core'
import {IKsmOperations, KsmAction, KsmOperations} from '../src/main'

// src/main.ts calls the SDK through this module object, so these spies replace the SDK calls.
const sdk = jest.requireActual<typeof import('@keeper-security/secrets-manager-core')>('@keeper-security/secrets-manager-core')

const FILE_TRANSFER_TIMEOUT_MS = 300000
const RECORD_UID = 'AAAAAAAAAAAAAAAAAAAAAA'
const FILE_UID = 'BBBBBBBBBBBBBBBBBBBBBB'
const FOLDER_UID = 'DDDDDDDDDDDDDDDDDDDDDD'
const BINARY = new Uint8Array([0, 255, 1, 128, 10, 13, 42])
const FAKE_CONFIG = Buffer.from(
    JSON.stringify({
        hostname: 'invalid.example',
        clientId: 'c3ludGhldGljLWNsaWVudA==',
        privateKey: 'c3ludGhldGljLWtleQ==',
        appKey: 'c3ludGhldGljLWFwcA=='
    })
).toString('base64')
const V133_INPUTS = [
    'keeper-secret-config',
    'secrets',
    'create-if-missing',
    'folder-uid',
    'new-record-type',
    'fail-on-store-error',
    'allow-empty-values',
    'max-throttle-wait-seconds'
]

function createRecord(): KeeperRecord {
    return {
        recordUid: RECORD_UID,
        revision: 1,
        data: {title: 'Synthetic record', type: 'login', fields: [{type: 'login', value: ['synthetic-login']}], custom: []},
        files: [{fileUid: FILE_UID, data: {name: 'fixture.bin', title: 'fixture.bin'}}]
    }
}

function createSecrets(record: KeeperRecord): KeeperSecrets {
    return {appData: {title: 'Synthetic application', type: 'secrets-manager'}, records: [record]}
}

function createOptions(): SecretManagerOptions {
    return {storage: sdk.loadJsonConfig(FAKE_CONFIG)}
}

function createLogger(lines: string[]) {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setSecret: jest.fn(),
        setOutput: jest.fn(),
        exportVariable: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn((name: string) => (name === 'keeper-secret-config' ? FAKE_CONFIG : '')),
        getMultilineInput: jest.fn(() => lines),
        getBooleanInput: jest.fn((name: string) => name === 'fail-on-store-error')
    }
}

describe('File transfer timeout', () => {
    let workspace: string
    let previousWorkspace: string | undefined

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ksm-file-transfer-'))
        previousWorkspace = process.env.GITHUB_WORKSPACE
        process.env.GITHUB_WORKSPACE = workspace
    })

    afterEach(() => {
        jest.restoreAllMocks()
        if (previousWorkspace === undefined) {
            delete process.env.GITHUB_WORKSPACE
        } else {
            process.env.GITHUB_WORKSPACE = previousWorkspace
        }
        fs.rmSync(workspace, {recursive: true, force: true})
    })

    test('KsmOperations.downloadFile passes a 300000 ms timeout to the SDK', async () => {
        const file = createRecord().files![0]
        const download = jest.spyOn(sdk, 'downloadFile').mockResolvedValue(BINARY)
        await expect(new KsmOperations().downloadFile(file)).resolves.toBe(BINARY)
        expect(download.mock.calls).toStrictEqual([[file, FILE_TRANSFER_TIMEOUT_MS]])
    })

    test('KsmOperations.uploadFile passes a 300000 ms timeout to the SDK', async () => {
        const options = createOptions()
        const record = createRecord()
        const file: KeeperFileUpload = {name: 'upload.bin', title: 'upload.bin', type: 'application/octet-stream', data: BINARY}
        const upload = jest.spyOn(sdk, 'uploadFile').mockResolvedValue(FILE_UID)
        await expect(new KsmOperations().uploadFile(options, record, file)).resolves.toBe(FILE_UID)
        expect(upload.mock.calls).toStrictEqual([[options, record, file, FILE_TRANSFER_TIMEOUT_MS]])
    })

    test('Keeper API calls pass the caller options to the SDK unchanged', async () => {
        const options = createOptions()
        const record = createRecord()
        const recordData = {title: 'Synthetic record', type: 'login', fields: []}
        const getSecrets = jest.spyOn(sdk, 'getSecrets').mockResolvedValue(createSecrets(record))
        const updateSecret = jest.spyOn(sdk, 'updateSecret').mockResolvedValue(undefined)
        const createSecret = jest.spyOn(sdk, 'createSecret').mockResolvedValue(RECORD_UID)
        const operations = new KsmOperations()
        await operations.getSecrets(options, [RECORD_UID])
        await operations.updateSecret(options, record)
        await operations.createSecret(options, FOLDER_UID, recordData)
        expect(getSecrets.mock.calls).toStrictEqual([[options, [RECORD_UID]]])
        expect(updateSecret.mock.calls).toStrictEqual([[options, record]])
        expect(createSecret.mock.calls).toStrictEqual([[options, FOLDER_UID, recordData]])
        expect(Object.keys(options)).toEqual(['storage'])
    })

    test('run() passes one options object to every Keeper API call', async () => {
        const record = createRecord()
        const operations: jest.Mocked<IKsmOperations> = {
            getSecrets: jest.fn<IKsmOperations['getSecrets']>().mockResolvedValue(createSecrets(record)),
            updateSecret: jest.fn<IKsmOperations['updateSecret']>().mockResolvedValue(undefined),
            createSecret: jest.fn<IKsmOperations['createSecret']>().mockResolvedValue(RECORD_UID),
            uploadFile: jest.fn<IKsmOperations['uploadFile']>().mockResolvedValue(FILE_UID),
            downloadFile: jest.fn<IKsmOperations['downloadFile']>().mockResolvedValue(BINARY),
            getValue: jest.fn<IKsmOperations['getValue']>().mockReturnValue('synthetic-login')
        }
        const logger = createLogger([`${RECORD_UID}/field/login > LOGIN`, `${RECORD_UID}/field/login < synthetic-updated-login`])
        await new KsmAction(operations, logger as unknown as typeof core).run()
        expect(logger.setFailed).not.toHaveBeenCalled()
        expect(operations.getSecrets).toHaveBeenCalledTimes(2)
        const options = operations.getSecrets.mock.calls[0][0]
        expect(operations.getSecrets.mock.calls[1][0]).toBe(options)
        expect(operations.updateSecret).toHaveBeenCalledWith(options, record)
    })

    test('run() downloads and uploads files with the file transfer timeout', async () => {
        const record = createRecord()
        const destination = path.join(workspace, 'download.bin')
        const source = path.join(workspace, 'upload.bin')
        fs.writeFileSync(source, BINARY)
        const getSecrets = jest.spyOn(sdk, 'getSecrets').mockResolvedValue(createSecrets(record))
        const download = jest.spyOn(sdk, 'downloadFile').mockResolvedValue(BINARY)
        const upload = jest.spyOn(sdk, 'uploadFile').mockResolvedValue(FILE_UID)
        const logger = createLogger([`${RECORD_UID}/file/fixture.bin > file:${destination}`, `${RECORD_UID}/file/upload.bin < file:${source}`])
        await new KsmAction(new KsmOperations(), logger as unknown as typeof core).run()
        expect(logger.setFailed).not.toHaveBeenCalled()
        expect(getSecrets).toHaveBeenCalledTimes(2)
        const options = getSecrets.mock.calls[0][0]
        expect(download.mock.calls).toStrictEqual([[record.files![0], FILE_TRANSFER_TIMEOUT_MS]])
        expect(upload.mock.calls).toStrictEqual([
            [options, record, {name: 'upload.bin', title: 'upload.bin', type: 'application/octet-stream', data: BINARY}, FILE_TRANSFER_TIMEOUT_MS]
        ])
        expect(fs.readFileSync(destination)).toEqual(Buffer.from(BINARY))
    })
})

describe('action.yml', () => {
    test('has no request-timeout-seconds input', () => {
        const text = fs.readFileSync(path.join(__dirname, '..', 'action.yml'), 'utf8')
        const lines = text.split(/\r?\n/)
        const start = lines.indexOf('inputs:')
        const end = lines.findIndex((line, index) => index > start && /^\S/.test(line))
        const names = lines.slice(start + 1, end).flatMap(line => /^ {2}([\w-]+):\s*$/.exec(line)?.[1] ?? [])
        expect(start).toBeGreaterThanOrEqual(0)
        expect(names).toEqual(V133_INPUTS)
        expect(names).not.toContain('request-timeout-seconds')
        expect(text).not.toContain('request-timeout')
    })
})
