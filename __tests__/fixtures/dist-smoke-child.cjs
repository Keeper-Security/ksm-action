'use strict'
// Runs the shipped bundle with mock Keeper operations and prints the results as JSON.
// The network guard loads first, so the bundle cannot reach a server.
const guard = require('./network-guard.cjs')
const path = require('path')

const bundle = require(path.resolve(process.argv[2]))

const RESULT_PREFIX = 'DIST_SMOKE_RESULT '
const RECORD_UID = 'AAAAAAAAAAAAAAAAAAAAAA'
const FILE_UID = 'BBBBBBBBBBBBBBBBBBBBBB'
const ATTACHMENT = [0, 255, 1, 128, 10, 13, 42]
const FAKE_CONFIG = Buffer.from(
    JSON.stringify({
        hostname: 'invalid.example',
        clientId: 'c3ludGhldGljLWNsaWVudA==',
        privateKey: 'c3ludGhldGljLWtleQ==',
        appKey: 'c3ludGhldGljLWFwcA=='
    })
).toString('base64')

const SCENARIOS = {
    output: [`${RECORD_UID}/field/password > PASSWORD`],
    environment: [`${RECORD_UID}/field/login > env:SMOKE_LOGIN`],
    relativeFile: [`${RECORD_UID}/field/password > file:password.txt`],
    attachment: [`${RECORD_UID}/file/fixture.bin > file:attachment.bin`],
    store: [`${RECORD_UID}/field/login < synthetic-updated-login`]
}

function createRecord() {
    return {
        recordUid: RECORD_UID,
        revision: 1,
        data: {
            title: 'Synthetic record',
            type: 'login',
            fields: [
                {type: 'login', value: ['synthetic-login']},
                {type: 'password', value: ['synthetic-password']}
            ],
            custom: []
        },
        files: [{fileUid: FILE_UID, data: {name: 'fixture.bin', title: 'fixture.bin'}}]
    }
}

function createOperations(calls) {
    const record = createRecord()
    const bundled = new bundle.KsmOperations()
    return {
        async getSecrets(options, filter) {
            calls.push({
                method: 'getSecrets',
                filter: filter === undefined ? null : filter,
                optionKeys: Object.keys(options).sort(),
                hostname: (await options.storage.getString('hostname')) || null
            })
            return {appData: {title: 'Synthetic application', type: 'secrets-manager'}, records: [record]}
        },
        async updateSecret(options, changed) {
            calls.push({method: 'updateSecret', optionKeys: Object.keys(options).sort(), record: JSON.parse(JSON.stringify(changed))})
        },
        async createSecret() {
            calls.push({method: 'createSecret'})
            return 'CCCCCCCCCCCCCCCCCCCCCC'
        },
        async uploadFile() {
            calls.push({method: 'uploadFile'})
            return FILE_UID
        },
        async downloadFile(...args) {
            calls.push({method: 'downloadFile', argumentCount: args.length, fileUid: args[0] ? args[0].fileUid : null})
            return new Uint8Array(ATTACHMENT)
        },
        getValue(secrets, notation) {
            return bundled.getValue(secrets, notation)
        }
    }
}

function createLogger(lines, result) {
    return {
        getInput: name => (name === 'keeper-secret-config' ? FAKE_CONFIG : ''),
        getMultilineInput: () => lines,
        getBooleanInput: name => name === 'fail-on-store-error',
        setSecret: value => result.masked.push(value),
        setOutput: (name, value) => {
            result.outputs[name] = value
        },
        exportVariable: (name, value) => {
            result.environment[name] = value
        },
        setFailed: message => result.failed.push(String(message)),
        error: message => result.errors.push(String(message)),
        warning: message => result.warnings.push(String(message)),
        info: () => undefined,
        debug: () => undefined
    }
}

async function main() {
    // A fixed umask makes the mode of new files predictable.
    process.umask(0o022)
    const results = {exports: Object.keys(bundle).sort(), scenarios: {}, blocked: []}
    for (const [name, lines] of Object.entries(SCENARIOS)) {
        const result = {calls: [], outputs: {}, environment: {}, masked: [], failed: [], errors: [], warnings: []}
        await new bundle.KsmAction(createOperations(result.calls), createLogger(lines, result)).run()
        results.scenarios[name] = result
    }
    results.blocked = guard.attempts.slice()
    process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(results)}\n`)
}

main().catch(error => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`)
    process.exitCode = 1
})
