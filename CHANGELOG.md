# Changelog

All notable changes to this project will be documented in this file.

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
