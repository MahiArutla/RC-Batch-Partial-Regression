

## Excel-driven Test Data

- Source file: [src/data/TestData.xlsx](src/data/TestData.xlsx)
- Loader: [src/utils/testDataHelper.ts](src/utils/testDataHelper.ts) reads the first sheet and maps rows to the `FileDetails` shape used by tests.
- Merge behavior: Excel rows override the defaults defined in [src/data/testData.ts](src/data/testData.ts) when `scenarioId` matches.
- Expected columns (case-insensitive): `scenarioId`, `client`, `fileInfo`, `inputFileDescription`, `sampleFile`, `downloadFileType`, `returnFileDescription`. Optional fields are also supported (dates, flags, renewal/discharge/COP file descriptions, etc.).

## GBC NF Smoke Test

- Sample file lives in-repo at: [src/data/GBC/GBC_NF.XIF](src/data/GBC/GBC_NF.XIF)
- The test [src/tests/gbc-all-province-happy-path.spec.ts](src/tests/gbc-all-province-happy-path.spec.ts) explicitly overrides the scenario's `sampleFile` to this local copy for stability.
- The service creates a timestamped XIF, updates batch number if present, and copies it to the SFTP share under `GBC/in`.
- The test performs a minimal smoke assertion that the file exists at `SFTP_ROOT/GBC/in/<generatedName>.XIF`.

Environment variables (set in `.env`):

- `SFTP_ROOT`: UNC or local path to the SFTP share root (e.g., `\\cms_uat_ftp_non_pci.dhltd.corp\cms_uat_ftp_non_pci\CMSUATNONPCI\Usr\cgecd_qa2`).
- `DB_CONNECTION_STRING`: SQL Server connection string used by DB helpers.
- `LEGACY_DATA_ROOT`: Base path for legacy sample files; not required for the GBC smoke test since it uses the repo sample.

Run just the smoke test:

```bash
npx playwright test -g "GBC All Province Happy Path"
```
