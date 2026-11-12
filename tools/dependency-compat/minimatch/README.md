# minimatch development adapter

This package uses `minimatch@11.0.4` through the `minimatch-modern` alias.
It supplies the interfaces that the installed development tools use.
It does not implement the full API of earlier minimatch versions.
It supplies runtime exports only, not TypeScript type declarations.

## Supported interfaces

- The CommonJS export is callable.
- CommonJS and ES modules expose the same `minimatch` function, `Minimatch` constructor, and `GLOBSTAR` value.
- The modern named runtime exports remain available.
- `defaults()` returns a callable function with a compatible `Minimatch` constructor.
- `Minimatch.set` keeps modern matcher objects, strings, and the modern `GLOBSTAR` value.
- Matcher segments supply `_glob` and `Symbol.match` for legacy `glob@7` scans. They keep their modern type and methods.
- At optimization levels below `2`, brace expansion rows remain separate. This keeps the row indices that legacy glob uses.

## makeRe() limits

`makeRe()` returns a matcher object, not a `RegExp`.
The object supports `test()`, `exec()`, and `Symbol.match` for complete path matches.
For a comment pattern, `makeRe()` returns `false`.

The object does not support `source`, `flags`, string conversion, or use by `new RegExp()`.
It does not support replacement, search, split, or `matchAll` operations.
These operations cause a `TypeError`.
It does not support `RegExp` type checks, captures, or stateful matching.
Installed `eslint-plugin-import` consumers use only `makeRe().test()`.

## Dependency changes

Check the required interfaces when a development dependency changes.
Run `npm ci`, `npm run all`, and the dependency compatibility tests.
Do not add an old pattern compiler to support an additional interface.
This package must remain outside the action runtime bundle.
