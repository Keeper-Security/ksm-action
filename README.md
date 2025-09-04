# Keeper Secrets Manager GitHub Action

This GitHub Action integrates with Keeper Secrets Manager to retrieve and store secrets in your CI/CD workflows. It supports bidirectional secret management - both reading secrets from Keeper and writing dynamically generated secrets back to Keeper.

## Features

- **Retrieve secrets** from Keeper Secrets Manager
- **Store secrets** to Keeper Secrets Manager (NEW!)
- **File upload/download** support
- **Permission-aware error handling** with helpful messages
- **Create records on-demand** when storing to non-existent records
- **Full backward compatibility** with existing workflows

More info on our [official documentation page](https://docs.keeper.io/secrets-manager/secrets-manager/integrations/github-actions)

## Installation

```yaml
- uses: Keeper-Security/ksm-action@v1
  with:
    keeper-secret-config: ${{ secrets.KSM_CONFIG }}
    secrets: |
      # Your secret operations here
```

## Configuration

### Required Inputs

| Input | Description |
|-------|-------------|
| `keeper-secret-config` | Base64 encoded Keeper Secrets Manager configuration |
| `secrets` | List of secrets to retrieve or store (see notation below) |

### Optional Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `create-if-missing` | `false` | Create records if they don't exist when storing |
| `folder-uid` | - | Folder UID for creating new records (required if `create-if-missing` is true) |
| `new-record-type` | `login` | Type for newly created records |
| `fail-on-store-error` | `true` | Fail the action if a store operation fails |
| `allow-empty-values` | `false` | Allow storing empty values to fields |

## Secret Notation

The action uses a simple arrow notation to indicate data flow direction:

### Retrieve Secrets (Keeper → Variable)
Use `>` to retrieve secrets FROM Keeper:

```yaml
secrets: |
  RecordUID/field/password > MY_PASSWORD
  RecordTitle/field/login > USERNAME
  RecordUID/file > file:certificate.pem
```

### Store Secrets (Variable → Keeper)
Use `<` to store secrets TO Keeper:

```yaml
secrets: |
  RecordUID/field/password < ${{ steps.generate.outputs.password }}
  RecordTitle/field/api_key < env:NEW_API_KEY
  RecordUID/file < file:upload.pdf
```

## Usage Examples

### Basic Retrieve
```yaml
- name: Retrieve Secrets
  uses: Keeper-Security/ksm-action@v1
  with:
    keeper-secret-config: ${{ secrets.KSM_CONFIG }}
    secrets: |
      BediNKCMG21ztm5xGYgNww/field/login > username
      BediNKCMG21ztm5xGYgNww/field/password > env:DB_PASSWORD
```

### Store Generated Password
```yaml
- name: Generate Password
  id: generate
  run: echo "password=$(openssl rand -base64 32)" >> $GITHUB_OUTPUT

- name: Store in Keeper
  uses: Keeper-Security/ksm-action@v1
  with:
    keeper-secret-config: ${{ secrets.KSM_CONFIG }}
    secrets: |
      ServiceAccount/field/password < ${{ steps.generate.outputs.password }}
```

### Mixed Operations
```yaml
- name: Rotate Credentials
  uses: Keeper-Security/ksm-action@v1
  with:
    keeper-secret-config: ${{ secrets.KSM_CONFIG }}
    secrets: |
      # Retrieve current password
      ServiceAccount/field/password > OLD_PASSWORD
      
      # Store new password
      ServiceAccount/field/password < ${{ env.NEW_PASSWORD }}
      ServiceAccount/field/notes < "Rotated on ${{ github.run_id }}"
```

### Upload Files
```yaml
- name: Generate and Store Certificate
  run: |
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
      -subj "/CN=example.com"
  
- name: Store Certificate in Keeper
  uses: Keeper-Security/ksm-action@v1
  with:
    keeper-secret-config: ${{ secrets.KSM_CONFIG }}
    secrets: |
      ServiceCert/file < file:cert.pem
      ServiceCert/file < file:key.pem
      ServiceCert/field/notes < "Generated for deployment"
```

### Create New Records
```yaml
- name: Store to New Record
  uses: Keeper-Security/ksm-action@v1
  with:
    keeper-secret-config: ${{ secrets.KSM_CONFIG }}
    create-if-missing: true
    folder-uid: FOLDER_UID_HERE
    new-record-type: login
    secrets: |
      NewService/field/login < service-account@example.com
      NewService/field/password < ${{ steps.generate.outputs.password }}
```

## Source Value Types

When storing values, you can use different source types:

| Prefix | Example | Description |
|--------|---------|-------------|
| (none) | `< myvalue` | Direct value or GitHub expression |
| `env:` | `< env:MY_VAR` | Environment variable |
| `file:` | `< file:path/to/file` | File contents (text) or file upload |
| `out:` | `< out:step_output` | GitHub Actions output variable |

## Error Handling

The action provides clear error messages for common issues:

### Permission Denied
```
❌ Permission Denied: You don't have write access to RecordUID/field/password
   Please ensure your KSM application has edit permissions for this record.
   Contact your Keeper administrator to grant write access.
```

### Record Not Found
```
❌ Record Not Found: RecordUID/field/password
   The record or field you're trying to update doesn't exist.
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
Set up environment variables for integration testing:

```bash
export KSM_TEST_CONFIG="your-base64-config"
export KSM_TEST_RECORD_UID="test-record-uid"
export KSM_TEST_FOLDER_UID="test-folder-uid"
npm test -- integration.test.ts
```

To skip destructive tests:
```bash
export KSM_TEST_SKIP_DESTRUCTIVE=true
npm test -- integration.test.ts
```

## Development

### Building
```bash
npm run build
npm run package
```

### Running Locally
```bash
npm run all  # Build, format, lint, package, and test
```

## Migration Guide

### From v1.0 to v1.1

Version 1.1 adds store functionality while maintaining full backward compatibility:

**Before (v1.0):**
```yaml
# Only retrieval was supported
secrets: |
  RecordUID/field/password > MY_PASSWORD
```

**After (v1.1):**
```yaml
# Both retrieval and storage are supported
secrets: |
  RecordUID/field/password > MY_PASSWORD        # Still works!
  RecordUID/field/password < NEW_PASSWORD       # New feature!
```

No changes required to existing workflows - they will continue to work as before.

## Security Considerations

- All values are masked in logs using GitHub's secret masking
- Store operations require write permissions in Keeper
- Failed store operations can be configured to fail the workflow
- Empty values are rejected by default (configurable)
- Protected field types (fileRef, passkey, etc.) cannot be modified directly
- Unknown field types are rejected to prevent record corruption

## Error Handling

The action includes robust error handling and recovery mechanisms:

- **Automatic Retry**: If a record is "out of sync", the action will automatically refresh and retry up to 3 times
- **Field Validation**: Values are validated before storage to prevent data corruption
- **Rollback on Failure**: If an update fails, changes are automatically rolled back
- **Clear Error Messages**: Detailed error messages help identify permission or configuration issues

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/Keeper-Security/ksm-action/issues)
- Read our [official documentation](https://docs.keeper.io/secrets-manager/secrets-manager/integrations/github-actions)
- Contact Keeper Security support

## License

MIT