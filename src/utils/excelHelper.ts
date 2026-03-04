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
}
