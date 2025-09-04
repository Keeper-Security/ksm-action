import {expect, test, describe, beforeEach, jest} from '@jest/globals'
import {getRecordUids, parseSecretsInputs, KsmAction, KsmActionError, KsmErrorType, IKsmOperations, createRunner} from '../src/main'

// Mock implementations
class MockKsmOperations implements IKsmOperations {
    mockRecords: Map<string, any> = new Map()
    shouldFailWith: Error | null = null

    async getSecrets(options: any, filter?: string[]): Promise<any> {
        if (this.shouldFailWith) throw this.shouldFailWith

        const records = filter?.map(uid => this.mockRecords.get(uid)).filter(Boolean) || []

        return {records, warnings: []}
    }

    async updateSecret(options: any, record: any): Promise<void> {
        if (this.shouldFailWith) throw this.shouldFailWith
        this.mockRecords.set(record.recordUid, JSON.parse(JSON.stringify(record)))
    }

    async createSecret(options: any, folderUid: string, recordData: any): Promise<string> {
        if (this.shouldFailWith) throw this.shouldFailWith
        const uid = 'NEW_' + Date.now()
        this.mockRecords.set(uid, {recordUid: uid, data: recordData})
        return uid
    }

    async uploadFile(options: any, record: any, file: any): Promise<string> {
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
        return ''
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
