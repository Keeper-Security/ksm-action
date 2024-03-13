import {expect, test} from '@jest/globals'
import {getRecordUids, parseSecretsInputs} from '../src/main'

test('Input parsing OK', () => {
    const parsedInputs = parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username'])
    expect(parsedInputs[0].notation).toBe('BediNKCMG21ztm5xGYgNww/field/login')
    expect(parsedInputs[0].destination).toBe('username')
})

test('Record uid extraction OK', () => {
    const recordUids = getRecordUids(parseSecretsInputs(['BediNKCMG21ztm5xGYgNww/field/login > username', 'BediNKCMG21ztm5xGYgNww/field/password > password']))
    expect(recordUids).toStrictEqual(['BediNKCMG21ztm5xGYgNww'])
})

test('Record title extraction OK', () => {
    const recordUids = getRecordUids(parseSecretsInputs(['My Secret Ttile/field/login > username', 'My Secret Ttile/field/password > password']))
    expect(recordUids).toStrictEqual(['My Secret Ttile'])
})

test('Input and Destination splitting OK', () => {
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

test('Record Title and Destination splitting OK', () => {
    const parsedInputs = parseSecretsInputs([
        `Title w\/ special chars > and delims/field/a b>>ab`,
        `Title w\/ special chars > and delims/field/a b> >ab`,
        `Title w\/ special chars > and delims/field/a b>  >  ab`
    ])

    parsedInputs.forEach((parsedInput, index) => {
        expect(parsedInput.notation).toBe(`Title w\/ special chars > and delims/field/a b>`)
        expect(parsedInput.destination).toBe('ab')
        expect(parsedInput.destinationType).toBe(0)
    })
})

test('Notation prefix and no prefix are OK', () => {
    const parsedInputs = parseSecretsInputs(['keeper://Title1/field/a b > ab', 'Title1/field/a b > ab'])

    parsedInputs.forEach((parsedInput, index) => {
        let notations = ['keeper://Title1/field/a b', 'Title1/field/a b']
        expect(notations).toContain(parsedInput.notation)
        expect(parsedInput.destination).toBe('ab')
        expect(parsedInput.destinationType).toBe(0)
    })
})
