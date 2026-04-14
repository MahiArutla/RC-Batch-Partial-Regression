# SFTP Configuration Guide

## Overview

This test framework now supports **true SFTP connectivity** using SSH protocol instead of Windows network paths. All test cases will connect to the SFTP server using the configured credentials.

## Connection Details

The framework is configured to connect to the following SFTP server:

- **Hostname**: `uatcmsnonpci.trader.ca`
- **Port**: `22`
- **Username**: `cgecd_qa2`
- **Password**: `4f9KLl6lZgjgiIq`

## Configuration

### Environment Variables

The SFTP credentials are configured in the `.env` file (or through environment variables). Copy `.env.example` to `.env` and update if needed:

```bash
cp .env.example .env
```

### Required Settings

```env
SFTP_HOST=uatcmsnonpci.trader.ca
SFTP_PORT=22
SFTP_USERNAME=cgecd_qa2
SFTP_PASSWORD=4f9KLl6lZgjgiIq
```

## What Changed

### Before
- Used Windows UNC paths: `\\\\cms_uat_ftp_non_pci.dhltd.corp\\...`
- Required direct network access to Windows file shares
- Limited to Windows environments

### After
- Uses SSH/SFTP protocol (ssh2-sftp-client library)
- Works across all platforms (Windows, macOS, Linux)
- Secure encrypted connection
- Automatic connection management

## Technical Implementation

### New SFTP Module

A new `src/utils/sftp.ts` module provides:

- **Connection Management**: Singleton pattern for efficient connection reuse
- **File Upload**: `uploadToSftp(localPath, remotePath)`
- **Directory Management**: `clearSftpDirectory(remotePath)`
- **File Operations**: download, delete, list, exists

### Updated Functions

All file upload functions in `src/utils/fileSystem.ts` have been updated to use SFTP:

- `updateNfFile()`
- `createNfFileTilde()`
- `createFordNfFc()`
- `createBnsCommNfXml()`
- `createBnsCommDischargeXml()`
- `createRenewalFile()`
- `createDischargeFile()`
- `createGreenlightDischargeFile()`
- `createBnsCommExternalFile()`
- `createBnsCommSearchFile()`
- `createBnsCommLookupFile()`
- `createGmfclNfFile()`
- `createGmfcrNfFile()`
- And all related functions

### Remote Path Structure

Remote SFTP paths follow this structure:

```
/                           # Root directory
├── BMO/
│   └── in/
├── GBC/
│   └── in/
├── CLEARCHARGE/
│   └── in/
├── tdaf/
│   ├── in/
│   └── handshake/
├── VW/
│   └── in/
├── ford/
│   └── in/
├── BNSCommercial/
│   └── BNSXML/
└── GMFCLCR/
    └── in/
```

## Usage in Tests

No changes required in your test files! The SFTP connection is handled automatically:

```typescript
// Example: Upload a file (handled internally)
await createNfFile(fileDetails);

// Example: Clear a directory (handled internally)
await clearSftpDirectory('/GBC/in');
```

## Connection Management

- **Lazy Connection**: SFTP connection is established on first use
- **Reuse**: Same connection is reused for multiple operations
- **Auto-Retry**: Connection failures are retried up to 3 times
- **Timeout**: 30-second ready timeout

## Troubleshooting

### Connection Failures

If you see SFTP connection errors:

1. **Verify credentials** in `.env` file
2. **Check network access** to `uatcmsnonpci.trader.ca:22`
3. **Firewall rules** - ensure port 22 is allowed
4. **VPN connection** - ensure you're connected if required

### Common Errors

**ECONNREFUSED**: Cannot connect to SFTP server
- Check hostname and port
- Verify network connectivity

**EACCES / Authentication failed**: Invalid credentials
- Verify username and password in `.env`

**ETIMEDOUT**: Connection timeout
- Network or firewall blocking connection
- Server might be down

### Debug Mode

To enable SFTP debugging, check the console output. The SFTP module logs:

- ✓ Connection established
- ✓ File uploaded: `localPath` → `remotePath`
- ✓ Directory cleared
- ✓ Disconnected

## Security Notes

- Credentials are stored in `.env` file (gitignored)
- Never commit `.env` to version control
- Use environment variables in CI/CD pipelines
- Consider using SSH keys for production environments

## Migration Notes

The framework maintains backward compatibility with the `env.sftpRoot` setting for legacy path references, but all actual file operations now use SFTP protocol.

## Dependencies

The SFTP functionality requires:

```json
{
  "ssh2-sftp-client": "^latest",
  "@types/ssh2-sftp-client": "^latest"
}
```

These are already installed in the project.
