# Test Suite for Verification System (v0.2.0)

This directory contains comprehensive tests for the LLM-driven verification system added in v0.2.0.

## Test Setup

To run the tests, first install the required testing dependencies:

```bash
npm install --save-dev jest ts-jest @types/jest
```

Then add the following scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test Files

### `verification.test.ts`
Comprehensive unit and integration tests for the verification system:

- **Todo Creation with Verification**: Tests creating todos with verification metadata
- **setVerificationMethod**: Tests setting verification methods on existing todos
- **updateVerificationStatus**: Tests updating verification status (pending/verified/failed)
- **getTodosNeedingVerification**: Tests querying todos that need verification
- **Backward Compatibility**: Ensures existing todos without verification fields still work

### `schemas.test.ts`
Validation tests for the new Zod schemas:

- **CreateTodoSchema**: Tests validation of create requests with new optional fields
- **UpdateTodoSchema**: Tests validation of update requests with verification fields
- **SetVerificationMethodSchema**: Tests validation of verification method setting
- **UpdateVerificationStatusSchema**: Tests validation of status updates
- **GetTodosNeedingVerificationSchema**: Tests validation of verification queries

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npx jest verification.test.ts

# Run specific test suite
npx jest --testNamePattern="setVerificationMethod"
```

## Test Coverage

The test suite covers:

✅ **Core Functionality**
- Creating todos with verification metadata
- Setting verification methods
- Updating verification status
- Querying todos needing verification

✅ **Edge Cases**
- Non-existent todo IDs
- Invalid verification statuses
- Empty/missing required fields
- Legacy data compatibility

✅ **Data Persistence**
- Saving and loading verification data
- Backward compatibility with old todo format
- Proper serialization of new fields

✅ **Schema Validation**
- All new Zod schemas
- Required vs optional fields
- Enum validation for verification status
- Array validation for tags

## Manual Testing Scenarios

The following scenarios should be tested manually to verify the LLM integration:

### LLM Workflow Tests

1. **Task Planning with Verification**
   - Ask LLM to break down a complex task
   - Verify LLM identifies which subtasks need verification
   - Check that appropriate verification methods are suggested

2. **Verification Execution**
   - Complete a task that has a verification method
   - Ask LLM to perform the verification
   - Verify LLM updates the verification status appropriately

3. **Failed Verification Handling**
   - Create a scenario where verification fails
   - Verify LLM creates appropriate follow-up tasks
   - Check that verification status is set to 'failed'

4. **Group-based Verification**
   - Create todos in different groups
   - Test filtering verification queries by group
   - Verify LLM can handle grouped verification workflows

### Example LLM Prompts for Testing

```
"Create todos to deploy a website and make sure each step can be verified"

"I've completed the 'Upload files to server' task. Please verify it was done correctly."

"Show me all tasks that need verification for project group 'website-launch'"

"The verification for 'Test contact form' failed because emails aren't sending. Create follow-up tasks."
```

## Test Data Management

Tests use temporary files to avoid conflicts:
- Each test creates its own temporary JSON file
- Files are automatically cleaned up after tests
- No shared state between tests
- Safe for parallel execution

## Performance Considerations

The test suite is designed to be fast and reliable:
- Uses in-memory operations where possible
- Minimal file I/O with temporary files
- Parallel test execution supported
- Coverage collection optimized for CI/CD