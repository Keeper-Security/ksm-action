import {describe, it, expect} from '@jest/globals'
import {
    canModifyFieldType,
    isValidFieldType,
    validateFieldValue,
    checkRecordIntegrity,
    createRecordBackup,
    restoreRecordFromBackup,
    safeUpdateField,
    sanitizeFieldValue,
    validateFieldsArray
} from '../src/safeguards'

describe('Safeguards', () => {
    describe('canModifyFieldType', () => {
        it('should allow modification of standard fields', () => {
            expect(canModifyFieldType('password')).toBe(true)
            expect(canModifyFieldType('login')).toBe(true)
            expect(canModifyFieldType('notes')).toBe(true)
            expect(canModifyFieldType('url')).toBe(true)
        })

        it('should prevent modification of protected fields', () => {
            expect(canModifyFieldType('fileRef')).toBe(false)
            expect(canModifyFieldType('passkey')).toBe(false)
        })
    })

    describe('isValidFieldType', () => {
        it('should recognize standard KSM field types', () => {
            expect(isValidFieldType('password')).toBe(true)
            expect(isValidFieldType('login')).toBe(true)
            expect(isValidFieldType('email')).toBe(true)
            expect(isValidFieldType('phone')).toBe(true)
            expect(isValidFieldType('url')).toBe(true)
            expect(isValidFieldType('notes')).toBe(true)
        })

        it('should reject unknown field types', () => {
            expect(isValidFieldType('customField123')).toBe(false)
            expect(isValidFieldType('unknown')).toBe(false)
        })
    })

    describe('validateFieldValue', () => {
        it('should validate email fields', () => {
            const valid = validateFieldValue('email', 'test@example.com')
            expect(valid.valid).toBe(true)
            expect(valid.errors.length).toBe(0)

            const invalid = validateFieldValue('email', 'not-an-email')
            expect(invalid.valid).toBe(false)
            expect(invalid.errors).toContain('Invalid email format: not-an-email')
        })

        it('should validate URL fields', () => {
            const valid = validateFieldValue('url', 'https://example.com')
            expect(valid.valid).toBe(true)

            const relative = validateFieldValue('url', '/path/to/page')
            expect(relative.valid).toBe(true)
            expect(relative.warnings.length).toBe(0)

            const invalid = validateFieldValue('url', 'not a url at all!')
            expect(invalid.valid).toBe(true) // URLs only generate warnings
            expect(invalid.warnings.length).toBeGreaterThan(0)
        })

        it('should validate phone fields', () => {
            const valid = validateFieldValue('phone', '+1-555-123-4567')
            expect(valid.valid).toBe(true)

            const invalid = validateFieldValue('phone', 'abc123')
            expect(invalid.valid).toBe(true) // Phone only generates warnings
            expect(invalid.warnings.length).toBeGreaterThan(0)
        })

        it('should validate checkbox fields', () => {
            const validTrue = validateFieldValue('checkbox', 'true')
            expect(validTrue.valid).toBe(true)

            const validFalse = validateFieldValue('checkbox', 'false')
            expect(validFalse.valid).toBe(true)

            const invalid = validateFieldValue('checkbox', 'yes')
            expect(invalid.valid).toBe(false)
            expect(invalid.errors).toContain("Checkbox value must be 'true' or 'false', got: yes")
        })

        it('should validate date fields', () => {
            const valid = validateFieldValue('date', '2024-01-15')
            expect(valid.valid).toBe(true)

            const validISO = validateFieldValue('birthDate', '2000-12-31T23:59:59Z')
            expect(validISO.valid).toBe(true)

            const invalid = validateFieldValue('expirationDate', 'not a date')
            expect(invalid.valid).toBe(false)
            expect(invalid.errors[0]).toContain('Invalid date format')
        })

        it('should warn about weak passwords', () => {
            const weak = validateFieldValue('password', '123')
            expect(weak.valid).toBe(true)
            expect(weak.warnings).toContain('Password is less than 8 characters - may not meet security requirements')

            const empty = validateFieldValue('password', '')
            expect(empty.valid).toBe(true)
            expect(empty.warnings).toContain('Setting an empty password may lock you out of the account')
        })

        it('should reject protected field modifications', () => {
            const result = validateFieldValue('fileRef', 'some-value')
            expect(result.valid).toBe(false)
            expect(result.errors).toContain("Field type 'fileRef' is protected and cannot be modified directly")
        })

        it('should reject unknown field types', () => {
            const result = validateFieldValue('nonexistent_field', 'some-value')
            expect(result.valid).toBe(false)
            expect(result.errors).toContain("Field type 'nonexistent_field' is not a recognized KSM field type and cannot be created")
        })

        it('should reject values exceeding maximum length', () => {
            const longValue = 'a'.repeat(10001)
            const result = validateFieldValue('notes', longValue)
            expect(result.valid).toBe(false)
            expect(result.errors).toContain('Value exceeds maximum length of 10000 characters')
        })
    })

    describe('checkRecordIntegrity', () => {
        it('should validate proper record structure', () => {
            const validRecord = {
                recordUid: 'test-uid',
                data: {
                    type: 'login',
                    title: 'Test Record',
                    fields: [
                        {type: 'login', value: ['user']},
                        {type: 'password', value: ['pass']}
                    ],
                    custom: []
                }
            }

            const result = checkRecordIntegrity(validRecord as any)
            expect(result.hasValidStructure).toBe(true)
            expect(result.hasRequiredFields).toBe(true)
            expect(result.missingFields).toEqual([])
            expect(result.invalidFields).toEqual([])
        })

        it('should detect missing required fields', () => {
            const record = {
                recordUid: 'test-uid',
                data: {
                    type: 'login',
                    fields: [
                        {type: 'login', value: ['user']}
                        // Missing password field
                    ]
                }
            }

            const result = checkRecordIntegrity(record as any)
            expect(result.hasRequiredFields).toBe(false)
            expect(result.missingFields).toContain('password')
        })

        it('should detect invalid field structure', () => {
            const record = {
                recordUid: 'test-uid',
                data: {
                    type: 'login',
                    fields: [
                        {type: 'login', value: 'not-an-array'}, // Invalid: value not array
                        {value: ['missing-type']} // Invalid: missing type
                    ]
                }
            }

            const result = checkRecordIntegrity(record as any)
            expect(result.hasValidStructure).toBe(false)
            expect(result.invalidFields.length).toBeGreaterThan(0)
        })

        it('should handle missing data object', () => {
            const record = {recordUid: 'test-uid'}
            const result = checkRecordIntegrity(record as any)
            expect(result.hasValidStructure).toBe(false)
            expect(result.missingFields).toContain('data')
        })
    })

    describe('createRecordBackup and restoreRecordFromBackup', () => {
        it('should create and restore record backup', () => {
            const original = {
                data: {
                    type: 'login',
                    title: 'Original',
                    fields: [
                        {type: 'login', value: ['user1']},
                        {type: 'password', value: ['pass1']}
                    ],
                    custom: [{type: 'custom1', value: ['value1']}]
                }
            }

            // Create backup
            const backup = createRecordBackup(original as any)

            // Modify original
            original.data.fields[0].value = ['user2']
            original.data.fields[1].value = ['pass2']
            original.data.custom[0].value = ['value2']

            // Verify modification
            expect(original.data.fields[0].value).toEqual(['user2'])

            // Restore from backup
            restoreRecordFromBackup(original as any, backup)

            // Verify restoration
            expect(original.data.fields[0].value).toEqual(['user1'])
            expect(original.data.fields[1].value).toEqual(['pass1'])
            expect(original.data.custom[0].value).toEqual(['value1'])
        })

        it('should handle deep copy to prevent reference issues', () => {
            const original = {
                data: {
                    fields: [{type: 'test', value: ['original']}],
                    custom: []
                }
            }

            const backup = createRecordBackup(original as any)

            // Modify backup - should not affect original
            backup.fields[0].value = ['modified']

            expect(original.data.fields[0].value).toEqual(['original'])
        })
    })

    describe('safeUpdateField', () => {
        it('should update existing field', () => {
            const fields = [
                {type: 'login', value: ['old-user']},
                {type: 'password', value: ['old-pass']}
            ]

            const result = safeUpdateField(fields, 'login', 'new-user')
            expect(result.success).toBe(true)
            expect(fields[0].value).toEqual(['new-user'])
        })

        it('should create new field when allowed', () => {
            const fields: any[] = []

            const result = safeUpdateField(fields, 'notes', 'test note', true)
            expect(result.success).toBe(true)
            expect(fields.length).toBe(1)
            expect(fields[0]).toEqual({type: 'notes', value: ['test note']})
        })

        it('should not create new field when not allowed', () => {
            const fields: any[] = []

            const result = safeUpdateField(fields, 'notes', 'test note', false)
            expect(result.success).toBe(false)
            expect(result.error).toContain('does not exist in this record')
            expect(result.error).toContain('does not support adding new fields')
            expect(fields.length).toBe(0)
        })

        it('should reject protected field modifications', () => {
            const fields: any[] = []

            const result = safeUpdateField(fields, 'fileRef', 'value')
            expect(result.success).toBe(false)
            expect(result.error).toContain('Cannot modify protected field type')
        })

        it('should handle invalid fields array', () => {
            const result = safeUpdateField(null as any, 'login', 'value')
            expect(result.success).toBe(false)
            expect(result.error).toContain('Fields array is invalid or undefined')
        })

        it('should fix malformed existing field value', () => {
            const fields = [
                {type: 'login', value: 'not-an-array' as any} // Malformed
            ] as any

            const result = safeUpdateField(fields, 'login', 'new-value')
            expect(result.success).toBe(true)
            expect(fields[0].value).toEqual(['new-value'])
        })

        it('should handle fields with invalid objects', () => {
            const fields = [null, undefined, {type: 'login', value: ['user']}, 'not-an-object']

            const result = safeUpdateField(fields as any, 'login', 'new-user')
            expect(result.success).toBe(true)
            // Check the valid field object at index 2
            const validField = fields[2] as any
            expect(validField?.value).toEqual(['new-user'])
        })
    })

    describe('sanitizeFieldValue', () => {
        it('should handle null and undefined', () => {
            expect(sanitizeFieldValue(null)).toBe('')
            expect(sanitizeFieldValue(undefined)).toBe('')
        })

        it('should handle arrays', () => {
            expect(sanitizeFieldValue(['first', 'second'])).toBe('first')
            expect(sanitizeFieldValue([])).toBe('')
        })

        it('should handle objects', () => {
            expect(sanitizeFieldValue({key: 'value'})).toBe('{"key":"value"}')

            // Circular reference
            const circular: any = {a: 1}
            circular.self = circular
            const result = sanitizeFieldValue(circular)
            expect(typeof result).toBe('string')
        })

        it('should handle primitives', () => {
            expect(sanitizeFieldValue('string')).toBe('string')
            expect(sanitizeFieldValue(123)).toBe('123')
            expect(sanitizeFieldValue(true)).toBe('true')
        })
    })

    describe('validateFieldsArray', () => {
        it('should validate proper fields array', () => {
            const valid = [
                {type: 'login', value: ['user']},
                {type: 'password', value: ['pass']}
            ]
            expect(validateFieldsArray(valid)).toBe(true)
        })

        it('should reject non-array', () => {
            expect(validateFieldsArray(null)).toBe(false)
            expect(validateFieldsArray(undefined)).toBe(false)
            expect(validateFieldsArray({})).toBe(false)
            expect(validateFieldsArray('not-array')).toBe(false)
        })

        it('should reject invalid field objects', () => {
            const invalid = [
                {type: 'login', value: ['user']},
                null, // Invalid
                {type: 'password', value: ['pass']}
            ]
            expect(validateFieldsArray(invalid)).toBe(false)
        })

        it('should reject fields missing type', () => {
            const invalid = [
                {value: ['user']} // Missing type
            ]
            expect(validateFieldsArray(invalid)).toBe(false)
        })

        it('should reject fields with non-array values', () => {
            const invalid = [{type: 'login', value: 'not-array'}]
            expect(validateFieldsArray(invalid)).toBe(false)
        })
    })
})
