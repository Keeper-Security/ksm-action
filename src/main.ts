import * as core from '@actions/core'
import {wait} from './wait'

async function run(): Promise<void> {
    try {
        const ms: string = core.getInput('milliseconds')
        core.debug(`Waiting ${ms} milliseconds ...`) // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

        core.debug(new Date().toTimeString())
        await wait(parseInt(ms, 10))
        core.debug(new Date().toTimeString())

        core.debug(JSON.stringify(core.getMultilineInput('secrets')))

        core.setOutput('time', new Date().toTimeString())
        core.setOutput('secret1', 'abcd')
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
