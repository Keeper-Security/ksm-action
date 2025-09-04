# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2025-08-22

### Added
- **Store functionality**: New `<` operator to store values to Keeper Secrets Manager
  - Syntax: `RecordUID/field/fieldname < value` 
  - Supports environment variables: `RecordUID/field/password < env:MY_PASSWORD`
  - Supports file content: `RecordUID/field/notes < file:/path/to/file.txt`
  - Supports GitHub Actions outputs: `RecordUID/field/login < out:step-id.output-name`
- **File upload support**: Store files directly to records using `RecordUID/file < /path/to/file`
- **Comprehensive safeguards**:
  - Protected field types (fileRef, passkey) cannot be modified
  - Prevents adding new fields to existing records
  - Field value validation (email, URL, date formats)
  - Record integrity checks before and after modifications
- **Enhanced error handling**:
  - Clear, actionable error messages
  - Permission error guidance
  - Field validation warnings

### Changed
- Field modification is now restricted to existing fields only
- Improved error messages for better user guidance

### Security
- Added validation to prevent record corruption
- Protected sensitive field types from direct modification
- Input sanitization for all field values

## [1.1.0] - Previous Release

### Added
- Basic retrieve functionality with `>` operator
- Initial KSM integration