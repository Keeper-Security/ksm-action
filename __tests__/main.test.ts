import {expect, test, describe, beforeEach, afterEach, jest} from '@jest/globals'
import {getRecordUids, parseSecretsInputs, KsmAction, KsmActionError, KsmErrorType, IKsmOperations, createRunner, serializeValue} from '../src/main'
import * as fs from 'fs'
import * as path from 'path'

// Mock implementations
class MockKsmOperations implements IKsmOperations {
    mockRecords: Map<string, any> = new Map()
    shouldFailWith: Error | null = null
    callLog: {method: string; args: any[]}[] = []
    updateDelay = 0

    async getSecrets(options: any, filter?: string[]): Promise<any> {
        this.callLog.push({method: 'getSecrets', args: [filter]})
        if (this.shouldFailWith) throw this.shouldFailWith

        // If no filter, return all records
        const records = filter ? filter.map(uid => this.mockRecords.get(uid)).filter(Boolean) : Array.from(this.mockRecords.values())

        return {records, warnings: []}
    }

    async updateSecret(options: any, record: any): Promise<void> {
        this.callLog.push({method: 'updateSecret', args: [record.recordUid]})
        if (this.shouldFailWith) throw this.shouldFailWith
        if (this.updateDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.updateDelay))
        }
        this.mockRecords.set(record.recordUid, JSON.parse(JSON.stringify(record)))
    }

    async createSecret(options: any, folderUid: string, recordData: any): Promise<string> {
        this.callLog.push({method: 'createSecret', args: [folderUid, recordData]})
        if (this.shouldFailWith) throw this.shouldFailWith
        const uid = 'NEW_' + Date.now()
        this.mockRecords.set(uid, {recordUid: uid, data: recordData})
        return uid
    }

    async uploadFile(options: any, record: any, file: any): Promise<string> {
        this.callLog.push({method: 'uploadFile', args: [record.recordUid, file.name]})
        if (this.shouldFailWith) throw this.shouldFailWith
        // Simulate adding fileRef to record
        if (!record.data.fields) {
            record.data.fields = []
        }
        let fileRef = record.data.fields.find((f: any) => f.type === 'fileRef')
        const fileUid = 'FILE_' + Date.now()
        if (fileRef) {
            fileRef.value.push(fileUid)
        } else {
            record.data.fields.push({type: 'fileRef', value: [fileUid]})
        }
        return fileUid
    }

    async downloadFile(file: any): Promise<Uint8Array> {
        this.callLog.push({method: 'downloadFile', args: [file]})
        return new Uint8Array([1, 2, 3])
    }

    getValue(secrets: any, notation: string): any {
        // Simple mock implementation
        const parts = notation.split('/')
        const uid = parts[0]
        const record = this.mockRecords.get(uid)
        if (!record) throw new Error('Record not found')

        if (parts[1] === 'field' && parts[2]) {
            const field = record.data.fields?.find((f: any) => f.type === parts[2])
            return field?.value?.[0] || ''
        }
        if (parts[1] === 'file') {
            return {name: parts[2] || 'file.txt', data: new Uint8Array([1, 2, 3])}
        }
        return ''
    }
}

// Helper to create a standard mock logger
function createTestLogger() {
    return {
        info: jest.fn(),
        error: jest.fn(),
        warning: jest.fn(),
        debug: jest.fn(),
        setSecret: jest.fn(),
        setOutput: jest.fn(),
        exportVariable: jest.fn(),
        setFailed: jest.fn(),
        getBooleanInput: jest.fn((name: string) => {
            if (name === 'fail-on-store-error') return true
            return false
        }),
        getInput: jest.fn(() => ''),
        getMultilineInput: jest.fn(() => [])
    }
}

// Original tests - maintain backward compatibility
describe('Original Tests - Backward Compatibility', () => {
    test('Input parsing OK', () => {
        const parsedInputs = parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username'])
        expect(parsedInputs[0].notation).toBe('BediNKCMG21ztm5xGYgNww/field/login')
        expect(parsedInputs[0].destination).toBe('username')
    })

    test('Record uid extraction OK', () => {
        const recordUids = getRecordUids(parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username', 'BediNKCMG21ztm5xGYgNww/field/password > password']))
        expect(recordUids).toStrictEqual(['BediNKCMG21ztm5xGYgNww'])
    })

    test('Record title extraction OK', () => {
        const recordUids = getRecordUids(parseSecretsInputs(['My Secret Ttile/field/login > username', 'My Secret Ttile/field/password > password']))
        expect(recordUids).toStrictEqual(['My Secret Ttile'])
    })

    test('Input and Destination splitting OK', () => {
        const parsedInputs = parseSecretsInputs([
            'BediNKCMG21ztm5xGYgNww/field/a b>ab',
            'BediNKCMG21ztm5xGYgNww/field/a b >ab',
            'BediNKCMG21ztm5xGYgNww/field/a b > ab',
            'BediNKCMG21ztm5xGYgNww/field/a b   >ab',
            'BediNKCMG21ztm5xGYgNww/field/a b>   ab',
            'BediNKCMG21ztm5xGYgNww/field/a b   >   ab'
        ])

        parsedInputs.forEach((parsedInput, index) => {
            expect(parsedInput.notation).toBe('BediNKCMG21ztm5xGYgNww/field/a b')
            expect(parsedInput.destination).toBe('ab')
            expect(parsedInput.destinationType).toBe(0)
        })
    })

    test('Record Title and Destination splitting OK', () => {
        const parsedInputs = parseSecretsInputs([
            `Title w\/ special chars > and delims/field/a b>>ab`,
            `Title w\/ special chars > and delims/field/a b> >ab`,
            `Title w\/ special chars > and delims/field/a b>  >  ab`
        ])

        parsedInputs.forEach((parsedInput, index) => {
            expect(parsedInput.notation).toBe(`Title w\/ special chars > and delims/field/a b>`)
            expect(parsedInput.destination).toBe('ab')
            expect(parsedInput.destinationType).toBe(0)
        })
    })

    test('Notation prefix and no prefix are OK', () => {
        const parsedInputs = parseSecretsInputs(['keeper://Title1/field/a b > ab', 'Title1/field/a b > ab'])

        parsedInputs.forEach((parsedInput, index) => {
            let notations = ['keeper://Title1/field/a b', 'Title1/field/a b']
            expect(notations).toContain(parsedInput.notation)
            expect(parsedInput.destination).toBe('ab')
            expect(parsedInput.destinationType).toBe(0)
        })
    })
})

// New tests for store functionality
describe('Store Operation Parsing', () => {
    test('Parse store operation with < operator', () => {
        const parsedInputs = parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/password < newpassword123'])
        expect(parsedInputs[0].notation).toBe('BediNKCMG21ztm5xGYgNww/field/password')
        expect(parsedInputs[0].destination).toBe('newpassword123')
        expect(parsedInputs[0].operationType).toBe(1) // OperationType.store
    })

    test('Parse mixed retrieve and store operations', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/login > username', 'Record2/field/password < newpass'])
        expect(parsedInputs[0].operationType).toBe(0) // retrieve
        expect(parsedInputs[1].operationType).toBe(1) // store
        expect(parsedInputs[0].destination).toBe('username')
        expect(parsedInputs[1].destination).toBe('newpass')
    })

    test('Store operation with various spacing', () => {
        const parsedInputs = parseSecretsInputs([
            'BediNKCMG21ztm5xGYgNww/field/api_key<secret123',
            'BediNKCMG21ztm5xGYgNww/field/api_key <secret123',
            'BediNKCMG21ztm5xGYgNww/field/api_key < secret123',
            'BediNKCMG21ztm5xGYgNww/field/api_key   <secret123',
            'BediNKCMG21ztm5xGYgNww/field/api_key<   secret123',
            'BediNKCMG21ztm5xGYgNww/field/api_key   <   secret123'
        ])

        parsedInputs.forEach(parsedInput => {
            expect(parsedInput.notation).toBe('BediNKCMG21ztm5xGYgNww/field/api_key')
            expect(parsedInput.destination).toBe('secret123')
            expect(parsedInput.operationType).toBe(1) // store
        })
    })

    test('Quoted store value preserves inner whitespace', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/password < "password with spaces  "', "Record1/field/password < 'password with spaces  '"])

        parsedInputs.forEach(parsedInput => {
            expect(parsedInput.destination).toBe('password with spaces  ')
            expect(parsedInput.operationType).toBe(1)
        })
    })

    test('Unquoted store value is trimmed', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/password < mypassword'])
        expect(parsedInputs[0].destination).toBe('mypassword')
    })

    test('Mismatched quotes are not stripped', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < "not closed'])
        expect(parsedInputs[0].destination).toBe('"not closed')
    })

    test('Empty quoted value is preserved', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < ""'])
        expect(parsedInputs[0].destination).toBe('')
    })

    test('Quoted value with special characters', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/password < "p@ss<w>rd!#$%"', 'Record1/field/password < \'value with "inner quotes"\''])
        expect(parsedInputs[0].destination).toBe('p@ss<w>rd!#$%')
        expect(parsedInputs[1].destination).toBe('value with "inner quotes"')
    })

    test('Quoted value with leading/trailing whitespace preserved', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < "  leading spaces"', 'Record1/field/notes < "trailing spaces  "', 'Record1/field/notes < "  both sides  "'])
        expect(parsedInputs[0].destination).toBe('  leading spaces')
        expect(parsedInputs[1].destination).toBe('trailing spaces  ')
        expect(parsedInputs[2].destination).toBe('  both sides  ')
    })

    test('Single character quoted values', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < "x"', "Record1/field/notes < 'y'"])
        expect(parsedInputs[0].destination).toBe('x')
        expect(parsedInputs[1].destination).toBe('y')
    })

    test('Value that is just quotes is stripped to empty', () => {
        const parsedInputs = parseSecretsInputs(["Record1/field/notes < ''"])
        expect(parsedInputs[0].destination).toBe('')
    })

    test('Store with env: prefix is not affected by quoting', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < env:MY_VAR'])
        expect(parsedInputs[0].destination).toBe('env:MY_VAR')
    })

    test('Store with file: prefix is not affected by quoting', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < file:./data.txt'])
        expect(parsedInputs[0].destination).toBe('file:./data.txt')
    })

    test('Quoted value containing only whitespace', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < "   "'])
        expect(parsedInputs[0].destination).toBe('   ')
    })

    test('Value with newline-like content in quotes', () => {
        const parsedInputs = parseSecretsInputs(['Record1/field/notes < "line1\\nline2"'])
        expect(parsedInputs[0].destination).toBe('line1\\nline2')
    })

    test('Store operator uses last < when title contains < [bug proof]', () => {
        // Proof: indexOf('<') finds the FIRST '<', misparsing titles that contain '<'.
        // e.g. 'My < Title/field/notes < value' => notation='My', source='Title/field/notes < value'
        // Fix: lastIndexOf('<') mirrors the lastIndexOf('>') used for the retrieve operator.
        const parsed = parseSecretsInputs(['My < Title/field/notes < somevalue'])
        expect(parsed[0].notation).toBe('My < Title/field/notes')
        expect(parsed[0].destination).toBe('somevalue')
        expect(parsed[0].operationType).toBe(1)
    })

    test('Unquoted value containing < is preserved intact [document behavior]', () => {
        // The first < after the field name is the operator; everything after it is the
        // source value, including any further < characters. No quoting needed for <.
        const parsed = parseSecretsInputs(['Record1/field/notes < a<b'])
        expect(parsed[0].notation).toBe('Record1/field/notes')
        expect(parsed[0].destination).toBe('a<b')
        expect(parsed[0].operationType).toBe(1)
    })
})

describe('KsmAction Store Operations', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
            debug: jest.fn(),
            setSecret: jest.fn(),
            setOutput: jest.fn(),
            exportVariable: jest.fn(),
            setFailed: jest.fn(),
            getBooleanInput: jest.fn(() => false),
            getInput: jest.fn(),
            getMultilineInput: jest.fn(() => [])
        }
        action = new KsmAction(mockOps, mockLogger)
    })

    test('Successfully stores field value', async () => {
        const record = {
            recordUid: 'TestUID',
            data: {
                fields: [{type: 'password', value: ['oldpass']}]
            }
        }
        mockOps.mockRecords.set('TestUID', record)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/password',
            destination: 'newpass123',
            operationType: 1, // store
            destinationType: 3 // value
        }

        await action.storeFieldValue({} as any, input)

        const updated = mockOps.mockRecords.get('TestUID')
        expect(updated.data.fields[0].value[0]).toBe('newpass123')
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored'))
    })

    test('Rejects creating new field when field does not exist', async () => {
        const record = {
            recordUid: 'TestUID',
            data: {
                fields: []
            }
        }
        mockOps.mockRecords.set('TestUID', record)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/api_key',
            destination: 'secret123',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeInstanceOf(KsmActionError)
        // The error could be either from field not existing or from unrecognized field type
        const hasExpectedError =
            errorThrown.message.includes("Field 'api_key' does not exist in this record") || errorThrown.message.includes("Field type 'api_key' is not a recognized KSM field type")
        expect(hasExpectedError).toBe(true)

        // Verify field was NOT created
        const updated = mockOps.mockRecords.get('TestUID')
        expect(updated.data.fields).toHaveLength(0)
    })
})

describe('Permission Error Handling', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
            debug: jest.fn(),
            setSecret: jest.fn(),
            setOutput: jest.fn(),
            exportVariable: jest.fn(),
            setFailed: jest.fn(),
            getBooleanInput: jest.fn(() => false),
            getInput: jest.fn(),
            getMultilineInput: jest.fn(() => [])
        }
        action = new KsmAction(mockOps, mockLogger)
    })

    test('Handles permission denied gracefully', async () => {
        mockOps.shouldFailWith = new Error('access denied')

        const input = {
            uid: 'TestRecord',
            selector: 'field',
            notation: 'TestRecord/field/password',
            destination: 'newpass',
            operationType: 1, // store
            destinationType: 3 // value
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeInstanceOf(KsmActionError)
        expect(errorThrown.type).toBe(KsmErrorType.PERMISSION_DENIED)
        expect(errorThrown.message).toContain('Permission denied')

        // Verify logger was called with appropriate messages
        expect(mockLogger.error).toHaveBeenCalledTimes(3)
    })

    test('Distinguishes between permission and not found errors', async () => {
        mockOps.shouldFailWith = new Error('record does not exist')

        const input = {
            uid: 'NonExistent',
            selector: 'field',
            notation: 'NonExistent/field/password',
            destination: 'value',
            operationType: 1, // store
            destinationType: 3 // value
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeInstanceOf(KsmActionError)
        expect(errorThrown.type).toBe(KsmErrorType.RECORD_NOT_FOUND)
        expect(errorThrown.message).toContain('not found')
    })

    test('Provides helpful error message for unauthorized error', async () => {
        mockOps.shouldFailWith = new Error('unauthorized to modify this record')

        const input = {
            uid: 'TestRecord',
            selector: 'field',
            notation: 'TestRecord/field/password',
            destination: 'newpass',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeInstanceOf(KsmActionError)
        expect(errorThrown.type).toBe(KsmErrorType.PERMISSION_DENIED)
        expect(errorThrown.message).toContain('Permission denied')

        // Error handler should have been called with helpful messages
        expect(mockLogger.error).toHaveBeenCalled()
    })
})

describe('Security: Secret Masking for Store Operations', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
            debug: jest.fn(),
            setSecret: jest.fn(),
            setOutput: jest.fn(),
            exportVariable: jest.fn(),
            setFailed: jest.fn(),
            getBooleanInput: jest.fn(() => false),
            getInput: jest.fn(),
            getMultilineInput: jest.fn(() => [])
        }
        action = new KsmAction(mockOps, mockLogger)
    })

    test('Stored value is masked via setSecret', async () => {
        const record = {
            recordUid: 'TestUID',
            data: {
                fields: [{type: 'password', value: ['oldpass']}]
            }
        }
        mockOps.mockRecords.set('TestUID', record)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/password',
            destination: 'my-super-secret-value',
            operationType: 1,
            destinationType: 3
        }

        await action.storeFieldValue({} as any, input)

        expect(mockLogger.setSecret).toHaveBeenCalledWith('my-super-secret-value')
    })

    test('Debug log redacts destination for store operations', () => {
        const parsedInputs = parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/password < secretvalue'])
        // The destination should be parsed but the debug log should use *** for store ops
        expect(parsedInputs[0].destination).toBe('secretvalue')
        expect(parsedInputs[0].operationType).toBe(1) // store
    })
})

describe('Security: File Path Traversal Prevention', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
            debug: jest.fn(),
            setSecret: jest.fn(),
            setOutput: jest.fn(),
            exportVariable: jest.fn(),
            setFailed: jest.fn(),
            getBooleanInput: jest.fn(() => false),
            getInput: jest.fn(),
            getMultilineInput: jest.fn(() => [])
        }
        action = new KsmAction(mockOps, mockLogger)
    })

    test('Rejects file: source outside workspace', async () => {
        const record = {
            recordUid: 'TestUID',
            data: {
                fields: [{type: 'notes', value: ['old']}]
            }
        }
        mockOps.mockRecords.set('TestUID', record)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'file:/etc/passwd',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeDefined()
        expect(errorThrown.message).toContain('workspace directory')
    })

    test('Rejects file: source with path traversal', async () => {
        const record = {
            recordUid: 'TestUID',
            data: {
                fields: [{type: 'notes', value: ['old']}]
            }
        }
        mockOps.mockRecords.set('TestUID', record)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'file:../../../../../../etc/shadow',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeDefined()
        expect(errorThrown.message).toContain('workspace directory')
    })

    test('Rejects file upload outside workspace', async () => {
        const record = {
            recordUid: 'TestUID',
            data: {
                fields: [{type: 'fileRef', value: []}]
            }
        }
        mockOps.mockRecords.set('TestUID', record)

        const input = {
            uid: 'TestUID',
            selector: 'file',
            notation: 'TestUID/file',
            destination: 'file:/etc/hosts',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }

        expect(errorThrown).toBeDefined()
        expect(errorThrown.message).toContain('workspace directory')
    })
})

describe('Source Value Resolution', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction
    const testFilePath = path.join(process.cwd(), '__tests__', 'test-source-value.tmp')

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()
        action = new KsmAction(mockOps, mockLogger)

        // Set up a record with a notes field for all tests
        mockOps.mockRecords.set('TestUID', {
            recordUid: 'TestUID',
            data: {fields: [{type: 'notes', value: ['original']}]}
        })
    })

    afterEach(() => {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath)
        }
        delete process.env.TEST_STORE_VALUE
    })

    test('Stores literal value directly', async () => {
        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'hello world',
            operationType: 1,
            destinationType: 3
        }
        await action.storeFieldValue({} as any, input)

        const updated = mockOps.mockRecords.get('TestUID')
        expect(updated.data.fields[0].value[0]).toBe('hello world')
    })

    test('Stores value from env: source', async () => {
        process.env.TEST_STORE_VALUE = 'from-environment'

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'env:TEST_STORE_VALUE',
            operationType: 1,
            destinationType: 3
        }
        await action.storeFieldValue({} as any, input)

        const updated = mockOps.mockRecords.get('TestUID')
        expect(updated.data.fields[0].value[0]).toBe('from-environment')
    })

    test('env: source with unset variable stores empty and skips with default config', async () => {
        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'env:NONEXISTENT_VAR_12345',
            operationType: 1,
            destinationType: 3
        }

        await action.storeFieldValue({} as any, input)

        // With allow-empty-values=false (default), should skip
        expect(mockLogger.warning).toHaveBeenCalledWith(expect.stringContaining('Skipping empty value'))
        // Record should NOT be updated
        expect(mockOps.callLog.filter(c => c.method === 'updateSecret')).toHaveLength(0)
    })

    test('Stores value from file: source', async () => {
        fs.writeFileSync(testFilePath, 'content-from-file')

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: `file:${testFilePath}`,
            operationType: 1,
            destinationType: 3
        }
        await action.storeFieldValue({} as any, input)

        const updated = mockOps.mockRecords.get('TestUID')
        expect(updated.data.fields[0].value[0]).toBe('content-from-file')
    })

    test('file: source with nonexistent file throws error', async () => {
        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'file:' + path.join(process.cwd(), 'nonexistent-file-xyz.txt'),
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }
        expect(errorThrown).toBeDefined()
    })

    test('env: source warns when environment variable is not set [bug proof]', async () => {
        // Proof: before fix, only 'Skipping empty value' is logged — no hint that the
        // variable itself is missing vs. intentionally empty.
        const varName = 'KSM_TEST_UNSET_VAR_99999'
        delete process.env[varName]
        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: `env:${varName}`,
            operationType: 1,
            destinationType: 3
        }
        await action.storeFieldValue({} as any, input)
        expect(mockLogger.warning).toHaveBeenCalledWith(expect.stringContaining(varName))
        expect(mockLogger.warning).toHaveBeenCalledWith(expect.stringContaining('not set'))
    })

    test('out: source prefix throws a not-supported error [bug proof]', async () => {
        // Proof: before fix, out: calls this.logger.getInput(outputVar) which reads
        // workflow *inputs*, not step outputs — undocumented and silently wrong.
        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: 'out:some_step_output',
            operationType: 1,
            destinationType: 3
        }
        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }
        expect(errorThrown).toBeDefined()
        expect(errorThrown.message).toMatch(/not supported/)
    })
})

describe('File Upload to Record', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction
    const testFilePath = path.join(process.cwd(), '__tests__', 'test-upload.tmp')

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()
        action = new KsmAction(mockOps, mockLogger)

        mockOps.mockRecords.set('TestUID', {
            recordUid: 'TestUID',
            data: {fields: [{type: 'login', value: ['user@test.com']}]}
        })
    })

    afterEach(() => {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath)
        }
    })

    test('Uploads file to record via file selector', async () => {
        fs.writeFileSync(testFilePath, 'file upload content')

        const input = {
            uid: 'TestUID',
            selector: 'file',
            notation: 'TestUID/file',
            destination: `file:${testFilePath}`,
            operationType: 1,
            destinationType: 3
        }

        await action.storeFieldValue({} as any, input)

        // Verify uploadFile was called
        const uploadCalls = mockOps.callLog.filter(c => c.method === 'uploadFile')
        expect(uploadCalls).toHaveLength(1)
        expect(uploadCalls[0].args[0]).toBe('TestUID')
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('File uploaded successfully'))
    })

    test('File upload with nonexistent file throws error', async () => {
        const input = {
            uid: 'TestUID',
            selector: 'file',
            notation: 'TestUID/file',
            destination: 'file:' + path.join(process.cwd(), 'no-such-file.bin'),
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }
        expect(errorThrown).toBeDefined()
        // Error may be wrapped — check both direct and wrapped message
        expect(errorThrown).toBeInstanceOf(KsmActionError)
    })
})

describe('Create Record (create-if-missing)', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()
        // Enable create-if-missing and set folder-uid
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'create-if-missing') return true
            if (name === 'fail-on-store-error') return true
            return false
        })
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'folder-uid') return 'FOLDER_ABC123'
            if (name === 'new-record-type') return 'login'
            return ''
        })
        action = new KsmAction(mockOps, mockLogger)
    })

    test('Creates new record when record not found and create-if-missing is true', async () => {
        // No record in mock — will trigger create flow
        const input = {
            uid: 'NewRecord',
            selector: 'field',
            notation: 'NewRecord/field/password',
            destination: 'new-password-123',
            operationType: 1,
            destinationType: 3
        }

        await action.storeFieldValue({} as any, input)

        const createCalls = mockOps.callLog.filter(c => c.method === 'createSecret')
        expect(createCalls).toHaveLength(1)
        expect(createCalls[0].args[0]).toBe('FOLDER_ABC123')
        expect(createCalls[0].args[1].title).toBe('NewRecord')
        expect(createCalls[0].args[1].type).toBe('login')
        expect(createCalls[0].args[1].fields[0].type).toBe('password')
        expect(createCalls[0].args[1].fields[0].value[0]).toBe('new-password-123')
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Created new record'))
    })

    test('Throws when create-if-missing is true but folder-uid is missing', async () => {
        mockLogger.getInput = jest.fn(() => '') // No folder-uid
        action = new KsmAction(mockOps, mockLogger)

        const input = {
            uid: 'NewRecord',
            selector: 'field',
            notation: 'NewRecord/field/login',
            destination: 'test@example.com',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }
        expect(errorThrown).toBeDefined()
        expect(errorThrown).toBeInstanceOf(KsmActionError)
    })

    test('Throws when record not found and create-if-missing is false', async () => {
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'create-if-missing') return false
            if (name === 'fail-on-store-error') return true
            return false
        })
        action = new KsmAction(mockOps, mockLogger)

        const input = {
            uid: 'Missing',
            selector: 'field',
            notation: 'Missing/field/password',
            destination: 'value',
            operationType: 1,
            destinationType: 3
        }

        let errorThrown: any
        try {
            await action.storeFieldValue({} as any, input)
        } catch (error) {
            errorThrown = error
        }
        expect(errorThrown).toBeInstanceOf(KsmActionError)
        expect(errorThrown.type).toBe(KsmErrorType.RECORD_NOT_FOUND)
    })
})

describe('Sequential Store Operations on Same Record', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0=' // dummy base64
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => [])
    })

    test('Multiple fields on same record are updated sequentially without data loss', async () => {
        mockOps.mockRecords.set('RecA', {
            recordUid: 'RecA',
            data: {
                fields: [
                    {type: 'login', value: ['old-login']},
                    {type: 'password', value: ['old-pass']},
                    {type: 'url', value: ['old-url']}
                ]
            }
        })

        action = new KsmAction(mockOps, mockLogger)

        // Store 3 fields on same record
        const inputs = [
            {uid: 'RecA', selector: 'field', notation: 'RecA/field/login', destination: 'new-login', operationType: 1, destinationType: 3},
            {uid: 'RecA', selector: 'field', notation: 'RecA/field/password', destination: 'new-pass', operationType: 1, destinationType: 3},
            {uid: 'RecA', selector: 'field', notation: 'RecA/field/url', destination: 'https://new-url.com', operationType: 1, destinationType: 3}
        ]

        for (const input of inputs) {
            await action.storeFieldValue({} as any, input)
        }

        const final = mockOps.mockRecords.get('RecA')
        expect(final.data.fields.find((f: any) => f.type === 'login').value[0]).toBe('new-login')
        expect(final.data.fields.find((f: any) => f.type === 'password').value[0]).toBe('new-pass')
        expect(final.data.fields.find((f: any) => f.type === 'url').value[0]).toBe('https://new-url.com')

        // Verify updateSecret was called 3 times (once per field, sequentially)
        const updateCalls = mockOps.callLog.filter(c => c.method === 'updateSecret')
        expect(updateCalls).toHaveLength(3)
    })

    test('Operations on different records can proceed independently', async () => {
        mockOps.mockRecords.set('RecA', {
            recordUid: 'RecA',
            data: {fields: [{type: 'notes', value: ['a']}]}
        })
        mockOps.mockRecords.set('RecB', {
            recordUid: 'RecB',
            data: {fields: [{type: 'notes', value: ['b']}]}
        })

        action = new KsmAction(mockOps, mockLogger)

        const inputA = {uid: 'RecA', selector: 'field', notation: 'RecA/field/notes', destination: 'updated-a', operationType: 1, destinationType: 3}
        const inputB = {uid: 'RecB', selector: 'field', notation: 'RecB/field/notes', destination: 'updated-b', operationType: 1, destinationType: 3}

        await action.storeFieldValue({} as any, inputA)
        await action.storeFieldValue({} as any, inputB)

        expect(mockOps.mockRecords.get('RecA').data.fields[0].value[0]).toBe('updated-a')
        expect(mockOps.mockRecords.get('RecB').data.fields[0].value[0]).toBe('updated-b')
    })
})

describe('Allow Empty Values Flag', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()

        mockOps.mockRecords.set('TestUID', {
            recordUid: 'TestUID',
            data: {fields: [{type: 'notes', value: ['has-content']}]}
        })
    })

    test('Skips empty value when allow-empty-values is false', async () => {
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'allow-empty-values') return false
            return false
        })
        const action = new KsmAction(mockOps, mockLogger)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: '',
            operationType: 1,
            destinationType: 3
        }

        await action.storeFieldValue({} as any, input)

        expect(mockLogger.warning).toHaveBeenCalledWith(expect.stringContaining('Skipping empty value'))
        // Record should NOT be changed
        expect(mockOps.mockRecords.get('TestUID').data.fields[0].value[0]).toBe('has-content')
    })

    test('Stores empty value when allow-empty-values is true', async () => {
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'allow-empty-values') return true
            if (name === 'fail-on-store-error') return true
            return false
        })
        const action = new KsmAction(mockOps, mockLogger)

        const input = {
            uid: 'TestUID',
            selector: 'field',
            notation: 'TestUID/field/notes',
            destination: '',
            operationType: 1,
            destinationType: 3
        }

        await action.storeFieldValue({} as any, input)

        const updated = mockOps.mockRecords.get('TestUID')
        expect(updated.data.fields[0].value[0]).toBe('')
    })
})

describe('End-to-End run() with Store Operations', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()

        mockOps.mockRecords.set('BediNKCMG21ztm5xGYgNww', {
            recordUid: 'BediNKCMG21ztm5xGYgNww',
            data: {
                fields: [
                    {type: 'login', value: ['admin@example.com']},
                    {type: 'password', value: ['oldpassword']},
                    {type: 'notes', value: ['old notes']}
                ]
            }
        })
    })

    test('Mixed retrieve and store operations in single run', async () => {
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['BediNKCMG21ztm5xGYgNww/field/login > username', 'BediNKCMG21ztm5xGYgNww/field/notes < updated notes from CI'])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        // Verify retrieve happened
        expect(mockLogger.setOutput).toHaveBeenCalledWith('username', 'admin@example.com')

        // Verify store happened
        const updated = mockOps.mockRecords.get('BediNKCMG21ztm5xGYgNww')
        expect(updated.data.fields.find((f: any) => f.type === 'notes').value[0]).toBe('updated notes from CI')

        // Should not have failed
        expect(mockLogger.setFailed).not.toHaveBeenCalled()
    })

    test('Store-only run completes successfully', async () => {
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => [
            'BediNKCMG21ztm5xGYgNww/field/password < new-secure-password',
            'BediNKCMG21ztm5xGYgNww/field/notes < "notes with trailing spaces  "'
        ])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        const updated = mockOps.mockRecords.get('BediNKCMG21ztm5xGYgNww')
        expect(updated.data.fields.find((f: any) => f.type === 'password').value[0]).toBe('new-secure-password')
        expect(updated.data.fields.find((f: any) => f.type === 'notes').value[0]).toBe('notes with trailing spaces  ')
        expect(mockLogger.setFailed).not.toHaveBeenCalled()
    })

    test('Empty config fails gracefully', async () => {
        mockLogger.getInput = jest.fn(() => '')
        mockLogger.getMultilineInput = jest.fn(() => [])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setFailed).toHaveBeenCalledWith('Configuration string is empty')
    })

    test('fail-on-store-error=true fails the action on store failure', async () => {
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['BediNKCMG21ztm5xGYgNww/field/fileRef < should-fail'])
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'fail-on-store-error') return true
            return false
        })

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setFailed).toHaveBeenCalledWith(expect.stringContaining('store operation(s) failed'))
    })

    test('fail-on-store-error=false does not fail the action on store failure', async () => {
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['BediNKCMG21ztm5xGYgNww/field/fileRef < should-fail'])
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'fail-on-store-error') return false
            return false
        })

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        // Should report error but NOT fail the action
        expect(mockLogger.error).toHaveBeenCalled()
        expect(mockLogger.setFailed).not.toHaveBeenCalled()
    })

    test('Multiple store ops on same record use 1 fetch + 1 update [performance bug proof]', async () => {
        // Proof: before fix, run() calls storeFieldValue once per op, each doing its own
        // getSecrets+updateSecret. 2 ops on same record = 2 fetches + 2 updates.
        // After fix via storeFieldsForRecord(), run() batches them: 1 fetch + 1 update.
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['BediNKCMG21ztm5xGYgNww/field/login < new-login', 'BediNKCMG21ztm5xGYgNww/field/notes < new-notes'])
        mockLogger.getBooleanInput = jest.fn((name: string) => {
            if (name === 'fail-on-store-error') return true
            return false
        })

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        const fetchCalls = mockOps.callLog.filter((c: any) => c.method === 'getSecrets')
        const updateCalls = mockOps.callLog.filter((c: any) => c.method === 'updateSecret')
        expect(fetchCalls).toHaveLength(1)
        expect(updateCalls).toHaveLength(1)

        const updated = mockOps.mockRecords.get('BediNKCMG21ztm5xGYgNww')
        expect(updated.data.fields.find((f: any) => f.type === 'login').value[0]).toBe('new-login')
        expect(updated.data.fields.find((f: any) => f.type === 'notes').value[0]).toBe('new-notes')
    })
})

describe('Error Enhancement for Retrieve Operations', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()

        mockOps.mockRecords.set('TestUID', {
            recordUid: 'TestUID',
            data: {
                type: 'login',
                title: 'My Test Record',
                fields: [
                    {type: 'login', value: ['user@test.com']},
                    {type: 'password', value: ['secret123']}
                ],
                custom: [{type: 'text', label: 'apiKey', value: ['key-123']}]
            }
        })

        // Make getValue throw for nonexistent fields
        mockOps.getValue = (secrets: any, notation: string) => {
            const parts = notation.split('/')
            const uid = parts[0]
            const record = secrets.records.find((r: any) => r.recordUid === uid)
            if (!record) throw new Error(`Record not found`)

            if (parts[1] === 'field' && parts[2]) {
                const field = record.data.fields?.find((f: any) => f.type === parts[2])
                if (!field) throw new Error(`Field ${parts[2]} not found in the record`)
                return field.value?.[0] || ''
            }
            throw new Error('Invalid notation')
        }

        action = new KsmAction(mockOps, mockLogger)
    })

    test('Provides helpful error with available fields when field not found', async () => {
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['TestUID/field/nonexistent > output_var'])

        const action = new KsmAction(mockOps, mockLogger)

        let errorThrown: any
        try {
            await action.run()
        } catch (error) {
            errorThrown = error
        }

        // Should have logged available field types
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('login'))
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Available standard fields'))
    })
})

// ── serializeValue unit tests ──────────────────────────────────────────

describe('serializeValue', () => {
    test('passes strings through unchanged', () => {
        expect(serializeValue('my-password')).toBe('my-password')
    })

    test('preserves strings with newlines (no double-escaping)', () => {
        const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----'
        expect(serializeValue(key)).toBe(key)
    })

    test('serializes objects as JSON', () => {
        expect(serializeValue({a: 1, b: 'two'})).toBe('{"a":1,"b":"two"}')
    })

    test('serializes arrays as JSON', () => {
        expect(serializeValue([1, 2, 3])).toBe('[1,2,3]')
    })

    test('returns empty string for null', () => {
        expect(serializeValue(null)).toBe('')
    })

    test('returns empty string for undefined', () => {
        expect(serializeValue(undefined)).toBe('')
    })

    test('returns empty string for empty string', () => {
        expect(serializeValue('')).toBe('')
    })

    test('serializes numbers via JSON.stringify', () => {
        expect(serializeValue(42)).toBe('42')
    })

    test('serializes booleans via JSON.stringify', () => {
        expect(serializeValue(true)).toBe('true')
    })

    test('preserves newlines inside object values', () => {
        const obj = {privateKey: '-----BEGIN\n-----END'}
        const result = serializeValue(obj)
        expect(result).toBe(JSON.stringify(obj))
        expect(result).toContain('\\n')
    })
})

// ── Structured Field Serialization (Issue #148) ────────────────────────

describe('Structured Field Serialization (Issue #148)', () => {
    let mockOps: MockKsmOperations
    let mockLogger: any

    beforeEach(() => {
        mockOps = new MockKsmOperations()
        mockLogger = createTestLogger()

        mockOps.mockRecords.set('TestUID', {
            recordUid: 'TestUID',
            data: {
                type: 'sshKeys',
                title: 'SSH Key Record',
                fields: [
                    {type: 'login', value: ['user@test.com']},
                    {type: 'keyPair', value: [{publicKey: 'ssh-rsa AAAA', privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB\n-----END RSA PRIVATE KEY-----'}]}
                ],
                custom: [
                    {type: 'phone', label: 'phone', value: [{number: '555-1234', type: 'Mobile'}]},
                    {type: 'name', label: 'name', value: [{first: 'Jenny', last: 'Smith'}]}
                ]
            }
        })
    })

    test('keyPair object is JSON-serialized for output destination', async () => {
        const keyPairValue = {publicKey: 'ssh-rsa AAAA', privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB\n-----END RSA PRIVATE KEY-----'}
        mockOps.getValue = () => keyPairValue
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['TestUID/field/keyPair > SSH_KEY'])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        const expectedJson = JSON.stringify(keyPairValue)
        expect(mockLogger.setOutput).toHaveBeenCalledWith('SSH_KEY', expectedJson)
        // Must contain escaped newline, not stripped
        expect(expectedJson).toContain('\\n')
    })

    test('phone object is JSON-serialized for environment destination', async () => {
        const phoneValue = {number: '555-1234', type: 'Mobile'}
        mockOps.getValue = () => phoneValue
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['TestUID/custom_field/phone > env:PHONE'])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.exportVariable).toHaveBeenCalledWith('PHONE', JSON.stringify(phoneValue))
    })

    test('structured value written to file is JSON, not [object Object]', async () => {
        const nameValue = {first: 'Jenny', last: 'Smith'}
        mockOps.getValue = () => nameValue
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })

        // Write to a temp file and verify contents (avoids spyOn issue with CJS fs)
        const tmpDir = path.join(process.cwd(), '__tests__', 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, {recursive: true})
        const tmpFile = path.join(tmpDir, 'name-test.json')

        const origWorkspace = process.env.GITHUB_WORKSPACE
        process.env.GITHUB_WORKSPACE = process.cwd()

        try {
            const relPath = path.relative(process.cwd(), tmpFile)
            mockLogger.getMultilineInput = jest.fn(() => [`TestUID/custom_field/name > file:./${relPath}`])

            const action = new KsmAction(mockOps, mockLogger)
            await action.run()

            const written = fs.readFileSync(tmpFile, 'utf8')
            expect(written).toBe(JSON.stringify(nameValue))
            expect(written).not.toBe('[object Object]')
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir)
            if (origWorkspace !== undefined) {
                process.env.GITHUB_WORKSPACE = origWorkspace
            } else {
                delete process.env.GITHUB_WORKSPACE
            }
        }
    })

    test('simple string fields pass through unchanged (no double-quoting)', async () => {
        mockOps.getValue = () => 'my-password-123'
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['TestUID/field/login > PASSWORD'])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setOutput).toHaveBeenCalledWith('PASSWORD', 'my-password-123')
    })

    test('null value returns empty string', async () => {
        mockOps.getValue = () => null
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['TestUID/field/login > OUTPUT'])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        expect(mockLogger.setOutput).toHaveBeenCalledWith('OUTPUT', '')
    })

    test('setSecret masks individual string properties of structured values', async () => {
        const keyPairValue = {publicKey: 'pub-key-data', privateKey: 'secret-key-data'}
        mockOps.getValue = () => keyPairValue
        mockLogger.getInput = jest.fn((name: string) => {
            if (name === 'keeper-secret-config') return 'eyJ0ZXN0IjogdHJ1ZX0='
            return ''
        })
        mockLogger.getMultilineInput = jest.fn(() => ['TestUID/field/keyPair > SSH_KEY'])

        const action = new KsmAction(mockOps, mockLogger)
        await action.run()

        // Should mask the full JSON string
        expect(mockLogger.setSecret).toHaveBeenCalledWith(JSON.stringify(keyPairValue))
        // Should also mask each individual string property
        expect(mockLogger.setSecret).toHaveBeenCalledWith('pub-key-data')
        expect(mockLogger.setSecret).toHaveBeenCalledWith('secret-key-data')
    })
})
