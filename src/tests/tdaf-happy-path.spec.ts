import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('TDAF All Province Happy Path', () => {
  test('TDAF NF -> Renewal -> Discharge HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1
    const scenarioId1 = 'TDAF_HappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1', async () => {
      return orchestrator.runHappyPath(page, scenarioId1, 'TDAF', 'TDAF_NF', scenarioId1, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Verify handshake file exists in SFTP before proceeding to Cycle 2
    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    // Cycle 2: Renewal
    const scenarioId2 = 'TDAF_HappyPath_Renewal';
    fileDetails = await test.step('Run orchestrator path cycle 2 (Renewal)', async () => {
      return orchestrator.runRenewalHappyPath(
        page,
        scenarioId2,
        'TDAF',
        'TDAF_Renewal.csv',
        scenarioId2,
        'BC',
        fileDetails.partnerReference!
      );
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Cycle 3: Discharge
    const scenarioId3 = 'TDAF_HappyPath_Discharge';
    fileDetails = await test.step('Run orchestrator path cycle 3 (Discharge)', async () => {
      return orchestrator.runDischargeHappyPath(
        page,
        scenarioId3,
        'TDAF',
        'TDAF_Discharge.txt',
        scenarioId3,
        'BC',
        fileDetails.partnerReference!
      );
    });

    await test.step('Validate unique id present cycle 3', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });

  test('TDAF Change of Province HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: New Finance
    const scenarioId1 = 'TDAF_HappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1', async () => {
      return orchestrator.runHappyPath(page, scenarioId1, 'TDAF', 'TDAF_NF_COP', scenarioId1, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Verify handshake file exists in SFTP before proceeding to Cycle 2
    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    // Cycle 2: Change of Province
    const scenarioId2 = 'TDAF_HappyPath_ChangeOfProvince';
    fileDetails = await test.step('Run orchestrator path cycle 2', async () => {
      return orchestrator.runChangeOfProvinceHappyPath(page, scenarioId2, 'TDAF', 'TDAF_ChangeOfProvince.txt', scenarioId2, 'MB', fileDetails.partnerReference!);
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });

  test('TDAF Greenlight Discharge HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: New Finance
    const scenarioId1 = 'TDAF_HappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1 (NF)', async () => {
      return orchestrator.runHappyPath(page, scenarioId1, 'TDAF', 'TDAF_NF', scenarioId1, 'BC', false);
    });
    fileDetails.batchType = 'NF';


    // Verify handshake file exists in SFTP before proceeding to Cycle 2
    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    // Cycle 2: Greenlight Discharge
    const scenarioId2 = 'TDAF_HappyPath_GreenlightDischarge';
    fileDetails = await test.step('Run orchestrator path cycle 2 (Greenlight Discharge)', async () => {
      return orchestrator.runGreenlightDischargeHappyPath(
        page,
        scenarioId2,
        'TDAF',
        'TDAF_GreenlightDischarge.txt',
        scenarioId2,
        'BC',
        fileDetails.partnerReference!
      );
    });
 await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });
    await test.step('Verify greenlight discharge completed', async () => {
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.batchType).toBe('GreenlightDischarge');
      expect(fileDetails.dischargeFileDescription).toBe('TD GreenLight Weekly Input Discharge TXT File');
      console.log(`✓ Greenlight discharge file created with partner reference: ${fileDetails.partnerReference}`);
    });

    // Note: Greenlight discharge is a special notification file
    // It generates uniqueId and return files but does NOT require manual processing or summary reports
  });

  test('TDAF Handshake File Verification HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_Handshakefile';
    const fileDetails = await test.step('Run orchestrator path for handshake verification', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'TDAF_NF', scenarioId, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      expect(handshakeFilePath).toContain('Fiserv_HandShake_Batch_');
      expect(handshakeFilePath).toContain('.csv');
      console.log(`✓ Handshake file verified at SFTP: ${handshakeFilePath}`);
    });

    await test.step('Verify handshake file details', async () => {
      const { getSftpClient } = await import('../utils/sftp');
      const sftp = getSftpClient();
      const handshakeDir = '/tdaf/handshake';

      const files = await sftp.listFiles(handshakeDir);
      const handshakeFiles = files.filter(f => /^Fiserv_HandShake_Batch_.*\.csv$/i.test(f));

      expect(handshakeFiles.length).toBeGreaterThan(0);
      console.log(`✓ Found ${handshakeFiles.length} handshake file(s) in SFTP`);
      console.log(`  Latest handshake file: ${handshakeFiles.sort().reverse()[0]}`);
    });
  });

  test('TDAF SLA Report HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_SLAReport';
    const fileDetails = await test.step('Run orchestrator path for SLA Report', async () => {
      return orchestrator.runSLAReportHappyPath(page, scenarioId, 'TDAF', 'TDAF_NF', scenarioId, 'BC');
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify ClientSLAReport downloaded and contains expected headers', async () => {
      expect(fileDetails.slaReportFileName).toBeTruthy();
      console.log(`✓ ClientSLAReport validated with all required headers`);
    });
  });

  test('TDAF_HappyPath_AB', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_AB';
    const fileDetails = await test.step('Run orchestrator path for Alberta (AB)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_ab', scenarioId, 'AB', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify AB province registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF AB registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_BC', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_BC';
    const fileDetails = await test.step('Run orchestrator path for British Columbia (BC)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_BC', scenarioId, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify BC province registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF BC registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_SK', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_SK';
    const fileDetails = await test.step('Run orchestrator path for Saskatchewan (SK)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_sk', scenarioId, 'SK', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify SK province registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF SK registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_MB', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_MB';
    const fileDetails = await test.step('Run orchestrator path for Manitoba (MB)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_mb', scenarioId, 'MB', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify MB province registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF MB registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_ON', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_ON';
    const fileDetails = await test.step('Run orchestrator path for Ontario (ON)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_on', scenarioId, 'ON', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify ON province registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF ON registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_QC', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_QC';
    const fileDetails = await test.step('Run orchestrator path for Quebec (QC)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_qc', scenarioId, 'QC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify QC province registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF QC registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_MissingTerm', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const { loadScenarioData } = await import('../data/testData');
    const { DbService } = await import('../utils/dbUtility');
    const { HangfireJobsPage } = await import('../pages/hangfire-jobs.page');
    const { DownloadPage } = await import('../pages/download.page');
    const { ManualProcessingService } = await import('../services/manualProcessingService');
    const { ExcelHelper } = await import('../utils/excelHelper');
    const fileSystem = await import('../utils/fileSystem');
    const path = await import('path');
    const fs = await import('fs');

    const scenarioId = 'TDAF_HappyPath_MissingTerm';
    const fileDetails = loadScenarioData(scenarioId);

    await test.step('Setup file details and create file', async () => {
      const localSample = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'tdaf_missing_Term');
      fileDetails.sampleFile = localSample;
      fileDetails.client = 'TDAF';
      fileDetails.fileInfo = 'TDAF';
      fileDetails.scenarioId = scenarioId;

      await fileSystem.createNfFileByClient(fileDetails);
      console.log(`Created TDAF file with missing term: ${fileDetails.inputFileName}`);
    });

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = new DbService();
    fileDetails.batchType = 'NF';

    await test.step('Set process and file status to not started', async () => {
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
    });

    await test.step('Trigger Hangfire jobs', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.goToHFJobs(db, fileDetails);
      console.log('Hangfire jobs completed');
    });

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Process manual transaction', async () => {
      const manualProcessingService = new ManualProcessingService();
      const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, 'AB', 'superuser');
      console.log('Manual Processing API response:', manualResponse);
    });

    await test.step('Download and verify summary report', async () => {
      const downloadPage = new DownloadPage(page);
      await downloadPage.setDownloadCriteria(fileDetails);
      const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
      await downloadPage.downloadAndVerify(fileDetails, downloadDir, scenarioId);
      console.log('Summary report file downloaded:', fileDetails.summaryReportFileName);
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const handshakeFilePath = await fileSystem.verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify summary report shows expected error counts', async () => {
      const summaryPath = path.join(process.cwd(), 'artifacts', scenarioId, fileDetails.summaryReportFileName!);

      // For missing term scenario: Imported Successfully = 0, Imported with Error = 1
      ExcelHelper.verifyImportedWithError(summaryPath, 1);

      console.log(`✓ TDAF Missing Term scenario validated successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  ✓ Imported Successfully: 0`);
      console.log(`  ✓ Imported with Error: 1`);
      console.log(`  Note: This scenario validates handling of files with missing term data`);
    });
  });

  test('TDAF_HappyPath_QC_Term', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_QC_Term';
    const fileDetails = await test.step('Run orchestrator path for Quebec with Term (QC_Term)', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_qc_term', scenarioId, 'QC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify QC_Term registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF QC with Term registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('TDAF_HappyPath_Term_99Years', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_Term_99Years';
    const fileDetails = await test.step('Run orchestrator path for 99 Years Term scenario', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_99_Years', scenarioId, 'AB', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Verify 99 Years Term registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF 99 Years Term registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Note: This scenario validates handling of maximum term value (99 years)`);
    });
  });

  test('TDAF_HappyPath_Term_Rounded', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    const scenarioId = 'TDAF_HappyPath_Term_Rounded';
    const fileDetails = await test.step('Run orchestrator path for Rounded Term scenario', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'tdaf_Term_Rounded', scenarioId, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Verify TDAF handshake file exists in SFTP', async () => {
      const { verifyTdafHandshakeFileExists } = await import('../utils/fileSystem');
      const handshakeFilePath = await verifyTdafHandshakeFileExists(fileDetails);
      expect(handshakeFilePath).toBeTruthy();
      console.log(`Handshake file verified at: ${handshakeFilePath}`);
    });

    await test.step('Validate RegistrationTerm in JSONRequest', async () => {
      const { DbService } = await import('../utils/dbUtility');
      const db = new DbService();

      // Validate that RegistrationTerm is rounded to "2" in the database
      await db.validateRegistrationTerm(fileDetails.batchNumber!, 'AB', '2');

      console.log(`✓ RegistrationTerm validated in JSONRequest (JurisdictionSpecificInfo.Bc.RegistrationTerm = "2")`);
    });

    await test.step('Verify Rounded Term registration completed successfully', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ TDAF Rounded Term registration completed successfully`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Note: This scenario validates handling of rounded term values`);
    });
  });
});
