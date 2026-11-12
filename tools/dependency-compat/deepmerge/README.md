# deepmerge development adapter

This package uses `@fastify/deepmerge@3.2.4` with enumerable symbol support.
It supplies the default merge calls that Jest uses.
It does not implement the full `deepmerge@4` API.

## Supported interfaces

- `deepmerge(target, source)` uses the merge rules of `@fastify/deepmerge`.
- `deepmerge.all(values)` merges an array of values from left to right.
- Nested objects and arrays are copied. Arrays are combined.
- Enumerable symbol keys are included. Inherited keys are excluded.
- Date and RegExp values use the rules of `@fastify/deepmerge`. These values are not copied.

The optional options argument must be absent or an empty plain object.
Other options cause a `TypeError`.
Custom array merges, custom object merges, custom object tests, and clone switches are not supported.

## Dependency changes

Check Jest configuration merges when a development dependency changes.
Run `npm ci`, `npm run all`, and the dependency compatibility tests.
This package must remain outside the action runtime bundle.
