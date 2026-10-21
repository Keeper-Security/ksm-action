import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals'
import * as core from '@actions/core'
import {KeeperFile, KeeperRecord, KeeperSecrets, loadJsonConfig, SecretManagerOptions} from '@keeper-security/secrets-manager-core'
import {randomUUID} from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {IKsmOperations, KsmAction, KsmErrorType, parseSecretsInputs} from '../src/main'

type RetrieveKind = 'field' | 'attachment'
type SecretsInput = ReturnType<typeof parseSecretsInputs>[number]
type OwnedDirectory = {root: string; marker: string; owner: string}

const RECORD_UID = 'AAAAAAAAAAAAAAAAAAAAAA'
const FILE_UID = 'BBBBBBBBBBBBBBBBBBBBBB'
const TEXT = 'synthetic-line-1\nsynthetic-line-2-é\n'
const ORIGINAL = 'synthetic-original-value'
const BINARY = new Uint8Array([0, 255, 1, 128, 10, 13, 42])
const attachment: KeeperFile = {fileUid: FILE_UID, data: {name: 'fixture.bin', title: 'fixture.bin'}}

function createOwnedDirectory(): OwnedDirectory {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ksm-file-paths-'))
    const marker = path.join(root, '.test-owner')
    const owner = randomUUID()
    fs.writeFileSync(marker, owner, {mode: 0o600})
    return {root, marker, owner}
}

function removeOwnedDirectory(directory: OwnedDirectory): void {
    if (fs.readFileSync(directory.marker, 'utf8') !== directory.owner) {
        throw new Error('Test directory ownership could not be verified')
    }
    fs.rmSync(directory.root, {recursive: true, force: true})
}

function linkDirectory(target: string, link: string): void {
    fs.symlinkSync(path.resolve(target), link, process.platform === 'win32' ? 'junction' : 'dir')
}

function linkFile(target: string, link: string): void {
    fs.symlinkSync(path.resolve(target), link, 'file')
}

function supportsLinks(kind: 'directory' | 'file' | 'hard'): boolean {
    const directory = createOwnedDirectory()
    try {
        const target = path.join(directory.root, 'target')
        const link = path.join(directory.root, 'link')
        if (kind === 'directory') {
            fs.mkdirSync(target)
            linkDirectory(target, link)
        } else {
            fs.writeFileSync(target, ORIGINAL)
            if (kind === 'hard') {
                fs.linkSync(target, link)
            } else {
                linkFile(target, link)
            }
        }
        return true
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (process.platform === 'win32' && (code === 'EPERM' || code === 'EACCES')) {
            console.warn(`Skipping ${kind}-link fixtures because Windows denied link creation (${code})`)
            return false
        }
        throw error
    } finally {
        removeOwnedDirectory(directory)
    }
}

const directoryLinkTest = supportsLinks('directory') ? test : test.skip
const fileLinkTest = supportsLinks('file') ? test : test.skip
const hardLinkTest = supportsLinks('hard') ? test : test.skip
const retrieveKinds: RetrieveKind[] = ['field', 'attachment']

function createLogger() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        setSecret: jest.fn(),
        setOutput: jest.fn(),
        exportVariable: jest.fn(),
        setFailed: jest.fn(),
        getInput: jest.fn((name: string) => (name === 'keeper-secret-config' ? '{"fixture":"synthetic"}' : '')),
        getMultilineInput: jest.fn((): string[] => []),
        getBooleanInput: jest.fn((name: string) => name === 'fail-on-store-error')
    }
}

function notationFor(kind: RetrieveKind): string {
    return kind === 'attachment' ? `${RECORD_UID}/file/fixture.bin` : `${RECORD_UID}/field/password`
}

function retrieveInput(destination: string, kind: RetrieveKind, prefix = 'file:'): SecretsInput {
    const inputs = parseSecretsInputs([`${notationFor(kind)} > ${prefix}${destination}`])
    expect(inputs).toHaveLength(1)
    return inputs[0]
}

describe('File paths', () => {
    let owned: OwnedDirectory
    let workspace: string
    let nested: string
    let outside: string
    let sibling: string
    let outsideFile: string
    let siblingFile: string
    let sourceFile: string
    let previousWorkspace: string | undefined
    let previousDirectory: string
    let record: KeeperRecord
    let secrets: KeeperSecrets
    let options: SecretManagerOptions
    let operations: jest.Mocked<IKsmOperations>
    let logger: ReturnType<typeof createLogger>
    let action: KsmAction

    beforeEach(() => {
        previousWorkspace = process.env.GITHUB_WORKSPACE
        previousDirectory = process.cwd()
        owned = createOwnedDirectory()
        workspace = path.join(owned.root, 'workspace')
        nested = path.join(workspace, 'nested')
        outside = path.join(owned.root, 'outside')
        sibling = `${workspace}-sibling`
        for (const directory of [workspace, nested, outside, sibling]) {
            fs.mkdirSync(directory)
        }
        outsideFile = path.join(outside, 'kept.txt')
        siblingFile = path.join(sibling, 'kept.txt')
        sourceFile = path.join(workspace, 'source.txt')
        fs.writeFileSync(outsideFile, ORIGINAL)
        fs.writeFileSync(siblingFile, ORIGINAL)
        fs.writeFileSync(sourceFile, TEXT)
        process.env.GITHUB_WORKSPACE = workspace
        record = {
            recordUid: RECORD_UID,
            revision: 1,
            data: {
                type: 'login',
                title: 'Synthetic fixture',
                fields: [
                    {type: 'login', value: ['synthetic-login']},
                    {type: 'password', value: [ORIGINAL]}
                ],
                custom: []
            },
            files: [attachment]
        }
        secrets = {appData: {title: 'Synthetic application', type: 'secrets-manager'}, records: [record]}
        options = {storage: loadJsonConfig('{"fixture":"synthetic"}')}
        operations = {
            getSecrets: jest.fn<IKsmOperations['getSecrets']>().mockResolvedValue(secrets),
            updateSecret: jest.fn<IKsmOperations['updateSecret']>().mockResolvedValue(undefined),
            createSecret: jest.fn<IKsmOperations['createSecret']>().mockResolvedValue(RECORD_UID),
            uploadFile: jest.fn<IKsmOperations['uploadFile']>().mockResolvedValue(FILE_UID),
            downloadFile: jest.fn<IKsmOperations['downloadFile']>().mockResolvedValue(BINARY),
            getValue: jest.fn<IKsmOperations['getValue']>().mockReturnValue(TEXT)
        }
        logger = createLogger()
        action = new KsmAction(operations, logger as unknown as typeof core)
    })

    afterEach(() => {
        jest.restoreAllMocks()
        process.chdir(previousDirectory)
        if (previousWorkspace === undefined) {
            delete process.env.GITHUB_WORKSPACE
        } else {
            process.env.GITHUB_WORKSPACE = previousWorkspace
        }
        removeOwnedDirectory(owned)
    })

    function originalFilesAreUnchanged(): void {
        expect(fs.readFileSync(outsideFile, 'utf8')).toBe(ORIGINAL)
        expect(fs.readFileSync(siblingFile, 'utf8')).toBe(ORIGINAL)
    }

    function prepareValue(kind: RetrieveKind): void {
        operations.getValue.mockReturnValue(kind === 'attachment' ? attachment : TEXT)
    }

    async function retrieve(destination: string, kind: RetrieveKind, prefix = 'file:'): Promise<void> {
        prepareValue(kind)
        await action.processRetrieveOperations(options, [retrieveInput(destination, kind, prefix)], secrets)
    }

    async function expectRejectedDestination(destination: string, kind: RetrieveKind, message: string): Promise<void> {
        prepareValue(kind)
        await expect(action.processRetrieveOperations(options, [retrieveInput(destination, kind)], secrets)).rejects.toMatchObject({
            type: KsmErrorType.INVALID_CONFIG,
            message: expect.stringContaining(message)
        })
        expect(operations.getValue).not.toHaveBeenCalled()
        expect(operations.downloadFile).not.toHaveBeenCalled()
        expect(logger.setOutput).not.toHaveBeenCalled()
        expect(logger.exportVariable).not.toHaveBeenCalled()
        originalFilesAreUnchanged()
    }

    function storeInput(source: string): SecretsInput {
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/login < file:${source}`])
        expect(inputs).toHaveLength(1)
        return inputs[0]
    }

    function expectNoStoreCalls(): void {
        expect(operations.getSecrets).not.toHaveBeenCalled()
        expect(operations.updateSecret).not.toHaveBeenCalled()
        expect(operations.createSecret).not.toHaveBeenCalled()
        expect(operations.uploadFile).not.toHaveBeenCalled()
        originalFilesAreUnchanged()
    }

    describe('Retrieving values to files', () => {
        test.each([
            {name: 'text', value: 'synthetic-value', expected: 'synthetic-value'},
            {name: 'multiline text', value: TEXT, expected: TEXT},
            {name: 'structured values', value: {first: 'Synthetic', last: 'Fixture'}, expected: '{"first":"Synthetic","last":"Fixture"}'},
            {name: 'arrays', value: ['synthetic-one', 'synthetic-two'], expected: '["synthetic-one","synthetic-two"]'},
            {name: 'numbers', value: 133, expected: '133'},
            {name: 'booleans', value: true, expected: 'true'},
            {name: 'empty strings', value: '', expected: ''},
            {name: 'null values', value: null, expected: ''}
        ])('writes $name without changing serialized content', async ({value, expected}) => {
            const destination = path.join(nested, 'value.txt')
            operations.getValue.mockReturnValue(value)
            await action.processRetrieveOperations(options, [retrieveInput(destination, 'field')], secrets)
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(expected))
            expect(operations.downloadFile).not.toHaveBeenCalled()
        })

        test('writes custom fields to nested files', async () => {
            const destination = path.join(nested, 'custom.json')
            const value = {first: 'Synthetic', last: 'Fixture'}
            operations.getValue.mockReturnValue(value)
            const inputs = parseSecretsInputs([`${RECORD_UID}/custom_field/QA Name > file:${destination}`])
            await action.processRetrieveOperations(options, inputs, secrets)
            expect(JSON.parse(fs.readFileSync(destination, 'utf8'))).toEqual(value)
        })

        test.each(retrieveKinds)('replaces an existing regular file for %s retrieval', async kind => {
            const destination = path.join(workspace, 'existing.txt')
            fs.writeFileSync(destination, ORIGINAL)
            await retrieve(destination, kind)
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        test.each(retrieveKinds)('resolves %s file paths relative to the current directory', async kind => {
            process.chdir(workspace)
            const destination = path.join(nested, 'relative.txt')
            const relativePath = path.relative(process.cwd(), destination)
            expect(path.isAbsolute(relativePath)).toBe(false)
            await retrieve(relativePath, kind)
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        test.each(retrieveKinds)('resolves %s file paths from a nested current directory', async kind => {
            process.chdir(nested)
            await retrieve('relative.txt', kind)
            expect(fs.readFileSync(path.join(nested, 'relative.txt'))).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        test.each(retrieveKinds)('accepts normalized nested paths for %s retrieval', async kind => {
            const destination = `${nested}${path.sep}..${path.sep}normalized.txt`
            await retrieve(destination, kind)
            expect(fs.readFileSync(path.join(workspace, 'normalized.txt'))).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        test('accepts nested directory names beginning with dots', async () => {
            const directory = path.join(workspace, '..notes')
            fs.mkdirSync(directory)
            await retrieve(path.join(directory, 'value.txt'), 'field')
            expect(fs.readFileSync(path.join(directory, 'value.txt'), 'utf8')).toBe(TEXT)
        })

        test.each(retrieveKinds)('uses the current directory for %s when the workspace variable is absent', async kind => {
            delete process.env.GITHUB_WORKSPACE
            process.chdir(workspace)
            const destination = path.join(nested, 'fallback.txt')
            await retrieve(path.join('nested', 'fallback.txt'), kind)
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        test.each([
            {name: 'explicit file', prefix: 'file:'},
            {name: 'unprefixed', prefix: ''},
            {name: 'environment-prefixed file', prefix: 'env:'}
        ])('downloads exact attachment bytes with $name destinations', async ({prefix}) => {
            const destination = path.join(nested, 'attachment.bin')
            await retrieve(destination, 'attachment', prefix)
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(BINARY))
            expect(operations.downloadFile).toHaveBeenCalledWith(attachment)
            expect(logger.setOutput).not.toHaveBeenCalled()
            expect(logger.exportVariable).not.toHaveBeenCalled()
        })

        test('downloads an empty attachment as a zero-byte file', async () => {
            operations.downloadFile.mockResolvedValue(new Uint8Array())
            const destination = path.join(nested, 'empty.bin')
            await retrieve(destination, 'attachment')
            expect(fs.statSync(destination).size).toBe(0)
        })

        test('keeps output and environment retrieval independent of file validation', async () => {
            process.env.GITHUB_WORKSPACE = path.join(owned.root, 'missing-workspace')
            const inputs = parseSecretsInputs([`${RECORD_UID}/field/password > VALUE`, `${RECORD_UID}/field/password > env:QA_VALUE`])
            await action.processRetrieveOperations(options, inputs, secrets)
            expect(logger.setOutput).toHaveBeenCalledWith('VALUE', TEXT)
            expect(logger.exportVariable).toHaveBeenCalledWith('QA_VALUE', TEXT)
            expect(operations.getValue).toHaveBeenCalledTimes(2)
            expect(operations.downloadFile).not.toHaveBeenCalled()
        })
    })

    describe('File destination validation', () => {
        test.each(retrieveKinds)('rejects new outside paths before %s resolution', async kind => {
            const destination = path.join(outside, 'new.txt')
            await expectRejectedDestination(destination, kind, 'workspace directory')
            expect(fs.existsSync(destination)).toBe(false)
        })

        test.each(retrieveKinds)('rejects existing outside paths before %s resolution', async kind => {
            await expectRejectedDestination(outsideFile, kind, 'workspace directory')
        })

        test.each(retrieveKinds)('rejects workspace-prefix sibling paths before %s resolution', async kind => {
            await expectRejectedDestination(siblingFile, kind, 'workspace directory')
        })

        test.each(retrieveKinds)('rejects relative outside paths before %s resolution', async kind => {
            await expectRejectedDestination(path.relative(process.cwd(), outsideFile), kind, 'workspace directory')
        })

        test.each(retrieveKinds)('rejects parent paths outside the workspace before %s resolution', async kind => {
            process.chdir(workspace)
            await expectRejectedDestination(path.join('..', 'outside', 'kept.txt'), kind, 'workspace directory')
        })

        test.each(retrieveKinds)('rejects outside %s destinations when the workspace variable is absent', async kind => {
            delete process.env.GITHUB_WORKSPACE
            process.chdir(workspace)
            await expectRejectedDestination(outsideFile, kind, 'workspace directory')
        })

        test.each(retrieveKinds.flatMap(kind => ['ENOENT', 'EACCES'].map(code => ({kind, code}))))(
            'reports $code target-stat errors before $kind resolution',
            async ({kind, code}) => {
                const destination = path.join(workspace, 'stat-error.txt')
                fs.writeFileSync(destination, ORIGINAL)
                const canonicalDestination = fs.realpathSync.native(destination)
                const realStat = fs.statSync
                const failingStat = ((...args: Parameters<typeof fs.statSync>) => {
                    if (args[0] === canonicalDestination) {
                        const error = new Error('Synthetic stat error') as NodeJS.ErrnoException
                        error.code = code
                        throw error
                    }
                    return realStat(...args)
                }) as typeof fs.statSync
                jest.spyOn(fs, 'statSync').mockImplementation(failingStat)
                await expectRejectedDestination(destination, kind, 'Unable to access file path')
                expect(fs.readFileSync(destination, 'utf8')).toBe(ORIGINAL)
            }
        )

        test.each(retrieveKinds)('rejects empty %s file destinations', async kind => {
            await expectRejectedDestination('', kind, 'must not be empty')
        })

        test.each(retrieveKinds)('rejects missing destination parents before %s resolution', async kind => {
            const directory = path.join(workspace, 'missing-parent')
            await expectRejectedDestination(path.join(directory, 'value.txt'), kind, 'Unable to resolve file path')
            expect(fs.existsSync(directory)).toBe(false)
        })

        test.each(retrieveKinds)('rejects regular files used as destination parents before %s resolution', async kind => {
            await expectRejectedDestination(path.join(sourceFile, 'value.txt'), kind, 'Unable to resolve file path')
            expect(fs.readFileSync(sourceFile, 'utf8')).toBe(TEXT)
        })

        test.each(retrieveKinds)('rejects existing directories as %s file destinations', async kind => {
            await expectRejectedDestination(nested, kind, 'regular file')
            expect(fs.statSync(nested).isDirectory()).toBe(true)
        })

        test.each(retrieveKinds)('rejects the workspace itself as a %s file destination', async kind => {
            await expectRejectedDestination(workspace, kind, 'regular file')
        })

        test.each(retrieveKinds)('rejects missing workspace directories before %s resolution', async kind => {
            process.env.GITHUB_WORKSPACE = path.join(owned.root, 'missing-workspace')
            await expectRejectedDestination(path.join(nested, 'value.txt'), kind, 'Workspace directory is not accessible')
        })

        test.each(retrieveKinds)('rejects non-directory workspaces before %s resolution', async kind => {
            process.env.GITHUB_WORKSPACE = sourceFile
            await expectRejectedDestination(path.join(nested, 'value.txt'), kind, 'Workspace directory is not accessible')
        })

        test.each(retrieveKinds)('reports invalid %s destinations through run', async kind => {
            prepareValue(kind)
            logger.getMultilineInput.mockReturnValue([`${notationFor(kind)} > file:${outsideFile}`])
            await action.run()
            expect(logger.setFailed).toHaveBeenCalledWith(expect.stringContaining('workspace directory'))
            expect(operations.getValue).not.toHaveBeenCalled()
            expect(operations.downloadFile).not.toHaveBeenCalled()
            originalFilesAreUnchanged()
        })

        test('reports empty file destinations through run', async () => {
            logger.getMultilineInput.mockReturnValue([`${notationFor('field')} > file:`])
            await action.run()
            expect(logger.setFailed).toHaveBeenCalledWith('File path must not be empty')
            expect(operations.getValue).not.toHaveBeenCalled()
        })

        test('completes run with a valid attachment destination', async () => {
            const destination = path.join(nested, 'run.bin')
            prepareValue('attachment')
            logger.getMultilineInput.mockReturnValue([`${notationFor('attachment')} > file:${destination}`])
            await action.run()
            expect(logger.setFailed).not.toHaveBeenCalled()
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(BINARY))
        })
    })

    describe('Directory aliases', () => {
        directoryLinkTest.each(retrieveKinds)('accepts workspace aliases for %s retrieval', async kind => {
            const alias = path.join(owned.root, 'workspace-alias')
            linkDirectory(workspace, alias)
            process.env.GITHUB_WORKSPACE = alias
            await retrieve(path.join(alias, 'nested', 'alias.txt'), kind)
            expect(fs.readFileSync(path.join(nested, 'alias.txt'))).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        directoryLinkTest.each(retrieveKinds)('accepts canonical destinations with an aliased workspace for %s retrieval', async kind => {
            const alias = path.join(owned.root, 'workspace-alias')
            linkDirectory(workspace, alias)
            process.env.GITHUB_WORKSPACE = alias
            await retrieve(path.join(nested, 'canonical.txt'), kind)
            expect(fs.readFileSync(path.join(nested, 'canonical.txt'))).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        directoryLinkTest.each(retrieveKinds)('accepts inside parent aliases for %s retrieval', async kind => {
            const alias = path.join(workspace, 'parent-alias')
            linkDirectory(nested, alias)
            const canonicalDestination = path.join(fs.realpathSync.native(nested), 'value.txt')
            const write = jest.spyOn(fs, 'writeFileSync')
            await retrieve(path.join(alias, 'value.txt'), kind)
            expect(write).toHaveBeenCalledWith(canonicalDestination, kind === 'attachment' ? BINARY : TEXT)
            expect(fs.readFileSync(canonicalDestination)).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
        })

        directoryLinkTest.each(retrieveKinds)('rejects new outside parent-alias destinations for %s retrieval', async kind => {
            const alias = path.join(workspace, 'parent-alias')
            linkDirectory(outside, alias)
            await expectRejectedDestination(path.join(alias, 'new.txt'), kind, 'workspace directory')
            expect(fs.existsSync(path.join(outside, 'new.txt'))).toBe(false)
            expect(fs.lstatSync(alias).isSymbolicLink()).toBe(true)
        })

        directoryLinkTest.each(retrieveKinds)('rejects existing outside parent-alias destinations for %s retrieval', async kind => {
            const alias = path.join(workspace, 'parent-alias')
            linkDirectory(outside, alias)
            await expectRejectedDestination(path.join(alias, 'kept.txt'), kind, 'workspace directory')
        })
    })

    describe('File aliases', () => {
        fileLinkTest.each(retrieveKinds)('writes canonical inside file targets for %s retrieval', async kind => {
            const target = path.join(nested, 'target.txt')
            const alias = path.join(workspace, 'alias.txt')
            fs.writeFileSync(target, ORIGINAL)
            linkFile(target, alias)
            const write = jest.spyOn(fs, 'writeFileSync')
            await retrieve(alias, kind)
            expect(write).toHaveBeenCalledWith(fs.realpathSync.native(target), kind === 'attachment' ? BINARY : TEXT)
            expect(fs.readFileSync(target)).toEqual(Buffer.from(kind === 'attachment' ? BINARY : TEXT))
            expect(fs.lstatSync(alias).isSymbolicLink()).toBe(true)
        })

        fileLinkTest.each(retrieveKinds)('rejects outside file aliases before %s resolution', async kind => {
            const alias = path.join(workspace, 'alias.txt')
            linkFile(outsideFile, alias)
            await expectRejectedDestination(alias, kind, 'workspace directory')
            expect(fs.lstatSync(alias).isSymbolicLink()).toBe(true)
        })

        fileLinkTest.each(retrieveKinds)('rejects dangling file aliases before %s resolution', async kind => {
            const target = path.join(nested, 'missing.txt')
            const alias = path.join(workspace, 'dangling.txt')
            linkFile(target, alias)
            await expectRejectedDestination(alias, kind, 'Unable to resolve file path')
            expect(fs.existsSync(target)).toBe(false)
            expect(fs.lstatSync(alias).isSymbolicLink()).toBe(true)
        })

        hardLinkTest.each(retrieveKinds)('rejects existing hard-linked destinations before %s resolution', async kind => {
            const destination = path.join(workspace, 'linked.txt')
            fs.linkSync(outsideFile, destination)
            await expectRejectedDestination(destination, kind, 'File destination must not be a hard link')
            expect(fs.readFileSync(destination, 'utf8')).toBe(ORIGINAL)
        })
    })

    describe('Attachment download validation', () => {
        test('keeps the selected workspace when its environment variable changes during download', async () => {
            const destination = path.join(workspace, 'attachment.bin')
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                process.env.GITHUB_WORKSPACE = outside
                return BINARY
            })
            await action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.readFileSync(destination)).toEqual(Buffer.from(BINARY))
            expect(fs.existsSync(path.join(outside, 'attachment.bin'))).toBe(false)
        })

        test('keeps the selected destination when the current directory changes during download', async () => {
            process.chdir(workspace)
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                process.chdir(outside)
                return BINARY
            })
            await action.processRetrieveOperations(options, [retrieveInput('attachment.bin', 'attachment')], secrets)
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.readFileSync(path.join(workspace, 'attachment.bin'))).toEqual(Buffer.from(BINARY))
            expect(fs.existsSync(path.join(outside, 'attachment.bin'))).toBe(false)
        })

        directoryLinkTest('validates a changed destination parent after downloading', async () => {
            const destination = path.join(nested, 'attachment.bin')
            const outsideDestination = path.join(outside, 'attachment.bin')
            fs.writeFileSync(outsideDestination, ORIGINAL)
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                fs.renameSync(nested, path.join(workspace, 'previous-parent'))
                linkDirectory(outside, nested)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG,
                message: expect.stringContaining('workspace directory')
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.readFileSync(outsideDestination, 'utf8')).toBe(ORIGINAL)
        })

        directoryLinkTest('keeps the original workspace for attachment validation', async () => {
            const destination = path.join(workspace, 'attachment.bin')
            const outsideDestination = path.join(outside, 'attachment.bin')
            fs.writeFileSync(outsideDestination, ORIGINAL)
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                fs.renameSync(workspace, path.join(owned.root, 'previous-workspace'))
                linkDirectory(outside, workspace)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.readFileSync(outsideDestination, 'utf8')).toBe(ORIGINAL)
        })

        fileLinkTest('validates changed file aliases after downloading', async () => {
            const destination = path.join(workspace, 'attachment.bin')
            fs.writeFileSync(destination, ORIGINAL)
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                fs.unlinkSync(destination)
                linkFile(outsideFile, destination)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG,
                message: expect.stringContaining('workspace directory')
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            originalFilesAreUnchanged()
        })

        fileLinkTest('validates new dangling aliases after downloading', async () => {
            const destination = path.join(workspace, 'attachment.bin')
            const missing = path.join(nested, 'missing.bin')
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                linkFile(missing, destination)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG,
                message: expect.stringContaining('Unable to resolve file path')
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.existsSync(missing)).toBe(false)
        })

        hardLinkTest('validates new hard links after downloading', async () => {
            const destination = path.join(workspace, 'attachment.bin')
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                fs.linkSync(outsideFile, destination)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG,
                message: expect.stringContaining('File destination must not be a hard link')
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            originalFilesAreUnchanged()
        })

        test('validates changed destination file types after downloading', async () => {
            const destination = path.join(nested, 'attachment.bin')
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                fs.mkdirSync(destination)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG,
                message: expect.stringContaining('regular file')
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.statSync(destination).isDirectory()).toBe(true)
        })

        test('validates removed destination parents after downloading', async () => {
            const destination = path.join(nested, 'attachment.bin')
            prepareValue('attachment')
            operations.downloadFile.mockImplementation(async () => {
                fs.rmdirSync(nested)
                return BINARY
            })
            await expect(action.processRetrieveOperations(options, [retrieveInput(destination, 'attachment')], secrets)).rejects.toMatchObject({
                type: KsmErrorType.INVALID_CONFIG,
                message: expect.stringContaining('Unable to resolve file path')
            })
            expect(operations.downloadFile).toHaveBeenCalledTimes(1)
            expect(fs.existsSync(nested)).toBe(false)
        })

        directoryLinkTest('reports changed attachment destinations through run', async () => {
            const destination = path.join(nested, 'attachment.bin')
            prepareValue('attachment')
            logger.getMultilineInput.mockReturnValue([`${notationFor('attachment')} > file:${destination}`])
            operations.downloadFile.mockImplementation(async () => {
                fs.renameSync(nested, path.join(workspace, 'previous-parent'))
                linkDirectory(outside, nested)
                return BINARY
            })
            await action.run()
            expect(logger.setFailed).toHaveBeenCalledWith(expect.stringContaining('workspace directory'))
            expect(fs.existsSync(path.join(outside, 'attachment.bin'))).toBe(false)
        })
    })

    describe('Storing field values from files', () => {
        test.each(['absolute', 'relative', 'nested'])('reads %s file sources', async location => {
            const actualSource = location === 'nested' ? path.join(nested, 'source.txt') : sourceFile
            if (location === 'nested') {
                fs.writeFileSync(actualSource, TEXT)
            }
            if (location === 'relative') {
                process.chdir(workspace)
            }
            const source = location === 'relative' ? path.relative(process.cwd(), actualSource) : actualSource
            if (location === 'relative') {
                expect(path.isAbsolute(source)).toBe(false)
            }
            await action.storeFieldValue(options, storeInput(source))
            expect(operations.updateSecret).toHaveBeenCalledWith(options, record)
            expect(record.data.fields.find((field: {type: string}) => field.type === 'login').value).toEqual([TEXT])
            expect(fs.readFileSync(actualSource, 'utf8')).toBe(TEXT)
        })

        test.each(['outside', 'prefix sibling', 'empty', 'missing parent', 'file parent', 'directory'])('rejects %s file sources before record calls', async location => {
            const sources: Record<string, string> = {
                outside: outsideFile,
                'prefix sibling': siblingFile,
                empty: '',
                'missing parent': path.join(workspace, 'missing-parent', 'source.txt'),
                'file parent': path.join(sourceFile, 'source.txt'),
                directory: nested
            }
            await expect(action.storeFieldValue(options, storeInput(sources[location]))).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        directoryLinkTest('reads file sources through workspace aliases', async () => {
            const alias = path.join(owned.root, 'workspace-alias')
            linkDirectory(workspace, alias)
            process.env.GITHUB_WORKSPACE = alias
            await action.storeFieldValue(options, storeInput(path.join(alias, 'source.txt')))
            expect(record.data.fields.find((field: {type: string}) => field.type === 'login').value).toEqual([TEXT])
        })

        directoryLinkTest('reads canonical file sources with an aliased workspace', async () => {
            const alias = path.join(owned.root, 'workspace-alias')
            linkDirectory(workspace, alias)
            process.env.GITHUB_WORKSPACE = alias
            await action.storeFieldValue(options, storeInput(sourceFile))
            expect(operations.updateSecret).toHaveBeenCalledTimes(1)
        })

        fileLinkTest('reads canonical inside source aliases', async () => {
            const alias = path.join(nested, 'source-alias.txt')
            linkFile(sourceFile, alias)
            const read = jest.spyOn(fs, 'readFileSync')
            await action.storeFieldValue(options, storeInput(alias))
            expect(read).toHaveBeenCalledWith(fs.realpathSync.native(sourceFile), 'utf8')
            expect(record.data.fields.find((field: {type: string}) => field.type === 'login').value).toEqual([TEXT])
        })

        fileLinkTest('rejects outside source aliases before record calls', async () => {
            const alias = path.join(workspace, 'source-alias.txt')
            linkFile(outsideFile, alias)
            await expect(action.storeFieldValue(options, storeInput(alias))).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        directoryLinkTest('rejects outside source parent aliases before record calls', async () => {
            const alias = path.join(workspace, 'source-parent')
            linkDirectory(outside, alias)
            await expect(action.storeFieldValue(options, storeInput(path.join(alias, 'kept.txt')))).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        fileLinkTest('rejects dangling source aliases before record calls', async () => {
            const alias = path.join(workspace, 'source-alias.txt')
            linkFile(path.join(nested, 'missing.txt'), alias)
            await expect(action.storeFieldValue(options, storeInput(alias))).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        hardLinkTest('supports existing hard-linked sources for field stores', async () => {
            const source = path.join(workspace, 'source-link.txt')
            fs.linkSync(outsideFile, source)
            await action.storeFieldValue(options, storeInput(source))
            expect(record.data.fields.find((field: {type: string}) => field.type === 'login').value).toEqual([ORIGINAL])
            expect(operations.updateSecret).toHaveBeenCalledTimes(1)
            originalFilesAreUnchanged()
        })

        test('reports invalid field sources through run', async () => {
            logger.getMultilineInput.mockReturnValue([`${RECORD_UID}/field/login < file:${siblingFile}`])
            await action.run()
            expect(logger.setFailed).toHaveBeenCalledWith('1 store operation(s) failed')
            expectNoStoreCalls()
        })
    })

    describe('Uploading files', () => {
        test.each(['explicit', 'unprefixed', 'relative'])('reads %s upload sources without changing bytes', async location => {
            const source = path.join(nested, 'upload.bin')
            fs.writeFileSync(source, BINARY)
            if (location === 'relative') {
                process.chdir(workspace)
            }
            const input = location === 'explicit' ? `file:${source}` : location === 'relative' ? path.relative(process.cwd(), source) : source
            if (location === 'relative') {
                expect(path.isAbsolute(input)).toBe(false)
            }
            await action.storeFileToRecord(options, record, input)
            expect(operations.uploadFile).toHaveBeenCalledWith(options, record, {
                name: 'upload.bin',
                title: 'upload.bin',
                type: 'application/octet-stream',
                data: BINARY
            })
        })

        test.each(['outside', 'prefix sibling', 'empty', 'missing parent', 'file parent', 'directory'])('rejects %s upload sources before uploads', async location => {
            const sources: Record<string, string> = {
                outside: outsideFile,
                'prefix sibling': siblingFile,
                empty: '',
                'missing parent': path.join(workspace, 'missing-parent', 'source.txt'),
                'file parent': path.join(sourceFile, 'source.txt'),
                directory: nested
            }
            await expect(action.storeFileToRecord(options, record, `file:${sources[location]}`)).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        test('rejects missing upload files without creating them', async () => {
            const source = path.join(nested, 'missing.bin')
            await expect(action.storeFileToRecord(options, record, `file:${source}`)).rejects.toThrow('File not found')
            expectNoStoreCalls()
            expect(fs.existsSync(source)).toBe(false)
        })

        directoryLinkTest('reads upload sources through workspace aliases', async () => {
            const alias = path.join(owned.root, 'workspace-alias')
            linkDirectory(workspace, alias)
            process.env.GITHUB_WORKSPACE = alias
            await action.storeFileToRecord(options, record, `file:${path.join(alias, 'source.txt')}`)
            expect(operations.uploadFile).toHaveBeenCalledWith(options, record, {
                name: 'source.txt',
                title: 'source.txt',
                type: 'text/plain',
                data: new Uint8Array(Buffer.from(TEXT))
            })
        })

        directoryLinkTest('reads upload sources through inside parent aliases', async () => {
            const alias = path.join(workspace, 'upload-parent')
            linkDirectory(nested, alias)
            fs.writeFileSync(path.join(nested, 'upload.txt'), TEXT)
            await action.storeFileToRecord(options, record, `file:${path.join(alias, 'upload.txt')}`)
            expect(operations.uploadFile).toHaveBeenCalledTimes(1)
        })

        fileLinkTest.each(['explicit', 'unprefixed', 'relative'])('preserves source alias filenames and media types for %s uploads', async location => {
            const target = path.join(nested, 'stored.bin')
            const alias = path.join(workspace, 'visible.pem')
            fs.writeFileSync(target, BINARY)
            linkFile(target, alias)
            if (location === 'relative') {
                process.chdir(workspace)
            }
            const source = location === 'explicit' ? `file:${alias}` : location === 'relative' ? path.relative(process.cwd(), alias) : alias
            if (location === 'relative') {
                expect(path.isAbsolute(source)).toBe(false)
            }
            const read = jest.spyOn(fs, 'readFileSync')
            await action.storeFileToRecord(options, record, source)
            expect(read).toHaveBeenCalledWith(fs.realpathSync.native(target))
            expect(operations.uploadFile).toHaveBeenCalledWith(options, record, {
                name: 'visible.pem',
                title: 'visible.pem',
                type: 'application/x-pem-file',
                data: BINARY
            })
        })

        fileLinkTest('rejects outside upload aliases before uploads', async () => {
            const alias = path.join(workspace, 'upload-alias.txt')
            linkFile(outsideFile, alias)
            await expect(action.storeFileToRecord(options, record, `file:${alias}`)).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        directoryLinkTest('rejects outside upload parent aliases before uploads', async () => {
            const alias = path.join(workspace, 'upload-parent')
            linkDirectory(outside, alias)
            await expect(action.storeFileToRecord(options, record, `file:${path.join(alias, 'kept.txt')}`)).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        fileLinkTest('rejects dangling upload aliases before uploads', async () => {
            const alias = path.join(workspace, 'upload-alias.txt')
            linkFile(path.join(nested, 'missing.bin'), alias)
            await expect(action.storeFileToRecord(options, record, `file:${alias}`)).rejects.toMatchObject({type: KsmErrorType.INVALID_CONFIG})
            expectNoStoreCalls()
        })

        hardLinkTest('supports existing hard-linked sources for uploads', async () => {
            const source = path.join(workspace, 'source-link.pem')
            fs.linkSync(outsideFile, source)
            await action.storeFileToRecord(options, record, `file:${source}`)
            expect(operations.uploadFile).toHaveBeenCalledWith(options, record, {
                name: 'source-link.pem',
                title: 'source-link.pem',
                type: 'application/x-pem-file',
                data: new Uint8Array(Buffer.from(ORIGINAL))
            })
            originalFilesAreUnchanged()
        })
    })
})
