# Changelog

All notable changes to this project will be documented in this file.

## [1.3.1] - 2026-08-10

### Security
- Resolved all 15 open Dependabot alerts (11 distinct advisories) via dependency updates. No
  `package.json` range changes were required — every patched version was already in range:
  - `undici` 6.24.1 → 6.28.0 (CVE-2026-16729, CVE-2026-15157, CVE-2026-16728, CVE-2026-9679,
    CVE-2026-11525, CVE-2026-6733)
  - `js-yaml` 4.1.1 → 4.3.1 and 3.14.2 → 3.15.1 (CVE-2026-59869, CVE-2026-53550, GHSA-5p4m-2wfm-xmqj)
  - `brace-expansion` 2.0.3 → 2.1.4 and 1.1.13 → 1.1.18 (CVE-2026-13149)
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
