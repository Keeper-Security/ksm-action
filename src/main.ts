import * as core from '@actions/core'
import * as fs from 'fs'
import {KeeperFile, downloadFile, getSecrets, getValue, loadJsonConfig} from '@keeper-security/secrets-manager-core'

enum DestinationType {
    output,
    environment,
    file
}

type SecretsInput = {
    notation: string
    destination: string
    destinationType: DestinationType
}

export const parseSecretsInputs = (inputs: string[]): SecretsInput[] => {
    const results: SecretsInput[] = []

    for (const input of inputs) {
        core.debug(`inputParts=[${input}]`)
        const inputParts = input.split(/\s*>\s*/)
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
        if (inputParts[0].split('/')[1] === 'file') {
            destinationType = DestinationType.file
        }

        core.debug(`notation=[${inputParts[0]}], destinationType=[${destinationType}], destination=[${destination}]`)

        results.push({
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
        set.add(input.notation.split('/')[0])
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
        const secrets = await getSecrets(options, getRecordUids(inputs))
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
