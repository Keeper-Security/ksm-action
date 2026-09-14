# Changelog

All notable changes to this project will be documented in this file.

## [1.3.2] - 2026-09-10

### Added
- New optional `max-throttle-wait-seconds` input (default: `60`). `secrets-manager-core` 17.5.0's
  backend-throttle retry has no ceiling on the server-supplied wait, and its counter is shared per
  Keeper Application client ID across every job using it, so concurrent workflow runs (a matrix
  build, several parallel jobs) can collide on the same throttle window. Before this input, that
  collision meant every affected job blocked silently, potentially for minutes, until either the
  retry succeeded or the runner's own `timeout-minutes` killed the job with a generic timeout
  message unrelated to Keeper. With this input (bounded by default, no opt-in required), a wait
  that exceeds the cap fails immediately with a clear `THROTTLE_EXCEEDED` message naming the
  requested wait and the configured cap. Raise the value to allow the SDK's full backoff schedule
  (up to ~176s on its last of 5 attempts) to run instead of failing fast.

### Changed
- Moved `@actions/core` and `@keeper-security/secrets-manager-core` from `devDependencies` to a
  new `dependencies` section. Both are bundled into the shipped `dist/index.js`; leaving them under
  `devDependencies` (this repo's prior convention for every dependency, bundled or not) skews
  SCA/license-scan tooling that reads `package.json` for what actually ships. Matches the
  convention in GitHub's own `actions/typescript-action` template, which separates bundled runtime
  packages from build/lint/test-only tooling the same way.
- `@keeper-security/secrets-manager-core` 17.4.0 → 17.5.0. This is the only bumped dependency that
  ships in `dist/index.js`; every other dependency below is build/lint/test-only. Relevant upstream
  changes for this action's call surface (`getSecrets`, `getValue`, `loadJsonConfig`,
  `parseNotation`, `updateSecret`, `createSecret`, `uploadFile`, `downloadFile`): stale-pinned-key
  errors now propagate to the caller instead of being swallowed; `null`/`undefined` config values
  now throw a typed, named error instead of a cryptic native `TypeError`; folder/record entries
  missing their decryption key now throw a clearer message inside the same existing per-record
  skip handling, no new failure path. The isolated-deployment custom-server-key feature this
  release adds is not exposed through any `ksm-action` input, so it has no effect here.
- `eslint-plugin-github` 4.10.2 → 6.1.2 and `@typescript-eslint/parser` 7.18.0 → 8.68.0 (bumped
  together: v6 of `eslint-plugin-github` is what pulls its own `@typescript-eslint/eslint-plugin`
  dependency to a matching v8, so the two must land in the same release or lint runs with a
  mismatched parser/plugin major version).
- `eslint-plugin-jest` 28.14.0 → 29.16.5; `jest` 30.4.2 → 30.5.0.
- Added `globals` as a direct devDependency (was only present transitively); the new flat ESLint
  config imports it directly for the `node`/`jest` global sets that `env` used to provide.
- Resolves a pre-existing high-severity transitive `js-yaml` vulnerability (GHSA-2883-xcg3-v3hh,
  unbounded-CPU `maxTotalMergeKeys`) as a side effect of the above: `npm audit` goes from 1 high to
  0. `js-yaml` is dev/test-only here (istanbul's config loader), never bundled.

### Fixed
- Migrated `.eslintrc.json` to flat config (`eslint.config.mjs`). `eslint-plugin-github@6.1.2`
  publishes as an ESM module whose CommonJS interop only exposes `default`/`__esModule` at the top
  level; ESLint 8's legacy `.eslintrc` loader reads `configs` directly off the required module and
  can no longer find it, so `plugin:github/recommended` fails to resolve and `npm run lint` (and
  therefore CI) would not run at all on the old config format. The package's own README still
  documents legacy `.eslintrc` usage; that path does not actually work under this export shape.
- Removed `@typescript-eslint/func-call-spacing`, `@typescript-eslint/semi`, and
  `@typescript-eslint/type-annotation-spacing` from the lint rules: typescript-eslint v8 dropped
  all three. They were pure formatting rules already fully covered by this repo's existing
  Prettier config (`semi: false` and the rest), which runs as its own separate `npm run format`
  step, so nothing that was enforced before is unenforced now.
- Pinned `@typescript-eslint/array-type` to its pre-existing effective behavior
  (`{default: 'array'}`) in the new config. `eslint-plugin-github`'s own v6 typescript preset
  sets this rule to `array-simple` (`Array<T>` required for non-primitive element types); left
  unpinned, that would have newly failed 6 existing, unrelated lines in `src/main.ts` and
  `src/safeguards.ts` that use `{...}[]`. Pinning restores prior behavior so this dependency-bump
  release does not also carry an unrelated formatting-driven source diff.
- Removed the unused `SENSITIVE_FIELD_TYPES` constant in `src/safeguards.ts`. It was dead on
  master already; the new preset's `@typescript-eslint/no-unused-vars` (not enabled by the old
  config) is what caught it.

### Verification
- `npm run all` (build, format, lint, package, test) passes: 128/128 tests, 0 lint errors,
  clean TypeScript build, `dist/` rebuild is byte-identical across repeated runs from the same
  lockfile. `npm audit`: 0 vulnerabilities.

## [1.3.1] - 2026-08-10

### Security
- Resolved all 20 Dependabot alerts (14 distinct advisories) via dependency updates: 15 open, plus
  5 alerts (3 advisories) that GitHub auto-triage had dismissed on the misleading "development"
  scope label (this repo bundles its runtime dependencies into `dist/`, so scope says nothing
  about what ships). No `package.json` range changes were required; every patched version was
  already in range:
  - `undici` 6.24.1 → 6.28.0 (CVE-2026-16729, CVE-2026-15157, CVE-2026-16728, CVE-2026-9679,
    CVE-2026-11525, CVE-2026-6733, and auto-dismissed CVE-2026-12151, high)
  - `js-yaml` 4.1.1 → 4.3.1 and 3.14.2 → 3.15.1 (CVE-2026-59869, CVE-2026-53550, GHSA-5p4m-2wfm-xmqj)
  - `brace-expansion` 2.0.3 → 2.1.4 and 1.1.13 → 1.1.18 (CVE-2026-13149, and auto-dismissed
    CVE-2026-14257 and CVE-2026-69152, both high)
  - `@babel/core` 7.24.0 → 7.29.7 (CVE-2026-49356)
- Rebuilt `dist/index.js` so the patched `undici` — the only advisory-affected package that is
  inlined into the shipped bundle — actually ships. Every other update is build/test-only.
- No functional change. `npm audit` reports 0 vulnerabilities; all 123 tests pass.

### Removed
- Dropped `js-yaml` as a direct `devDependency` — it was declared but never imported anywhere in
  `src/` or `__tests__/`. (It remains in the tree transitively via `eslint` and jest's istanbul
  chain, now at patched 4.3.1 / 3.15.1.)

### Changed
- `prettier` 3.8.1 → 3.9.6 (no source reformatting resulted).
- `@types/node` deliberately held at 24.x rather than 26.x to stay aligned with the `node24`
  action runtime.

## [1.3.0] - 2026-03-27

### Added
- **Store functionality**: New `<` operator to store values to Keeper Secrets Manager
  - Syntax: `RecordUID/field/fieldname < value`
  - Supports environment variables: `< env:MY_PASSWORD`
  - Supports file content: `< file:path/to/file.txt`
  - Supports quoted values to preserve whitespace: `< "value with spaces  "`
- **File upload support**: Upload files to records using `RecordUID/file < file:path/to/file`
- **Create records on demand**: `create-if-missing` input with `folder-uid` and `new-record-type`
- **Comprehensive safeguards**:
  - Protected field types (fileRef, passkey, recordRef) cannot be modified
  - Field value validation (email, URL, phone, date, checkbox, pinCode)
  - Record integrity checks with automatic backup/restore on failure
- **Retry mechanism**: Automatic retry with exponential backoff for out-of-sync records
- **Mixed operations**: Retrieve and store in a single action call
- **Sequential store safety**: Multiple stores to the same record are processed sequentially to prevent race conditions

### Changed
- Improved warning messages with field path context (no raw record UIDs)
- Concise, direct validation messages for better CI log readability

### Security
- Stored values are masked in GitHub Actions logs via `setSecret()`
- Debug logs redact store values (shows `***`)
- File paths validated to stay within `GITHUB_WORKSPACE` (path traversal prevention)
- Protected sensitive field types from direct modification
- ReDoS-safe email validation regex

## [1.2.0] - 2025-08-22

### Changed
- Updated dependencies: ksm-core 17.4.0, @actions/core 2.0.3, ncc 0.38.4
- Updated GitHub Actions: checkout v6.0.2, setup-node v6.3.0
- Runtime updated to node24

## [1.1.0] - Previous Release

### Added
- Basic retrieve functionality with `>` operator
- Support for output variables, environment variables, and file destinations
- File download from Keeper records
- Initial KSM integration
