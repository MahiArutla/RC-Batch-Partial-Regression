

## Excel-driven Test Data

- Source file: [src/data/TestData.xlsx](src/data/TestData.xlsx)
- Loader: [src/utils/testDataHelper.ts](src/utils/testDataHelper.ts) reads the first sheet and maps rows to the `FileDetails` shape used by tests.
- Merge behavior: Excel rows override the defaults defined in [src/data/testData.ts](src/data/testData.ts) when `scenarioId` matches.
- Expected columns (case-insensitive): `scenarioId`, `client`, `fileInfo`, `inputFileDescription`, `sampleFile`, `downloadFileType`, `returnFileDescription`. Optional fields are also supported (dates, flags, renewal/discharge/COP file descriptions, etc.).

Environment variables (set in `.env`):

- `SFTP_ROOT`: UNC or local path to the SFTP share root (e.g., `\\cms_uat_ftp_non_pci.dhltd.corp\cms_uat_ftp_non_pci\CMSUATNONPCI\Usr\cgecd_qa2`).
- `DB_CONNECTION_STRING`: SQL Server connection string used by DB helpers.
