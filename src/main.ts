import * as core from '@actions/core'
import * as fs from 'fs'
import {downloadFile, getSecrets, getValue, KeeperFile, loadJsonConfig} from '@keeper-security/secrets-manager-core'

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
        const inputParts = input.replace(/\s/g, '').split('>')
        let destinationType: DestinationType = DestinationType.output
        let destination = inputParts[1]
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
        core.debug(config)
        const inputs = parseSecretsInputs(core.getMultilineInput('secrets'))
        const secrets = await getSecrets({storage: loadJsonConfig(config)}, getRecordUids(inputs))
        for (const input of inputs) {
            const secret = getValue(secrets, input.notation)
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
        core.setFailed(error.message)
    }
}

run()
