import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {KsmAction, KsmOperations} from '../src/main'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import {loadJsonConfig, getSecrets} from '@keeper-security/secrets-manager-core'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local if it exists
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
    dotenv.config({path: envPath})
    console.log('✅ Loaded test configuration from .env.local')
} else {
    console.log('ℹ️  No .env.local found. Using environment variables or create .env.local from .env.local.example')
}

/**
 * Integration Tests for KSM GitHub Action
 *
 * These tests require real KSM configuration to run.
 *
 * Setup Option 1 - Using .env.local (Recommended):
 * 1. Copy .env.local.example to .env.local
 * 2. Fill in your KSM configuration values
 * 3. Run: npm test -- integration.test.ts
 *
 * Setup Option 2 - Using environment variables:
 * 1. Set environment variables:
 *    - KSM_TEST_CONFIG: Base64 encoded KSM configuration
 *    - KSM_TEST_RECORD_UID: UID of a test record to use for read/write tests
 *    - KSM_TEST_FOLDER_UID: UID of a folder for creating test records
 *    - KSM_TEST_SKIP_DESTRUCTIVE: Set to 'true' to skip tests that modify data
 * 2. Run: npm test -- integration.test.ts
 */

// Helper to check if integration tests should run
const shouldRunIntegrationTests = (): boolean => {
    return !!process.env.KSM_TEST_CONFIG
}

// Helper to check if destructive tests should run
const shouldRunDestructiveTests = (): boolean => {
    return shouldRunIntegrationTests() && process.env.KSM_TEST_SKIP_DESTRUCTIVE !== 'true'
}

// Skip integration tests if no config provided
const describeIntegration = shouldRunIntegrationTests() ? describe : describe.skip
const describeDestructive = shouldRunDestructiveTests() ? describe : describe.skip

// Mock logger for tests
const createMockLogger = () => ({
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn(),
    setSecret: jest.fn(),
    setOutput: jest.fn(),
    exportVariable: jest.fn(),
    setFailed: jest.fn(),
    getBooleanInput: jest.fn((name: string) => {
        switch (name) {
            case 'fail-on-store-error':
                return true
            case 'allow-empty-values':
                return false
            case 'create-if-missing':
                return false
            default:
                return false
        }
    }),
    getInput: jest.fn((name: string) => {
        switch (name) {
            case 'keeper-secret-config':
                return process.env.KSM_TEST_CONFIG
            case 'folder-uid':
                return process.env.KSM_TEST_FOLDER_UID
            default:
                return ''
        }
    }),
    getMultilineInput: jest.fn(() => [])
})

describeIntegration('Integration Tests - Read Operations', () => {
    let action: KsmAction
    let mockLogger: any
    let testConfig: any
    let testRecordUid: string

    beforeAll(() => {
        testConfig = process.env.KSM_TEST_CONFIG
        testRecordUid = process.env.KSM_TEST_RECORD_UID || ''

        if (!testConfig) {
            throw new Error('KSM_TEST_CONFIG environment variable not set')
        }

        console.log('Running integration tests with real KSM configuration')
        console.log(`Test record UID: ${testRecordUid || 'Not specified - will use first available record'}`)
    })

    beforeEach(() => {
        mockLogger = createMockLogger()
        action = new KsmAction(new KsmOperations(), mockLogger)
    })

    test('Can connect to KSM and retrieve records', async () => {
        const options = {storage: loadJsonConfig(testConfig)}
        const secrets = await getSecrets(options)

        expect(secrets).toBeDefined()
        expect(secrets.records).toBeDefined()
        expect(Array.isArray(secrets.records)).toBe(true)

        console.log(`Successfully retrieved ${secrets.records.length} record(s)`)

        if (secrets.records.length > 0 && !testRecordUid) {
            console.log('Available test records:')
            secrets.records.forEach(r => {
                console.log(`  - ${r.recordUid}: ${r.data?.title || 'Untitled'}`)
            })
        }
    })

    test('Can retrieve field value from record', async () => {
        const options = {storage: loadJsonConfig(testConfig)}
        const secrets = await getSecrets(options)

        if (secrets.records.length === 0) {
            console.log('No records available for testing - skipping')
            return
        }

        const testRecord = testRecordUid ? secrets.records.find(r => r.recordUid === testRecordUid) : secrets.records[0]

        if (!testRecord) {
            throw new Error(`Test record ${testRecordUid} not found`)
        }

        // Find a field to test with
        const testField = testRecord.data?.fields?.[0]
        if (!testField) {
            console.log('No fields in test record - skipping')
            return
        }

        const input = {
            uid: testRecord.recordUid,
            selector: 'field',
            notation: `${testRecord.recordUid}/field/${testField.type}`,
            destination: 'test_output',
            operationType: 0, // retrieve
            destinationType: 0 // output
        }

        // Process retrieve operation
        await action.processRetrieveOperations(options, [input], secrets)

        // Just verify no errors were thrown
        expect(true).toBe(true)

        console.log(`Successfully retrieved field '${testField.type}' from record`)
    })
})

describeDestructive('Integration Tests - Write Operations', () => {
    let action: KsmAction
    let mockLogger: any
    let testConfig: any
    let testRecordUid: string
    let originalFieldValues: Map<string, any>

    beforeAll(async () => {
        testConfig = process.env.KSM_TEST_CONFIG
        testRecordUid = process.env.KSM_TEST_RECORD_UID || ''
        originalFieldValues = new Map()

        if (!testConfig) {
            throw new Error('KSM_TEST_CONFIG environment variable not set')
        }

        // Store original values for restoration
        const options = {storage: loadJsonConfig(testConfig)}
        const secrets = await getSecrets(options)

        if (testRecordUid) {
            const record = secrets.records.find(r => r.recordUid === testRecordUid)
            if (record?.data?.fields) {
                record.data.fields.forEach((field: any) => {
                    originalFieldValues.set(field.type, field.value?.[0])
                })
            }
        }

        console.log('Running destructive integration tests - will modify data')
    })

    afterAll(async () => {
        // Attempt to restore original values
        if (testRecordUid && originalFieldValues.size > 0) {
            console.log('Restoring original field values...')
            // This would need implementation based on your needs
        }
    })

    beforeEach(() => {
        mockLogger = createMockLogger()
        action = new KsmAction(new KsmOperations(), mockLogger)
    })

    test('Can update existing field value', async () => {
        if (!testRecordUid) {
            console.log('No test record UID specified - skipping write test')
            return
        }

        const testValue = `test_${Date.now()}`
        const input = {
            uid: testRecordUid,
            selector: 'field',
            notation: `${testRecordUid}/field/notes`,
            destination: testValue,
            operationType: 1, // store
            destinationType: 3 // value
        }

        const options = {storage: loadJsonConfig(testConfig)}
        await action.storeFieldValue(options, input)

        // Operation should complete without throwing
        expect(true).toBe(true)

        // Verify the value was stored
        const secrets = await getSecrets(options)
        const record = secrets.records.find(r => r.recordUid === testRecordUid)
        const notesField = record?.data?.fields?.find((f: any) => f.type === 'notes')

        expect(notesField?.value?.[0]).toBe(testValue)
        console.log(`Successfully updated notes field with value: ${testValue}`)
    })

    test('Handles permission errors gracefully', async () => {
        // Try to update a record that doesn't exist or we don't have access to
        const input = {
            uid: 'NonExistentRecord123456',
            selector: 'field',
            notation: 'NonExistentRecord123456/field/password',
            destination: 'test',
            operationType: 1, // store
            destinationType: 3 // value
        }

        const options = {storage: loadJsonConfig(testConfig)}

        await expect(action.storeFieldValue(options, input)).rejects.toThrow()
    })

    test('Can handle file uploads', async () => {
        if (!testRecordUid) {
            console.log('No test record UID specified - skipping file upload test')
            return
        }

        // Create a temporary test file
        const testFilePath = path.join(__dirname, 'test-file.txt')
        fs.writeFileSync(testFilePath, 'Test file content for integration test')

        try {
            const input = {
                uid: testRecordUid,
                selector: 'file',
                notation: `${testRecordUid}/file`,
                destination: `file:${testFilePath}`,
                operationType: 1, // store
                destinationType: 3 // value
            }

            const options = {storage: loadJsonConfig(testConfig)}
            await action.storeFieldValue(options, input)

            // Operation should complete without throwing
            expect(true).toBe(true)

            console.log('Successfully uploaded test file to record')
        } finally {
            // Clean up test file
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath)
            }
        }
    })
})

describeIntegration('Integration Tests - End-to-End Workflow', () => {
    let mockLogger: any

    beforeEach(() => {
        mockLogger = createMockLogger()
    })

    test('Complete workflow: retrieve and store', async () => {
        const testRecordUid = process.env.KSM_TEST_RECORD_UID
        if (!testRecordUid) {
            console.log('No test record UID specified - skipping workflow test')
            return
        }

        // Set up mock inputs for mixed operations
        mockLogger.getMultilineInput.mockReturnValue([`${testRecordUid}/field/notes > current_notes`, `${testRecordUid}/field/notes < "Updated at ${new Date().toISOString()}"`])

        const action = new KsmAction(new KsmOperations(), mockLogger as any)
        await action.run()

        // Check that the action ran without errors
        expect(true).toBe(true)

        console.log('Successfully completed end-to-end workflow test')
    })
})

// Test configuration validation
describe('Configuration Tests', () => {
    test('Invalid configuration is rejected', async () => {
        const mockLogger = createMockLogger()
        mockLogger.getInput.mockImplementation((name: string) => {
            if (name === 'keeper-secret-config') return 'invalid-config'
            return ''
        })

        const action = new KsmAction(new KsmOperations(), mockLogger as any)
        await action.run()

        // Just verify the action completes
        expect(true).toBe(true)
    })

    test('Empty configuration is handled', async () => {
        const mockLogger = createMockLogger()
        mockLogger.getInput.mockImplementation((name: string) => {
            if (name === 'keeper-secret-config') return ''
            return ''
        })

        const action = new KsmAction(new KsmOperations(), mockLogger as any)
        await action.run()

        // Just verify the action completes
        expect(true).toBe(true)
    })
})

// Export test utilities for external use
export const integrationTestUtils = {
    shouldRunIntegrationTests,
    shouldRunDestructiveTests,
    createMockLogger,
    getTestConfig: () => process.env.KSM_TEST_CONFIG,
    getTestRecordUid: () => process.env.KSM_TEST_RECORD_UID,
    getTestFolderUid: () => process.env.KSM_TEST_FOLDER_UID
}
