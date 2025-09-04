import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import {
    KeeperFile,
    KeeperRecord,
    KeeperSecrets,
    KeeperFileUpload,
    downloadFile,
    getSecrets,
    getValue,
    loadJsonConfig,
    parseNotation,
    updateSecret,
    createSecret,
    uploadFile,
    SecretManagerOptions
} from '@keeper-security/secrets-manager-core'
import {canModifyFieldType, canCreateFieldType, validateFieldValue, checkRecordIntegrity, createRecordBackup, restoreRecordFromBackup, safeUpdateField} from './safeguards'

enum DestinationType {
    output,
    environment,
    file,
    value
}

enum OperationType {
    retrieve,
    store
}

export enum KsmErrorType {
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
    FIELD_NOT_FOUND = 'FIELD_NOT_FOUND',
    NETWORK_ERROR = 'NETWORK_ERROR',
    INVALID_CONFIG = 'INVALID_CONFIG'
}

export class KsmActionError extends Error {
    retryable: boolean

    constructor(
        public type: KsmErrorType,
        message: string,
        public details?: unknown
    ) {
        super(message)
        this.name = 'KsmActionError'
        this.retryable = (details as {retryable?: boolean})?.retryable === true
    }
}

type SecretsInput = {
    uid: string
    selector: string
    notation: string
    destination: string
    destinationType: DestinationType
    operationType: OperationType
}

// Interface for testable KSM operations
export interface IKsmOperations {
    getSecrets(options: SecretManagerOptions, filter?: string[]): Promise<KeeperSecrets>
    updateSecret(options: SecretManagerOptions, record: KeeperRecord): Promise<void>
    createSecret(options: SecretManagerOptions, folderUid: string, recordData: Record<string, unknown>): Promise<string>
    uploadFile(options: SecretManagerOptions, record: KeeperRecord, file: KeeperFileUpload): Promise<string>
    downloadFile(file: KeeperFile): Promise<Uint8Array>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getValue(secrets: KeeperSecrets, notation: string): any
}

// Production implementation
export class KsmOperations implements IKsmOperations {
    async getSecrets(options: SecretManagerOptions, filter?: string[]): Promise<KeeperSecrets> {
        return getSecrets(options, filter)
    }

    async updateSecret(options: SecretManagerOptions, record: KeeperRecord): Promise<void> {
        return updateSecret(options, record)
    }

    async createSecret(options: SecretManagerOptions, folderUid: string, recordData: Record<string, unknown>): Promise<string> {
        return createSecret(options, folderUid, recordData)
    }

    async uploadFile(options: SecretManagerOptions, record: KeeperRecord, file: KeeperFileUpload): Promise<string> {
        return uploadFile(options, record, file)
    }

    async downloadFile(file: KeeperFile): Promise<Uint8Array> {
        return downloadFile(file)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getValue(secrets: KeeperSecrets, notation: string): any {
        return getValue(secrets, notation)
    }
}

const parseInput = (text: string): [string, string, OperationType] => {
    // Check for store operation (<)
    const storeIndex = text.indexOf('<')
    if (storeIndex > 0) {
        const notation = text.substring(0, storeIndex).trim()
        const source = text.substring(storeIndex + 1).trim()
        return [notation, source, OperationType.store]
    }

    // Check for retrieve operation (>)
    const retrieveIndex = text.lastIndexOf('>')
    if (retrieveIndex > 0) {
        const notation = text.substring(0, retrieveIndex).trim()
        const destination = text.substring(retrieveIndex + 1).trim()
        return [notation, destination, OperationType.retrieve]
    }

    // No operator found
    return [text, '', OperationType.retrieve]
}

export const parseSecretsInputs = (inputs: string[]): SecretsInput[] => {
    const results: SecretsInput[] = []

    for (const input of inputs) {
        core.debug(`Processing input: [${input}]`)
        const [notation, destinationOrSource, operationType] = parseInput(input)

        if (!destinationOrSource && operationType === OperationType.retrieve) {
            core.error(`Invalid notation: ${input} - missing > operator`)
            continue
        }

        let [uid, selector] = ['', '']
        try {
            const parsedNotation = parseNotation(notation)
            uid = parsedNotation[1].text ? parsedNotation[1].text[0] : ''
            selector = parsedNotation[2].text ? parsedNotation[2].text[0] : ''
        } catch (error) {
            core.error(`Failed to parse KSM Notation: ${error instanceof Error ? error.message : ''}`)
            continue
        }

        let destinationType: DestinationType = DestinationType.output
        let destination = destinationOrSource

        if (operationType === OperationType.retrieve) {
            // For retrieve operations, determine destination type
            if (destination.startsWith('env:')) {
                destinationType = DestinationType.environment
                destination = destination.slice(4)
            } else if (destination.startsWith('file:')) {
                destinationType = DestinationType.file
                destination = destination.slice(5)
            }
            if (selector === 'file') {
                destinationType = DestinationType.file
            }
        } else {
            // For store operations, destination is the source value
            destinationType = DestinationType.value
        }

        core.debug(`notation=[${notation}], operationType=[${operationType}], destinationType=[${destinationType}], destination=[${destination}], uid=[${uid}]`)

        results.push({
            uid,
            selector,
            notation,
            destination,
            destinationType,
            operationType
        })
    }
    return results
}

export const getRecordUids = (inputs: SecretsInput[]): string[] => {
    const set = new Set<string>()
    for (const input of inputs) {
        set.add(input.uid)
    }
    return Array.from(set)
}

const handleKsmError = (error: unknown, operation: string, notation: string, logger: typeof core = core): void => {
    const errorMessage = (error as Error)?.message || String(error) || 'Unknown error'

    // Try to parse JSON error responses from KSM API
    let errorObj: {error?: string; message?: string} | null = null
    try {
        errorObj = typeof errorMessage === 'string' && errorMessage.startsWith('{') ? JSON.parse(errorMessage) : null
    } catch {
        // Not JSON, continue with string matching
    }

    // Check for permission errors - both JSON and string formats
    const isPermissionError =
        errorObj?.error === 'access_denied' ||
        errorObj?.message?.includes('not editable') ||
        errorMessage.toLowerCase().includes('permission') ||
        errorMessage.toLowerCase().includes('access denied') ||
        errorMessage.toLowerCase().includes('access_denied') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('forbidden') ||
        errorMessage.toLowerCase().includes('not editable')

    if (isPermissionError) {
        logger.error(`❌ Permission Denied: You don't have write access to ${notation}`)
        logger.error(`   KSM application needs edit permissions for the shared folder.`)
        logger.error(`   Contact your Keeper administrator or KSM application owner.`)

        const friendlyMessage = errorObj?.message || errorMessage
        throw new KsmActionError(KsmErrorType.PERMISSION_DENIED, `Permission denied when trying to ${operation} ${notation}. ${friendlyMessage}`, {originalError: errorMessage})
    }

    // Check for sync errors
    const isSyncError =
        errorMessage.toLowerCase().includes('out of sync') ||
        errorMessage.toLowerCase().includes('sync') ||
        errorObj?.error === 'sync_required' ||
        errorObj?.message?.includes('out of sync')

    if (isSyncError) {
        logger.warning(`⚠️ Record out of sync: ${notation}`)
        logger.warning(`   Attempting to refresh and retry...`)
        // Throw a special error type that we can catch and retry
        throw new KsmActionError(KsmErrorType.NETWORK_ERROR, `Record out of sync: ${notation}. Retry needed.`, {originalError: errorMessage, retryable: true})
    }

    // Check for not found errors
    const isNotFoundError = errorObj?.error === 'record_not_found' || errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('does not exist')

    if (isNotFoundError) {
        logger.error(`❌ Record Not Found: ${notation}`)
        logger.error(`   The record or field you're trying to update doesn't exist.`)

        throw new KsmActionError(KsmErrorType.RECORD_NOT_FOUND, `Record or field not found: ${notation}`, {originalError: errorMessage})
    }

    // Generic error
    logger.error(`❌ Failed to ${operation} ${notation}: ${errorMessage}`)
    throw error
}

export class KsmAction {
    constructor(
        private ksmOps: IKsmOperations = new KsmOperations(),
        private logger: typeof core = core
    ) {}

    private resolveSourceValue(source: string): string {
        // Handle different source prefixes
        if (source.startsWith('env:')) {
            // Get from environment variable
            const envVar = source.slice(4)
            return process.env[envVar] || ''
        } else if (source.startsWith('file:')) {
            // Read from file
            const filePath = source.slice(5)
            return fs.readFileSync(filePath, 'utf8')
        } else if (source.startsWith('out:')) {
            // Get from GitHub Actions output
            const outputVar = source.slice(4)
            return this.logger.getInput(outputVar) || ''
        } else {
            // Direct value or GitHub Actions expression (already resolved)
            return source
        }
    }

    private extractFieldType(notation: string): string {
        const parts = notation.split('/')
        return parts[parts.length - 1] || ''
    }

    private enhanceRetrieveError(error: unknown, input: SecretsInput, secrets: KeeperSecrets): Error {
        const errorMessage = (error as Error)?.message || String(error)

        // Check if this is a "field not found" error
        if (errorMessage.includes('not found in the record')) {
            // Find the record to get more context
            const recordToken = input.uid
            const record = secrets.records.find(x => x.recordUid === recordToken || x.data.title === recordToken)

            if (record) {
                const recordType = record.data.type || 'unknown'
                const recordTitle = record.data.title || 'untitled'

                // Get available field types
                const standardFields = record.data.fields?.map((f: {type?: string}) => f.type).filter(Boolean) || []
                const customFields = record.data.custom?.map((f: {type?: string; label?: string}) => f.type || f.label).filter(Boolean) || []

                this.logger.error(`❌ Field not found in ${recordType} record "${recordTitle}" (${recordToken})`)

                if (standardFields.length > 0) {
                    this.logger.error(`   Available standard fields: ${standardFields.join(', ')}`)
                }
                if (customFields.length > 0) {
                    this.logger.error(`   Available custom fields: ${customFields.join(', ')}`)
                }

                // Provide helpful suggestions
                const fieldType = this.extractFieldType(input.notation)
                if (input.selector === 'field' && standardFields.length > 0) {
                    this.logger.error(`   💡 Try: ${recordToken}/field/${standardFields[0]}`)
                } else if (input.selector === 'custom_field' && customFields.length > 0) {
                    this.logger.error(`   💡 Try: ${recordToken}/custom_field/${customFields[0]}`)
                } else if (input.selector === 'field' && customFields.length > 0) {
                    this.logger.error(`   💡 Field "${fieldType}" might be a custom field. Try: ${recordToken}/custom_field/${fieldType}`)
                }

                // Return a clean error message without the repetitive details
                return new Error(`Field not found. See detailed information above.`)
            }
        }

        // Return original error if we couldn't enhance it
        return error as Error
    }

    private updateRecordField(record: KeeperRecord, input: SecretsInput, value: string): void {
        const fieldType = this.extractFieldType(input.notation)

        // Validate field type can be modified
        if (!canModifyFieldType(fieldType)) {
            throw new KsmActionError(
                KsmErrorType.FIELD_NOT_FOUND,
                `Field type '${fieldType}' is protected and cannot be modified directly. Use appropriate methods for this field type.`
            )
        }

        // Validate the value for this field type
        const validation = validateFieldValue(fieldType, value)
        if (!validation.valid) {
            throw new KsmActionError(KsmErrorType.INVALID_CONFIG, `Invalid value for field '${fieldType}': ${validation.errors.join(', ')}`)
        }

        // Log warnings if any
        for (const warning of validation.warnings) {
            this.logger.warning(warning)
        }

        // Get or initialize the fields array
        const fields = input.selector === 'field' ? record.data.fields : record.data.custom

        if (!fields) {
            if (input.selector === 'field') {
                record.data.fields = []
            } else {
                record.data.custom = []
            }
        }

        // Use safe update method
        const targetFields = input.selector === 'field' ? record.data.fields : record.data.custom

        // Allow creation of standard fields like notes, text, etc.
        const allowCreate = canCreateFieldType(fieldType)
        const result = safeUpdateField(targetFields, fieldType, value, allowCreate)

        if (!result.success) {
            throw new KsmActionError(KsmErrorType.FIELD_NOT_FOUND, result.error || `Failed to update field '${fieldType}'`)
        }

        if (result.warning) {
            this.logger.warning(result.warning)
        }

        this.logger.debug(`Successfully updated field: ${fieldType}`)
    }

    async storeFileToRecord(options: SecretManagerOptions, record: KeeperRecord, source: string): Promise<void> {
        const startTime = Date.now()
        this.logger.info(`📁 Starting file upload process...`)

        const filePath = source.startsWith('file:') ? source.slice(5) : source

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`)
        }

        this.logger.debug(`📖 Reading file: ${filePath}`)
        const fileReadStart = Date.now()
        const fileData = fs.readFileSync(filePath)
        const fileName = path.basename(filePath)
        this.logger.debug(`📖 File read completed in ${Date.now() - fileReadStart}ms (size: ${fileData.length} bytes)`)

        const fileUpload: KeeperFileUpload = {
            name: fileName,
            title: fileName,
            type: 'application/octet-stream', // Could be enhanced with mime-type detection
            data: new Uint8Array(fileData)
        }

        try {
            this.logger.info(`🚀 Uploading file to Keeper vault: ${fileName} (${fileData.length} bytes)`)
            const uploadStart = Date.now()

            // Note: File uploads to Keeper can take time due to:
            // 1. Encryption of file data
            // 2. Network upload to Keeper servers
            // 3. Server-side processing and storage
            // 4. Vault synchronization
            const fileUid = await this.ksmOps.uploadFile(options, record, fileUpload)

            const uploadTime = Date.now() - uploadStart
            this.logger.info(`✅ File uploaded successfully: ${fileName} (UID: ${fileUid}) - Upload took ${uploadTime}ms`)
            this.logger.info(`⏱️ Total file operation time: ${Date.now() - startTime}ms`)

            if (uploadTime > 30000) {
                // 30 seconds
                this.logger.warning(
                    `⚠️ File upload took longer than expected (${Math.round(uploadTime / 1000)}s). This may be due to file size, network conditions, or Keeper server processing.`
                )
            }
        } catch (error) {
            handleKsmError(error, 'upload file to', record.recordUid || 'record', this.logger)
            throw error
        }
    }

    async storeFieldValue(options: SecretManagerOptions, input: SecretsInput, retryCount = 0): Promise<void> {
        try {
            const valueToStore = this.resolveSourceValue(input.destination)

            if (!valueToStore && !this.logger.getBooleanInput('allow-empty-values')) {
                this.logger.warning(`Skipping empty value for ${input.notation}`)
                return
            }

            // Retrieve the record with error handling
            let secrets: KeeperSecrets
            try {
                secrets = await this.ksmOps.getSecrets(options, [input.uid])
            } catch (error) {
                handleKsmError(error, 'retrieve', input.notation, this.logger)
                throw error
            }

            if (secrets.records.length === 0) {
                if (this.logger.getBooleanInput('create-if-missing')) {
                    await this.createNewRecord(options, input, valueToStore)
                    return
                }
                throw new KsmActionError(KsmErrorType.RECORD_NOT_FOUND, `Record ${input.uid} not found and create-if-missing is false`)
            }

            const record = secrets.records[0]

            // Check record integrity before modification
            const integrityCheck = checkRecordIntegrity(record)
            if (!integrityCheck.hasValidStructure) {
                this.logger.warning(`⚠️ Record structure issues detected: ${integrityCheck.invalidFields.join(', ')}`)
            }

            // Create backup before modifications
            const backup = createRecordBackup(record)

            try {
                // Handle file upload
                if (input.selector === 'file') {
                    await this.storeFileToRecord(options, record, input.destination)
                    return
                }

                // Update field with safeguards
                this.updateRecordField(record, input, valueToStore)

                // Verify record integrity after modification
                const postUpdateCheck = checkRecordIntegrity(record)
                if (!postUpdateCheck.hasValidStructure) {
                    // Restore from backup if integrity check fails
                    restoreRecordFromBackup(record, backup)
                    throw new KsmActionError(KsmErrorType.INVALID_CONFIG, `Record integrity check failed after modification. Changes reverted.`)
                }

                // Persist changes with error handling
                try {
                    await this.ksmOps.updateSecret(options, record)
                    this.logger.info(`✅ Successfully stored value to ${input.notation}`)
                } catch (error) {
                    // Check if it's a sync error and we can retry
                    const errorMessage = (error as Error)?.message || String(error)
                    const isSyncError = errorMessage.toLowerCase().includes('out of sync')
                    const MAX_RETRIES = 2

                    if (isSyncError && retryCount < MAX_RETRIES) {
                        this.logger.warning(`⚠️ Record out of sync, retrying (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`)
                        // Add exponential backoff
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
                        // Retry the entire operation with fresh data
                        return this.storeFieldValue(options, input, retryCount + 1)
                    }

                    // Restore backup on update failure
                    restoreRecordFromBackup(record, backup)
                    this.logger.error(`Failed to update record, changes reverted`)
                    handleKsmError(error, 'update', input.notation, this.logger)
                    throw error
                }
            } catch (error) {
                // Ensure backup is restored on any error
                if (backup && error instanceof KsmActionError) {
                    restoreRecordFromBackup(record, backup)
                }
                throw error
            }
        } catch (error) {
            // Re-throw KsmActionError, wrap others
            if (error instanceof KsmActionError) {
                throw error
            }
            throw new KsmActionError(KsmErrorType.NETWORK_ERROR, `Unexpected error storing ${input.notation}`, {originalError: error})
        }
    }

    async createNewRecord(options: SecretManagerOptions, input: SecretsInput, value: string): Promise<void> {
        const folderUid = this.logger.getInput('folder-uid')
        if (!folderUid) {
            throw new Error('folder-uid input required when create-if-missing is enabled')
        }

        const fieldType = this.extractFieldType(input.notation)
        const recordType = this.logger.getInput('new-record-type') || 'login'

        const newRecord = {
            title: input.uid,
            type: recordType,
            fields: [
                {
                    type: fieldType,
                    value: [value]
                }
            ]
        }

        try {
            const recordUid = await this.ksmOps.createSecret(options, folderUid, newRecord)
            this.logger.info(`✅ Created new record: ${input.uid} (UID: ${recordUid})`)
        } catch (error) {
            handleKsmError(error, 'create', input.notation, this.logger)
            throw error
        }
    }

    async processRetrieveOperations(options: SecretManagerOptions, inputs: SecretsInput[], secrets: KeeperSecrets): Promise<void> {
        for (const input of inputs) {
            this.logger.debug(`Retrieving secret value using notation [${input.notation}]`)

            let secret: unknown
            try {
                secret = this.ksmOps.getValue(secrets, input.notation)
            } catch (error) {
                const enhancedError = this.enhanceRetrieveError(error, input, secrets)
                throw enhancedError
            }
            this.logger.setSecret(secret as string)

            switch (input.destinationType) {
                case DestinationType.output:
                    this.logger.setOutput(input.destination, secret as string)
                    break
                case DestinationType.environment:
                    this.logger.exportVariable(input.destination, secret as string)
                    break
                case DestinationType.file:
                    if (input.selector === 'file') {
                        const fileData = await this.ksmOps.downloadFile(secret as KeeperFile)
                        fs.writeFileSync(input.destination, fileData)
                    } else {
                        fs.writeFileSync(input.destination, secret as string)
                    }
                    break
            }
        }
    }

    async run(): Promise<void> {
        try {
            const config = this.logger.getInput('keeper-secret-config')

            if (!config) {
                this.logger.error('Configuration string is empty. Looks like secret was not located in your environment. Did you forget include "environment" to the job?')
                this.logger.setFailed('Configuration string is empty')
                return
            }

            const inputs = parseSecretsInputs(this.logger.getMultilineInput('secrets'))
            const options = {storage: loadJsonConfig(config)}

            // Separate operations by type
            const retrieveOps = inputs.filter(i => i.operationType === OperationType.retrieve)
            const storeOps = inputs.filter(i => i.operationType === OperationType.store)

            // Process retrieve operations (existing logic)
            if (retrieveOps.length > 0) {
                this.logger.debug('Retrieving Secrets from KSM...')

                const rxUid = new RegExp('^[A-Za-z0-9_-]{22}$')
                const recordUids = getRecordUids(retrieveOps)
                const hasTitles = recordUids.some(function (e) {
                    return !rxUid.test(e)
                })
                let uidFilter = recordUids && !hasTitles ? recordUids : undefined

                let secrets = await this.ksmOps.getSecrets(options, uidFilter)
                // there's a slight chance a valid title to match a recordUID (22 url-safe base64 chars)
                // or a missing record or record not shared to the KSM App - we need to pull all records
                if (uidFilter && secrets.records.length < recordUids.length) {
                    uidFilter = undefined
                    this.logger.debug(`KSM Didn't get expected num records - requesting all (search by title or missing UID /not shared to the app/)`)
                    secrets = await this.ksmOps.getSecrets(options, uidFilter)
                }
                this.logger.debug(`Retrieved [${secrets.records.length}] secrets`)

                if (secrets.warnings) {
                    // Print warnings if the backend find issues with the requested records
                    for (const warningMessage of secrets.warnings) {
                        this.logger.warning(warningMessage)
                    }
                }

                await this.processRetrieveOperations(options, retrieveOps, secrets)
            }

            // Process store operations (new logic)
            if (storeOps.length > 0) {
                this.logger.info(`📝 Processing ${storeOps.length} store operation(s)...`)

                const results = await Promise.allSettled(storeOps.map(async op => this.storeFieldValue(options, op)))

                // Report results
                const failures = results.filter(r => r.status === 'rejected')
                if (failures.length > 0) {
                    this.logger.error(`❌ ${failures.length} store operation(s) failed`)

                    for (const [index, failure] of failures.entries()) {
                        if (failure.status === 'rejected') {
                            const error = failure.reason
                            if (error instanceof KsmActionError) {
                                if (error.type === KsmErrorType.PERMISSION_DENIED) {
                                    this.logger.error(`Operation ${index + 1}: Permission denied - ${error.message}`)
                                } else {
                                    this.logger.error(`Operation ${index + 1}: ${error.message}`)
                                }
                            } else {
                                this.logger.error(`Operation ${index + 1}: ${error}`)
                            }
                        }
                    }

                    if (this.logger.getBooleanInput('fail-on-store-error')) {
                        this.logger.setFailed(`${failures.length} store operation(s) failed`)
                    }
                } else {
                    this.logger.info(`✅ All store operations completed successfully`)
                }
            }
        } catch (error) {
            let errorMessage = 'Failed processing secrets with Keeper Secrets Manager'
            if (error instanceof KsmActionError) {
                errorMessage = error.message
            } else if (error instanceof Error) {
                errorMessage = error.message
                this.logger.error(error.stack || 'No stack')
            }

            this.logger.setFailed(errorMessage)
        }
    }
}

// Export for testing
export const createRunner = (ksmOps: IKsmOperations = new KsmOperations()): (() => Promise<void>) => {
    const action = new KsmAction(ksmOps, core)
    return async () => action.run()
}

// Default runner
const run = createRunner()

// Run if this is the main module
if (require.main === module) {
    run()
}

export default run
