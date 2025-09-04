import {describe, it, expect, beforeAll} from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import {KsmAction, KsmOperations} from '../src/main'

// Load environment configuration
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
    require('dotenv').config({path: envPath})
}

const config = process.env.KSM_TEST_CONFIG
const testRecordUid = process.env.KSM_TEST_RECORD_UID

const shouldRunIntegrationTests = (): boolean => {
    return !!(config && testRecordUid)
}

describe('Field Restrictions Integration Tests', () => {
    if (!shouldRunIntegrationTests()) {
        it.skip('Integration tests skipped (no KSM configuration)', () => {})
        return
    }

    describe('Protected Field Restrictions', () => {
        it('should reject modification of fileRef field', async () => {
            const mockLogger = createMockLogger(['A7Pu-DNINF8d14VD5NGETA/field/fileRef < test-value'])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            // Check that the operation failed with the right error
            const hasProtectedError = mockLogger.errors.some((e: string) => e.includes('protected and cannot be modified directly') || e.includes('fileRef'))
            expect(hasProtectedError).toBe(true)
        })

        it('should reject modification of passkey field', async () => {
            const mockLogger = createMockLogger(['A7Pu-DNINF8d14VD5NGETA/field/passkey < test-value'])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            // Check that the operation failed with the right error
            const hasProtectedError = mockLogger.errors.some((e: string) => e.includes('protected and cannot be modified directly') || e.includes('passkey'))
            expect(hasProtectedError).toBe(true)
        })
    })

    describe('New Field Addition Restrictions', () => {
        it('should reject adding a new field that does not exist', async () => {
            const mockLogger = createMockLogger(['A7Pu-DNINF8d14VD5NGETA/field/newCustomField < test-value'])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            const hasNewFieldError = mockLogger.errors.some(
                (e: string) => e.includes('does not exist in this record') || e.includes('does not support adding new fields') || e.includes('not a recognized KSM field type')
            )
            expect(hasNewFieldError).toBe(true)
        })

        it('should reject adding custom fields', async () => {
            const mockLogger = createMockLogger(['A7Pu-DNINF8d14VD5NGETA/field/customFieldThatDoesNotExist < test-value'])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            const hasNewFieldError = mockLogger.errors.some((e: string) => e.includes('does not exist in this record') || e.includes('not a recognized KSM field type'))
            expect(hasNewFieldError).toBe(true)
        })
    })

    describe('Invalid Value Format Handling', () => {
        it('should reject invalid email format', async () => {
            // Try to set an invalid email to a field
            const mockLogger = createMockLogger(['A7Pu-DNINF8d14VD5NGETA/field/email < not-an-email'])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            // Either field doesn't exist or invalid format - both are errors
            const hasError = mockLogger.errors.some((e: string) => e.includes('does not exist') || e.includes('Invalid email format'))
            expect(hasError).toBe(true)
        })

        it('should reject invalid checkbox value', async () => {
            const mockLogger = createMockLogger(['A7Pu-DNINF8d14VD5NGETA/field/checkbox < maybe'])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            // Either field doesn't exist or invalid value - both are errors
            const hasError = mockLogger.errors.some((e: string) => e.includes('does not exist') || e.includes("must be 'true' or 'false'"))
            expect(hasError).toBe(true)
        })

        it('should reject values exceeding maximum length', async () => {
            const longValue = 'a'.repeat(10001)
            const mockLogger = createMockLogger([`A7Pu-DNINF8d14VD5NGETA/field/notes < ${longValue}`])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            const hasLengthError = mockLogger.errors.some((e: string) => e.includes('exceeds maximum length'))
            expect(hasLengthError).toBe(true)
        })
    })

    describe('Valid Field Updates', () => {
        it('should allow updating existing password field', async () => {
            const testPassword = `test-pwd-${Date.now()}`
            const mockLogger = createMockLogger([`A7Pu-DNINF8d14VD5NGETA/field/password < ${testPassword}`])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            expect(mockLogger.infos).toContainEqual(expect.stringContaining('Successfully stored value'))
            expect(mockLogger.failed).toBe(false)
        })

        it('should allow updating existing login field', async () => {
            const testLogin = `test-user-${Date.now()}`
            const mockLogger = createMockLogger([`A7Pu-DNINF8d14VD5NGETA/field/login < ${testLogin}`])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            expect(mockLogger.infos).toContainEqual(expect.stringContaining('Successfully stored value'))
            expect(mockLogger.failed).toBe(false)
        })

        it('should warn about weak passwords but still allow update', async () => {
            const weakPassword = '123'
            const mockLogger = createMockLogger([`A7Pu-DNINF8d14VD5NGETA/field/password < ${weakPassword}`])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            expect(mockLogger.warnings).toContainEqual(expect.stringContaining('less than 8 characters'))
            expect(mockLogger.infos).toContainEqual(expect.stringContaining('Successfully stored value'))
            expect(mockLogger.failed).toBe(false)
        })
    })

    describe('Multiple Operations', () => {
        it('should handle mix of valid and invalid operations', async () => {
            const mockLogger = createMockLogger([
                'A7Pu-DNINF8d14VD5NGETA/field/password < validpass123', // Should succeed
                'A7Pu-DNINF8d14VD5NGETA/field/fileRef < invalid', // Should fail (protected)
                'A7Pu-DNINF8d14VD5NGETA/field/newField < value' // Should fail (doesn't exist)
            ])
            const action = new KsmAction(new KsmOperations(), mockLogger)

            await action.run()

            // Should have at least 1 success
            const successCount = mockLogger.infos.filter((msg: string) => msg.includes('Successfully stored')).length
            expect(successCount).toBeGreaterThanOrEqual(1)

            // Should have errors for protected and non-existent fields
            const hasProtectedError = mockLogger.errors.some((msg: string) => msg.includes('protected'))
            const hasNotExistError = mockLogger.errors.some((msg: string) => msg.includes('does not exist') || msg.includes('not a recognized KSM field type'))

            expect(hasProtectedError).toBe(true)
            expect(hasNotExistError).toBe(true)
        })
    })
})

// Helper function to create mock logger
function createMockLogger(secretInputs: string[]) {
    const infos: string[] = []
    const warnings: string[] = []
    const errors: string[] = []
    let failed = false

    return {
        infos,
        warnings,
        errors,
        failed,
        debug: () => {},
        info: (msg: string) => infos.push(msg),
        warning: (msg: string) => warnings.push(msg),
        error: (msg: string) => errors.push(msg),
        setFailed: (msg: string) => {
            failed = true
            errors.push(msg)
        },
        setOutput: () => {},
        exportVariable: () => {},
        setSecret: () => {},
        getInput: (name: string) => {
            const inputs: Record<string, string> = {
                'keeper-secret-config': config || '',
                'fail-on-store-error': 'true',
                'create-if-missing': 'false',
                'folder-uid': '',
                'new-record-type': 'login',
                'allow-empty-values': 'false'
            }
            return inputs[name] || ''
        },
        getMultilineInput: (name: string) => {
            if (name === 'secrets') {
                return secretInputs
            }
            return []
        },
        getBooleanInput: (name: string) => {
            const booleanInputs: Record<string, boolean> = {
                'fail-on-store-error': true,
                'create-if-missing': false,
                'allow-empty-values': false
            }
            return booleanInputs[name] || false
        },
        // Add missing properties from @actions/core
        addPath: () => {},
        setCommandEcho: () => {},
        isDebug: () => false,
        notice: () => {},
        startGroup: () => {},
        endGroup: () => {},
        group: async (name: string, fn: () => Promise<any>) => await fn(),
        saveState: () => {},
        getState: () => '',
        getIDToken: async () => '',
        summary: {} as any,
        markdownSummary: {} as any,
        toPosixPath: (p: string) => p,
        toWin32Path: (p: string) => p,
        toPlatformPath: (p: string) => p
    } as any
}
