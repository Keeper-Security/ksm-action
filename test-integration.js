#!/usr/bin/env node

/**
 * Integration Test Runner for KSM GitHub Action
 * 
 * This script helps you test the store functionality with your KSM configuration.
 * It will create a test record, store values to it, and verify the operations work.
 */

const fs = require('fs');
const path = require('path');
const { KsmAction, KsmOperations } = require('./lib/main');
const { loadJsonConfig, getSecrets, updateSecret } = require('@keeper-security/secrets-manager-core');

// Load .env.local if it exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('✅ Loaded configuration from .env.local\n');
} else {
    console.log('⚠️  No .env.local found. Please create one from .env.local.example\n');
    process.exit(1);
}

// Check required configuration
const config = process.env.KSM_TEST_CONFIG;
const testRecordUid = process.env.KSM_TEST_RECORD_UID;
const testFolderUid = process.env.KSM_TEST_FOLDER_UID;

if (!config) {
    console.error('❌ KSM_TEST_CONFIG is not set in .env.local');
    console.error('   Please add your base64-encoded KSM configuration\n');
    process.exit(1);
}

// Mock logger for testing
const logger = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    warning: (msg) => console.warn(`⚠️  ${msg}`),
    debug: (msg) => console.debug(`🔍 ${msg}`),
    setSecret: () => {},
    setOutput: () => {},
    exportVariable: () => {},
    setFailed: (msg) => console.error(`💥 Action Failed: ${msg}`),
    getBooleanInput: (name) => {
        switch(name) {
            case 'fail-on-store-error': return true;
            case 'allow-empty-values': return false;
            case 'create-if-missing': return !!testFolderUid;
            default: return false;
        }
    },
    getInput: (name) => {
        switch(name) {
            case 'keeper-secret-config': return config;
            case 'folder-uid': return testFolderUid;
            case 'new-record-type': return 'login';
            default: return '';
        }
    },
    getMultilineInput: () => []
};

async function runTests() {
    console.log('🚀 Starting KSM GitHub Action Integration Tests\n');
    console.log('═══════════════════════════════════════════════\n');
    
    const action = new KsmAction(new KsmOperations(), logger);
    const options = { storage: loadJsonConfig(config) };
    
    try {
        // Test 1: Connect and retrieve records
        console.log('📋 Test 1: Connecting to KSM and retrieving records...');
        const secrets = await getSecrets(options);
        console.log(`✅ Successfully connected! Found ${secrets.records.length} record(s)\n`);
        
        if (!testRecordUid && secrets.records.length > 0) {
            console.log('Available records for testing:');
            secrets.records.forEach(r => {
                console.log(`   - ${r.recordUid}: ${r.data?.title || 'Untitled'}`);
            });
            console.log('\n💡 Tip: Add KSM_TEST_RECORD_UID to .env.local to test with a specific record\n');
        }
        
        // Test 2: Store a value
        if (testRecordUid) {
            console.log(`📝 Test 2: Storing value to record ${testRecordUid}...`);
            
            const testValue = `test-value-${Date.now()}`;
            const input = {
                uid: testRecordUid,
                selector: 'field',
                notation: `${testRecordUid}/field/notes`,
                destination: testValue,
                operationType: 1, // store
                destinationType: 3 // value
            };
            
            try {
                await action.storeFieldValue(options, input);
                console.log(`✅ Successfully stored value: "${testValue}"\n`);
                
                // Verify the value was stored
                console.log('🔍 Test 3: Verifying stored value...');
                const updatedSecrets = await getSecrets(options);
                const record = updatedSecrets.records.find(r => r.recordUid === testRecordUid);
                const notesField = record?.data?.fields?.find(f => f.type === 'notes');
                
                if (notesField?.value?.[0] === testValue) {
                    console.log('✅ Value verified successfully!\n');
                } else {
                    console.log('⚠️  Value mismatch. Expected:', testValue);
                    console.log('   Actual:', notesField?.value?.[0], '\n');
                }
            } catch (error) {
                if (error.type === 'PERMISSION_DENIED' || error.message?.includes('not editable') || error.message?.includes('access_denied')) {
                    console.error(`\n❌ Permission Denied: You don't have write access to ${testRecordUid}`);
                    console.error('   KSM application needs edit permissions for the shared folder.');
                    console.error('   Contact your Keeper administrator or KSM application owner.\n');
                } else if (error.type === 'RECORD_NOT_FOUND') {
                    console.error('❌ Record not found:', testRecordUid);
                    console.error('   Please check the KSM_TEST_RECORD_UID in your .env.local\n');
                } else {
                    console.error('❌ Store operation failed:', error.message || error, '\n');
                }
            }
        } else {
            console.log('⚠️  Skipping store test - no KSM_TEST_RECORD_UID specified\n');
        }
        
        // Test 4: Test file upload (if record exists)
        if (testRecordUid) {
            console.log('📁 Test 4: Testing file upload...');
            
            // Create a test file
            const testFilePath = path.join(__dirname, 'test-file.txt');
            const testContent = `Test file created at ${new Date().toISOString()}`;
            fs.writeFileSync(testFilePath, testContent);
            
            try {
                const fileInput = {
                    uid: testRecordUid,
                    selector: 'file',
                    notation: `${testRecordUid}/file`,
                    destination: `file:${testFilePath}`,
                    operationType: 1, // store
                    destinationType: 3 // value
                };
                
                await action.storeFieldValue(options, fileInput);
                console.log('✅ File uploaded successfully!\n');
            } catch (error) {
                if (error.type === 'PERMISSION_DENIED' || error.message?.includes('not editable') || error.message?.includes('access_denied')) {
                    console.error(`❌ Permission Denied: You don't have write access to ${testRecordUid}`);
                    console.error('   KSM application needs edit permissions for the shared folder.');
                    console.error('   Contact your Keeper administrator or KSM application owner.\n');
                } else {
                    console.error('⚠️  File upload failed:', error.message || error);
                    console.error('   This is normal if the record type doesn\'t support files\n');
                }
            } finally {
                // Clean up test file
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            }
        }
        
        console.log('═══════════════════════════════════════════════\n');
        console.log('🎉 Integration tests completed!\n');
        
        if (!testRecordUid) {
            console.log('💡 To test store operations, add KSM_TEST_RECORD_UID to .env.local');
        }
        if (!testFolderUid) {
            console.log('💡 To test record creation, add KSM_TEST_FOLDER_UID to .env.local');
        }
        
    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});