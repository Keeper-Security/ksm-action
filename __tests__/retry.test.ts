import {describe, test, expect, jest, beforeEach} from '@jest/globals'
import {KsmAction, KsmOperations} from '../src/main'
import {KeeperSecrets, KeeperRecord} from '@keeper-security/secrets-manager-core'

// Mock the KSM operations
class MockKsmOperationsWithSync extends KsmOperations {
    private attemptCount = 0
    public maxFailures = 1
    public shouldFailWithSync = true

    async updateSecret(options: any, record: KeeperRecord): Promise<void> {
        if (this.shouldFailWithSync && this.attemptCount < this.maxFailures) {
            this.attemptCount++
            throw new Error('Record MC5EQRXjBQMiKidoMQuoSQ is out of sync')
        }
        // Success after retry
        this.attemptCount = 0
        return Promise.resolve()
    }

    async getSecrets(options: any, uids: string[]): Promise<KeeperSecrets> {
        return {
            records: [
                {
                    recordUid: 'TestRecord',
                    data: {
                        title: 'Test Record',
                        type: 'login',
                        fields: [
                            {type: 'login', value: ['testuser']},
                            {type: 'password', value: ['testpass']},
                            {type: 'notes', value: ['test notes']}
                        ],
                        custom: []
                    }
                }
            ]
        } as KeeperSecrets
    }

    resetAttempts(): void {
        this.attemptCount = 0
    }
}

describe('Retry Mechanism for Out of Sync Errors', () => {
    let mockOps: MockKsmOperationsWithSync
    let mockLogger: any
    let action: KsmAction

    beforeEach(() => {
        mockOps = new MockKsmOperationsWithSync()
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

    test('Should retry on out of sync error and succeed', async () => {
        mockOps.maxFailures = 1
        mockOps.shouldFailWithSync = true

        const input = {
            uid: 'TestRecord',
            selector: 'field',
            notation: 'TestRecord/field/notes',
            destination: 'new value',
            operationType: 1, // store
            destinationType: 3, // value
            fieldType: 'notes'
        }

        await action.storeFieldValue({} as any, input)

        // Should have warning about retry
        expect(mockLogger.warning).toHaveBeenCalledWith(expect.stringContaining('Record out of sync, retrying'))

        // Should eventually succeed
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully stored value'))
    })

    test('Should fail after max retries', async () => {
        mockOps.maxFailures = 3 // More than max retries
        mockOps.shouldFailWithSync = true

        const input = {
            uid: 'TestRecord',
            selector: 'field',
            notation: 'TestRecord/field/notes',
            destination: 'new value',
            operationType: 1,
            destinationType: 3,
            fieldType: 'notes'
        }

        await expect(action.storeFieldValue({} as any, input)).rejects.toThrow()

        // Should have tried to retry at least twice
        const retryWarnings = (mockLogger.warning as jest.Mock).mock.calls.filter((call: any[]) => call[0].includes('retrying'))
        expect(retryWarnings.length).toBe(2)
        expect(retryWarnings[0][0]).toContain('attempt 2/3')
        expect(retryWarnings[1][0]).toContain('attempt 3/3')

        // Should not succeed
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Successfully stored value'))
    })

    test('Should not retry on non-sync errors', async () => {
        mockOps.shouldFailWithSync = false
        // Make it fail with a different error
        mockOps.updateSecret = jest.fn(() => Promise.reject(new Error('Permission denied'))) as any

        const input = {
            uid: 'TestRecord',
            selector: 'field',
            notation: 'TestRecord/field/notes',
            destination: 'new value',
            operationType: 1,
            destinationType: 3,
            fieldType: 'notes'
        }

        await expect(action.storeFieldValue({} as any, input)).rejects.toThrow()

        // Should not have retry warnings
        expect(mockLogger.warning).not.toHaveBeenCalledWith(expect.stringContaining('retrying'))
    })
})
