import * as XLSX from 'xlsx';
import { expect } from '@playwright/test';

export class ExcelHelper {
  static getImportedSuccessfully(filePath: string): number {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at path: ${filePath}`);
    }
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'Imported by Province Summary';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in Excel file`);
    }

    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
    });

    const grandTotalRow = jsonData.find(
      row => row['Province'] === 'GrandTotal'
    );

    if (!grandTotalRow) {
      throw new Error('GrandTotal row not found in sheet');
    }

    return Number(grandTotalRow['Imported Successfully']);
  }

  static verifyImportedSuccessfullyAtLeast(filePath: string, minValue: number) {
    const importedSuccessfully = ExcelHelper.getImportedSuccessfully(filePath);

    console.log(
      'GrandTotal - Imported Successfully:',
      importedSuccessfully
    );

    expect(importedSuccessfully).toBeGreaterThanOrEqual(minValue);
  }

  static verifyImportedSuccessfullyGreaterThanZero(filePath: string) {
    ExcelHelper.verifyImportedSuccessfullyAtLeast(filePath, 1);
  }

  static getImportedWithError(filePath: string): number {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at path: ${filePath}`);
    }
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'Imported by Province Summary';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in Excel file`);
    }

    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
    });

    const grandTotalRow = jsonData.find(
      row => row['Province'] === 'GrandTotal'
    );

    if (!grandTotalRow) {
      throw new Error('GrandTotal row not found in sheet');
    }

    return Number(grandTotalRow['Imported with Error']);
  }

  static verifyImportedWithError(filePath: string, expectedErrorCount: number) {
    const importedSuccessfully = ExcelHelper.getImportedSuccessfully(filePath);
    const importedWithError = ExcelHelper.getImportedWithError(filePath);

    console.log('GrandTotal - Imported Successfully:', importedSuccessfully);
    console.log('GrandTotal - Imported with Error:', importedWithError);

    expect(importedSuccessfully).toBe(0);
    expect(importedWithError).toBe(expectedErrorCount);
  }

  static verifySLAReportHeaders(filePath: string) {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`SLA Report file not found at path: ${filePath}`);
    }
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in SLA Report file`);
    }

    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
    });

    if (jsonData.length === 0) {
      throw new Error('SLA Report has no data rows');
    }

    const expectedHeaders = [
      'Date',
      'File Type',
      'File Availability – Date and Time',
      'File Processing by CG – Date and Time',
      'Handshake Report Availability at SFTP – Date and Time',
      'Handshake Report Pass/Fail',
      'Client Summary Report availability at CG – Date and Time',
      'Client Summary Report Pass/Fail',
      'Overall Pass/Fail',
      'File Record Count'
    ];

    const firstRow = jsonData[0];
    const actualHeaders = Object.keys(firstRow);

    console.log('SLA Report Headers:', actualHeaders);

    for (const expectedHeader of expectedHeaders) {
      if (!actualHeaders.includes(expectedHeader)) {
        throw new Error(
          `Expected header "${expectedHeader}" not found in SLA Report. ` +
          `Available headers: ${actualHeaders.join(', ')}`
        );
      }
    }

    console.log('✓ All expected SLA Report headers are present');
  }
}
