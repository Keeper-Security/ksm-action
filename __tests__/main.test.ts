import {expect, test} from '@jest/globals'
import {parseSecretsInputs} from '../src/main'

test('Input parsing Ok', () => {
    const parsedInputs = parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username'])
    expect(parsedInputs[0].notation).toBe('BediNKCMG21ztm5xGYgNww/field/login')
    expect(parsedInputs[0].destination).toBe('username')
})

test('Input and Destination Splitting Ok', () => {
    const parsedInputs = parseSecretsInputs([
        'BediNKCMG21ztm5xGYgNww/field/a b>ab',
        'BediNKCMG21ztm5xGYgNww/field/a b >ab',
        'BediNKCMG21ztm5xGYgNww/field/a b > ab',
        'BediNKCMG21ztm5xGYgNww/field/a b   >ab',
        'BediNKCMG21ztm5xGYgNww/field/a b>   ab',
        'BediNKCMG21ztm5xGYgNww/field/a b   >   ab'
    ])

    parsedInputs.forEach((parsedInput, index) => {
        expect(parsedInput.notation).toBe('BediNKCMG21ztm5xGYgNww/field/a b')
        expect(parsedInput.destination).toBe('ab')
        expect(parsedInput.destinationType).toBe(0)
    })
})
