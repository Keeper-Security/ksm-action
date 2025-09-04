# GitHub Actions Testing Setup

This guide explains how to configure GitHub Actions to run integration tests for the KSM Action.

## Prerequisites

1. A Keeper Secrets Manager (KSM) application with appropriate permissions
2. A test record in your Keeper vault that the KSM application can access
3. Admin access to the GitHub repository settings

## Configuration Steps

### Step 1: Create a Test Record

In your Keeper vault:
1. Create a test record with the following fields:
   - **Login field** (username) - for read tests
   - **Password field** - for read tests
   - **Notes field** - for write/store tests (⚠️ WILL BE MODIFIED)
   - **File attachment** named `file.txt` - for file download tests
2. Note the record's UID (you can find this in the record's details)

**⚠️ Important**: The workflow tests will modify the `notes` field during write tests. Make sure you're using a dedicated test record, not a production record.

### Step 2: Share the Record with KSM Application

1. Share the test record with your KSM application
2. Ensure the application has **edit permissions** (required for store operations testing)

### Step 3: Configure GitHub Repository

#### Add the KSM Configuration Secret

1. Go to your repository's Settings → Secrets and variables → Actions → Secrets
2. Click "New repository secret"
3. Name: `KSM_ACTION_TEST_CONFIG`
4. Value: Your base64-encoded KSM configuration
   - To get this, you can use the KSM CLI or console to generate the configuration
   - The configuration should have access to the test record

#### Add the Test Record UID Variable

1. Go to Settings → Secrets and variables → Actions → Variables
2. Click "New repository variable"
3. Name: `KSM_TEST_RECORD_UID`
4. Value: The UID of your test record (e.g., `abc123XYZ456`)

### Step 4: Verify Configuration

1. Go to the Actions tab in your repository
2. Run the "build-test" workflow manually (workflow_dispatch)
3. Check the logs to ensure tests pass

## What the Tests Cover

### Read Tests (`test` job)
- Retrieve login and password fields
- Download file attachments
- Export values to environment variables
- Output values to GitHub Actions outputs

### Write Tests (`test-write` job)
- Store values from direct input
- Store values from environment variables
- Store values from files
- Update the notes field
- Test file uploads
- Verify store operations succeeded

### Error Handling Tests
- Attempts to create new fields (should fail)
- Attempts to modify protected fields (should fail)
- Mixed read/write operations
- Invalid field references

## Troubleshooting

### Error: "Record not found"
- **Cause**: The test record UID doesn't exist or isn't accessible
- **Solution**: 
  - Verify the `KSM_TEST_RECORD_UID` variable is set correctly
  - Ensure the record is shared with the KSM application
  - Check that the KSM configuration has the correct permissions

### Error: "Permission denied" or "not editable"
- **Cause**: The KSM application doesn't have edit permissions
- **Solution**: Update the sharing permissions to allow editing

### Error: "KSM_ACTION_TEST_CONFIG is not set"
- **Cause**: The secret is not configured in the repository
- **Solution**: Add the `KSM_ACTION_TEST_CONFIG` secret as described above

## Environment-Specific Testing

The workflow uses the `prod` environment. If you have multiple environments:
1. Create environment-specific secrets and variables
2. Update the workflow's `environment:` field accordingly

## Default Fallback

If `KSM_TEST_RECORD_UID` is not set, the workflow will fall back to the default UID: `b7K1o8Fwoot8bryzH6pZJg`. 
Ensure this record exists and is accessible, or set the variable to override it.

## Local Testing

For local testing, use the `test-integration.js` script with a `.env.local` file:
```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
npm run test:integration
```