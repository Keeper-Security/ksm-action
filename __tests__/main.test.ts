import {expect, test} from '@jest/globals'
import {getRecordUids, parseSecretsInputs} from '../src/main'

test('Input parsing Ok', () => {
    const parsedInputs = parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username'])
    expect(parsedInputs[0].notation).toBe('BediNKCMG21ztm5xGYgNww/field/login')
    expect(parsedInputs[0].destination).toBe('username')
})

test('Record uid extraction Ok', () => {
    const recordUids = getRecordUids(parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username', 'BediNKCMG21ztm5xGYgNww/field/password > password']))
    expect(recordUids).toStrictEqual(['BediNKCMG21ztm5xGYgNww'])
})
