# BNS COMM Amendment Happy Path Test - Implementation Summary

## Test Overview
Created a two-cycle test for BNS COMM Amendment Happy Path:
- **Cycle 1**: NF (New Finance) with BNS_Comm_NF.xml
- **Cycle 2**: Amendment with BNS_Comm_Amend.xml

## Files Modified

### 1. Test Specification
**File**: `src/tests/bns-comm-happy-path.spec.ts`

Added new test: `BNS_COMM_AmendmentHappyPath`

**Test Flow**:
1. Login to web application
2. **Cycle 1 - NF**:
   - Run `runBnsCommNfHappyPath()` with scenario `BNS_COMM_NF`
   - Update refnum and batch number
   - Upload to SFTP `\BNSCommercial\BNSXML`
   - Filename: `xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml` (f is 0-9)
   - Run Hangfire Jobs
   - Skip Client file summary
   - Do manual processing
   - Run HF jobs for return file & verify
   - Capture: partnerReference and baseRegistrationNum

3. **Cycle 2 - Amendment**:
   - Run `runBnsCommAmendmentHappyPath()` with scenario `BNS_COMM_Amendment`
   - Use partnerReference and baseRegistrationNum from Cycle 1
   - Update refnum, batch number, and PPR-Registration-Number
   - Upload to SFTP `\BNSCommercial\BNSXML`
   - Filename: `xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml` (f is 0-9)
   - Run Hangfire Jobs
   - Skip Client file summary
   - Do manual processing
   - Run HF jobs for return file & verify

### 2. Orchestrator Service
**File**: `src/services/orchestrator.ts`

Added two new methods:

#### `runBnsCommNfHappyPath(page, scenarioId)`
- Loads scenario data for BNS_COMM_NF
- Uses sample file: `BNS_Comm_NF.xml`
- Creates NF XML file with unique batch number and partner reference
- Uploads to SFTP
- Runs Hangfire jobs
- Validates handshake job status
- Performs manual processing (province: BC, user: superuser)
- Downloads and validates return file
- Returns fileDetails with partnerReference and baseRegistrationNum

#### `runBnsCommAmendmentHappyPath(page, scenarioId, registrationNumber, partnerReference)`
- Loads scenario data for BNS_COMM_Amendment
- Uses sample file: `BNS_Comm_Amend.xml`
- Receives partnerReference and registrationNumber from Cycle 1
- Creates Amendment XML file with:
  - New batch number
  - Existing partnerReference (from Cycle 1)
  - Existing baseRegistrationNum (from Cycle 1)
- Uploads to SFTP
- Runs Hangfire jobs
- Validates handshake job status
- Performs manual processing (province: BC, user: superuser)
- Downloads and validates return file
- Returns fileDetails

### 3. File System Utilities
**File**: `src/utils/fileSystem.ts`

Added new function: `createBnsCommAmendmentXml(fileDetails)`

**Functionality**:
- Creates artifacts directory for scenario
- Generates filename: `xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml` (where f is 0-9)
- Copies sample file (BNS_Comm_Amend.xml) to artifacts
- Updates batch number (generated)
- Updates partner reference (from Cycle 1)
- Updates PPR-Registration-Number (from Cycle 1)
- Uploads to SFTP: `{sftpRoot}/BNSCommercial/BNSXML/`
- Clears directory before upload

## Configuration Required

### TestData.xlsx Configuration
You need to add two rows to TestData.xlsx:

#### Row 1: BNS_COMM_NF
```
scenarioId: BNS_COMM_NF
client: BNS_COMM
fileInfo: BNS_COMM
inputFileDescription: BNS Commercial New Finance Input File
sampleFile: BNS_Comm_NF.xml (or full path to src/data/BNS_COMM/BNS_Comm_NF.xml)
downloadFileType: ReturnFile
returnFileDescription: BNS Commercial Return File
```

#### Row 2: BNS_COMM_Amendment
```
scenarioId: BNS_COMM_Amendment
client: BNS_COMM
fileInfo: BNS_COMM
inputFileDescription: BNS Commercial Amendment Input File
sampleFile: BNS_Comm_Amend.xml (or full path to src/data/BNS_COMM/BNS_Comm_Amend.xml)
downloadFileType: ReturnFile
returnFileDescription: BNS Commercial Amendment Return File
```

### Sample Files
Both sample files already exist:
- `src/data/BNS_COMM/BNS_Comm_NF.xml` ✓
- `src/data/BNS_COMM/BNS_Comm_Amend.xml` ✓

## XML File Processing

### Filename Template
All files follow the pattern: `xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml`
- Where `f` is a single digit (0-9) representing the first digit of milliseconds
- Example: `xifdoc_2026-03-17_14-30-45_6.xml`

### SFTP Upload Location
- Directory: `{sftpRoot}/BNSCommercial/BNSXML/`
- Directory is cleared before each upload

### XML Updates Applied

#### Cycle 1 (NF):
- `<Batch Number="...">` → Generated unique batch number
- `<Partner-Reference>` → Generated 8-digit reference
- File uploaded to SFTP

#### Cycle 2 (Amendment):
- `<Batch Number="...">` → New generated batch number
- `<Partner-Reference>` → Same as Cycle 1
- `<PPR-Registration-Number>` → Registration number from Cycle 1 return file
- File uploaded to SFTP

## Test Execution Flow

```
1. Login
2. Cycle 1: NF
   ├── Create XML file (new batch, new partner ref)
   ├── Upload to SFTP
   ├── Run Hangfire Jobs
   ├── Validate handshake
   ├── Manual processing
   ├── Download return file
   └── Capture: partnerReference, baseRegistrationNum
3. Cycle 2: Amendment
   ├── Create XML file (new batch, reuse partner ref, reuse registration num)
   ├── Upload to SFTP
   ├── Run Hangfire Jobs
   ├── Validate handshake
   ├── Manual processing
   ├── Download return file
   └── Verify all fields populated
```

## Running the Test

To run this test:
```bash
npx playwright test src/tests/bns-comm-happy-path.spec.ts -g "BNS_COMM_AmendmentHappyPath"
```

Or to run all BNS COMM tests:
```bash
npx playwright test src/tests/bns-comm-happy-path.spec.ts
```

## Dependencies
- Requires TestData.xlsx to be configured with both scenarios
- Requires SFTP access to BNSCommercial/BNSXML directory
- Requires Hangfire jobs to be running
- Requires manual processing API to be accessible
- Both XML sample files must exist in src/data/BNS_COMM/

## Notes
- Manual processing is done for province BC with superuser
- Client summary file is skipped (not downloaded)
- Return files are validated for both cycles
- Test follows the same pattern as TDAF Happy Path tests (NF → Renewal → Discharge)
