import * as core from '@actions/core'
import * as fs from 'fs'
import {KeeperFile, downloadFile, getSecrets, getValue, loadJsonConfig, parseNotation} from '@keeper-security/secrets-manager-core'

enum DestinationType {
    output,
    environment,
    file
}

type SecretsInput = {
    uid: string
    selector: string
    notation: string
    destination: string
    destinationType: DestinationType
}

const splitInput = (text: string): string[] => {
    const n = text.lastIndexOf('>')
    if (n < 0) return [text, '']
    const notation = text.substring(0, n)
    const destination = text.substring(n + 1)
    return [notation.trimEnd(), destination.trimStart()]
}

export const parseSecretsInputs = (inputs: string[]): SecretsInput[] => {
    const results: SecretsInput[] = []

    for (const input of inputs) {
        core.debug(`inputParts=[${input}]`)
        const inputParts = splitInput(input)
        let [uid, selector] = ['', '']
        try {
            const notation = parseNotation(inputParts[0])
            uid = notation[1].text ? notation[1].text[0] : ''
            selector = notation[2].text ? notation[2].text[0] : ''
        } catch (error) {
            core.error(`Failed to parse KSM Notation: ${error instanceof Error ? error.message : ''}`)
        }
        let destinationType: DestinationType = DestinationType.output
        let destination = inputParts[1]
        core.debug(`destination=[${destination}]`)
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

        core.debug(`notation=[${inputParts[0]}], destinationType=[${destinationType}], destination=[${destination}], secret=[${uid}]`)

        results.push({
            uid,
            selector,
            notation: inputParts[0],
            destination,
            destinationType
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

const downloadSecretFile = async (file: KeeperFile, destination: string): Promise<void> => {
    const fileData = await downloadFile(file)
    fs.writeFileSync(destination, fileData)
}

const run = async (): Promise<void> => {
    try {
        const config = core.getInput('keeper-secret-config')

        if (!config) {
            core.error('Configuration string is empty. Looks like secret was not located in your environment. Did you forget include "environment" to the job?')
            core.setFailed('Configuration string is empty')
            return
        }

        const inputs = parseSecretsInputs(core.getMultilineInput('secrets'))

        core.debug('Retrieving Secrets from KSM...')
        const options = {storage: loadJsonConfig(config)}

        const rxUid = new RegExp('^[A-Za-z0-9_-]{22}$')
        const recordUids = getRecordUids(inputs)
        const hasTitles = recordUids.some(function (e) {
            return !rxUid.test(e)
        })
        let uidFilter = recordUids && !hasTitles ? recordUids : undefined

        let secrets = await getSecrets(options, uidFilter)
        // there's a slight chance a valid title to match a recordUID (22 url-safe base64 chars)
        // or a missing record or record not shared to the KSM App - we need to pull all records
        if (uidFilter && secrets.records.length < recordUids.length) {
            uidFilter = undefined
            core.debug(`KSM Didn't get expected num records - requesting all (search by title or missing UID /not shared to the app/)`)
            secrets = await getSecrets(options, uidFilter)
        }
        core.debug(`Retrieved [${secrets.records.length}] secrets`)

        if (secrets.warnings) {
            // Print warnings if the backend find issues with the requested records
            for (const warningMessage of secrets.warnings) {
                core.warning(warningMessage)
            }
        }

        for (const input of inputs) {
            core.debug(`Retrieving secret value using notation [${input.notation}]`)

            const secret = getValue(secrets, input.notation)
            core.setSecret(secret)
            switch (input.destinationType) {
                case DestinationType.output:
                    core.setOutput(input.destination, secret)
                    break
                case DestinationType.environment:
                    core.exportVariable(input.destination, secret)
                    break
                case DestinationType.file:
                    await downloadSecretFile(secret as KeeperFile, input.destination)
                    break
            }
        }
    } catch (error) {
        let errorMessage = 'Failed getting secrets from Keeper Secrets Manager'
        if (error instanceof Error) {
            errorMessage = error.message
            core.error(error.stack || 'No stack')
        }

        core.setFailed(errorMessage)
    }
}

run()
