import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals'
import * as core from '@actions/core'
import {IKsmOperations, KsmAction, parseSecretsInputs} from '../src/main'
import {KeeperRecord, KeeperSecrets, SecretManagerOptions} from '@keeper-security/secrets-manager-core'

const VALUE = 'SYNTHETIC_STORE_VALUE'
const RECORD_UID = 'AAAAAAAAAAAAAAAAAAAAAA'
const CONFIG_ERROR = 'Keeper configuration is invalid. Check keeper-secret-config.'
const CONFIG_FIELDS = [
    {key: 'clientKey', marker: 'SYNTHETIC_CLIENT_KEY_MARKER_12345'},
    {key: 'privateKey', marker: 'SYNTHETIC_PRIVATE_KEY_MARKER_67890'}
]

describe('Input logging', () => {
    let messages: string[]

    beforeEach(() => {
        messages = []
        for (const method of ['debug', 'info', 'warning', 'error', 'setFailed'] as const) {
            jest.spyOn(core, method).mockImplementation(message => {
                messages.push(String(message))
            })
        }
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    function createMockOperations(): jest.Mocked<IKsmOperations> {
        const secrets: KeeperSecrets = {
            appData: {title: 'Synthetic application', type: 'secrets-manager'},
            records: [
                {
                    recordUid: RECORD_UID,
                    revision: 1,
                    data: {
                        title: 'Synthetic record',
                        type: 'login',
                        fields: [{type: 'password', value: [VALUE]}]
                    }
                }
            ]
        }
        return {
            getSecrets: jest.fn<IKsmOperations['getSecrets']>().mockResolvedValue(secrets),
            updateSecret: jest.fn<IKsmOperations['updateSecret']>().mockResolvedValue(undefined),
            createSecret: jest.fn<IKsmOperations['createSecret']>().mockResolvedValue(RECORD_UID),
            uploadFile: jest.fn<IKsmOperations['uploadFile']>().mockResolvedValue('BBBBBBBBBBBBBBBBBBBBBB'),
            downloadFile: jest.fn<IKsmOperations['downloadFile']>().mockResolvedValue(new Uint8Array()),
            getValue: jest.fn<IKsmOperations['getValue']>().mockReturnValue(VALUE)
        }
    }

    function configureRun(config: string): void {
        jest.spyOn(core, 'getInput').mockImplementation(name => (name === 'keeper-secret-config' ? config : ''))
        jest.spyOn(core, 'getMultilineInput').mockReturnValue([`${RECORD_UID}/field/password > CONFIG_FIXTURE_OUTPUT`])
        jest.spyOn(core, 'getBooleanInput').mockReturnValue(false)
        jest.spyOn(core, 'setSecret').mockImplementation(() => undefined)
        jest.spyOn(core, 'setOutput').mockImplementation(() => undefined)
    }

    test.each(CONFIG_FIELDS.flatMap(field => ['JSON', 'base64'].map(representation => ({...field, representation}))))(
        'reports invalid $key configuration in $representation form without input values',
        async ({key, marker, representation}) => {
            const json = `{"${key}":${marker}}`
            const config = representation === 'base64' ? Buffer.from(json).toString('base64') : json
            configureRun(config)
            const operations = createMockOperations()
            await new KsmAction(operations, core).run()
            expect(core.setFailed).toHaveBeenCalledTimes(1)
            expect(core.setFailed).toHaveBeenCalledWith(CONFIG_ERROR)
            expect(core.error).not.toHaveBeenCalled()
            for (const message of messages) {
                expect(message).not.toContain(marker)
                expect(message).not.toContain(config)
                for (let offset = 0; offset <= marker.length - 10; offset++) {
                    expect(message).not.toContain(marker.slice(offset, offset + 10))
                }
            }
            for (const operation of Object.values(operations)) {
                expect(operation).not.toHaveBeenCalled()
            }
        }
    )

    test.each(['JSON', 'base64'])('keeps valid configuration storage unchanged in %s form', async representation => {
        const values = Object.fromEntries(CONFIG_FIELDS.map(({key, marker}) => [key, Buffer.from(marker).toString('base64')]))
        const json = JSON.stringify(values)
        const config = representation === 'base64' ? Buffer.from(json).toString('base64') : json
        configureRun(config)
        const operations = createMockOperations()
        await new KsmAction(operations, core).run()
        expect(core.setFailed).not.toHaveBeenCalled()
        expect(core.error).not.toHaveBeenCalled()
        expect(operations.getSecrets).toHaveBeenCalledTimes(1)
        const {storage} = operations.getSecrets.mock.calls[0][0]
        for (const {key, marker} of CONFIG_FIELDS) {
            await expect(storage.getString(key)).resolves.toBe(values[key])
            const bytes = await storage.getBytes(key)
            expect(bytes).toBeDefined()
            expect(Array.from(bytes ?? [])).toEqual(Array.from(Buffer.from(marker)))
            expect(messages.every(message => !message.includes(marker) && !message.includes(values[key]))).toBe(true)
        }
    })

    test('keeps operation error handling separate from configuration parsing', async () => {
        configureRun('{"fixture":"synthetic"}')
        const operations = createMockOperations()
        const failure = new Error('Synthetic operation failure')
        operations.getSecrets.mockRejectedValue(failure)
        await new KsmAction(operations, core).run()
        expect(core.setFailed).toHaveBeenCalledWith(failure.message)
        expect(core.error).toHaveBeenCalledWith(failure.stack || 'No stack')
        expect(operations.getValue).not.toHaveBeenCalled()
    })

    test.each([
        {name: 'literal values', input: `${RECORD_UID}/field/password < ${VALUE}`},
        {name: 'quoted values', input: `${RECORD_UID}/field/password < "${VALUE}"`},
        {name: 'values with selectors', input: `${RECORD_UID}/field/notes < ${VALUE}/field/notes`},
        {name: 'invalid selectors', input: `${RECORD_UID}/unsupported/password < ${VALUE}`},
        {name: 'invalid indexes', input: `${RECORD_UID}/field/password[${VALUE} < other-value`},
        {name: 'missing operators', input: VALUE}
    ])('does not log $name during parsing', ({input}) => {
        parseSecretsInputs([input])
        expect(messages.every(message => !message.includes(VALUE))).toBe(true)
    })

    test('keeps valid literal values unchanged', () => {
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/password < "${VALUE}"`])
        expect(inputs).toHaveLength(1)
        expect(inputs[0].destination).toBe(VALUE)
        expect(inputs[0].operationType).toBe(1)
        expect(messages.every(message => !message.includes(VALUE))).toBe(true)
    })

    test('keeps selectors and operators inside a literal store value', () => {
        const value = `${VALUE}/field/notes > output-name < extra-value`
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/password < ${value}`])
        expect(inputs).toHaveLength(1)
        expect(inputs[0].notation).toBe(`${RECORD_UID}/field/password`)
        expect(inputs[0].destination).toBe(value)
        expect(inputs[0].operationType).toBe(1)
        expect(messages.every(message => !message.includes(VALUE))).toBe(true)
    })

    test('keeps a retrieve line whose file destination contains a selector and an operator', () => {
        const destination = 'dir/field/login<copy.txt'
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/password > file:${destination}`])
        expect(inputs).toHaveLength(1)
        expect(inputs[0].notation).toBe(`${RECORD_UID}/field/password`)
        expect(inputs[0].destination).toBe(destination)
        expect(inputs[0].operationType).toBe(0)
        expect(inputs[0].destinationType).toBe(2)
    })

    test('keeps a file source path that contains a selector', () => {
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/notes < file:data/field/notes.txt`])
        expect(inputs).toHaveLength(1)
        expect(inputs[0].notation).toBe(`${RECORD_UID}/field/notes`)
        expect(inputs[0].destination).toBe('file:data/field/notes.txt')
        expect(inputs[0].operationType).toBe(1)
    })

    test('reports the entry number when a line has no operator', () => {
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/login > a`, `${RECORD_UID}/field/password > b`, `${RECORD_UID}/field/notes`])
        expect(inputs).toHaveLength(2)
        expect(messages).toContain('secrets entry 3: Invalid notation: missing > operator')
    })

    test('reports the entry number and the reason when a notation is invalid, without the input text', () => {
        const sentinel = 'SENTINEL-7f3a'
        const inputs = parseSecretsInputs([`${RECORD_UID}/field/login > a`, `${sentinel}/bogus > OUT`])
        expect(inputs).toHaveLength(1)
        const error = messages.find(message => message.startsWith('secrets entry 2:'))
        expect(error).toContain('bad selector')
        expect(messages.every(message => !message.includes(sentinel))).toBe(true)
    })

    test('masks a store value before record operations', async () => {
        const events: string[] = []
        const record: KeeperRecord = {
            recordUid: RECORD_UID,
            revision: 1,
            data: {
                title: 'Synthetic record',
                type: 'login',
                fields: [{type: 'password', value: ['synthetic-original-value']}]
            }
        }
        const secrets: KeeperSecrets = {
            appData: {title: 'Synthetic application', type: 'secrets-manager'},
            records: [record]
        }
        const operations: IKsmOperations = {
            async getSecrets(): Promise<KeeperSecrets> {
                events.push('getSecrets')
                return secrets
            },
            async updateSecret(): Promise<void> {
                events.push('updateSecret')
            },
            async createSecret(): Promise<string> {
                return RECORD_UID
            },
            async uploadFile(): Promise<string> {
                return 'BBBBBBBBBBBBBBBBBBBBBB'
            },
            async downloadFile(): Promise<Uint8Array> {
                return new Uint8Array()
            },
            getValue(): string {
                return ''
            }
        }
        const mask = jest.spyOn(core, 'setSecret').mockImplementation(() => {
            events.push('setSecret')
        })
        jest.spyOn(core, 'getBooleanInput').mockReturnValue(false)

        const inputs = parseSecretsInputs([`${RECORD_UID}/field/password < ${VALUE}`])
        const action = new KsmAction(operations, core)
        await action.storeFieldValue({} as SecretManagerOptions, inputs[0])

        expect(mask).toHaveBeenCalledWith(VALUE)
        expect(events).toEqual(['setSecret', 'getSecrets', 'updateSecret'])
        expect(record.data.fields[0].value).toEqual([VALUE])
        expect(messages.every(message => !message.includes(VALUE))).toBe(true)
    })
})
