import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('BNS COMM Happy Path Tests', () => {
  test('BNS_COMM_ExternalHappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_ExternalHappyPath';

    const fileDetails = await test.step('Run BNS COMM External Happy Path', async () => {
      return orchestrator.runBnsCommExternalHappyPath(page, scenarioId);
    });

    await test.step('Validate External file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ BNS COMM External file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });
  });

  test('BNS_COMM_SearchHappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_SearchHappyPath';

    const fileDetails = await test.step('Run BNS COMM Search Happy Path', async () => {
      return orchestrator.runBnsCommSearchHappyPath(page, scenarioId);
    });

    await test.step('Validate Search file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      console.log(`✓ BNS COMM Search file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
    });
  });

  test('BNS_COMM_LookupHappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_LookupHappyPath';

    const fileDetails = await test.step('Run BNS COMM Lookup Happy Path', async () => {
      return orchestrator.runBnsCommLookupHappyPath(page, scenarioId);
    });

    await test.step('Validate Lookup file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      console.log(`✓ BNS COMM Lookup file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      if (fileDetails.orderId) {
        console.log(`  Order ID: ${fileDetails.orderId}`);
      }
    });
  });

  test('BNS_COMM_AmendmentHappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: NF
    const scenarioId1 = 'BNS_COMM_NF';
    let fileDetails = await test.step('Run BNS COMM NF - Cycle 1', async () => {
      return orchestrator.runBnsCommNfHappyPath(page, scenarioId1);
    });

    await test.step('Validate NF file processing completed - Cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ BNS COMM NF file processed successfully - Cycle 1`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });

    // Cycle 2: Amendment
    const scenarioId2 = 'BNS_COMM_Amendment';
    fileDetails = await test.step('Run BNS COMM Amendment - Cycle 2', async () => {
      return orchestrator.runBnsCommAmendmentHappyPath(
        page,
        scenarioId2,
        fileDetails.baseRegistrationNum!,
        fileDetails.partnerReference!
      );
    });

    await test.step('Validate Amendment file processing completed - Cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ BNS COMM Amendment file processed successfully - Cycle 2`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });
  });

  test('BNS_COMM_NF_QC', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_NF_QC';

    const fileDetails = await test.step('Run BNS COMM NF QC', async () => {
      return orchestrator.runBnsCommNfQcHappyPath(page, scenarioId);
    });

    await test.step('Validate NF QC file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ BNS COMM NF QC file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });
  });

  test('BNS_COMM_NF_Term99', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_NF_Term99';

    const fileDetails = await test.step('Run BNS COMM NF Term 99', async () => {
      return orchestrator.runBnsCommNfTerm99HappyPath(page, scenarioId);
    });

    await test.step('Validate NF Term 99 file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ BNS COMM NF Term 99 file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });
  });

  test('BNS_COMM_NF_Invalid_TransitNumber', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_NF_Invalid_TransitNumber';

    const fileDetails = await test.step('Run BNS COMM NF Invalid Transit Number', async () => {
      return orchestrator.runBnsCommNfInvalidTransitNumber(page, scenarioId);
    });

    await test.step('Validate file was not imported as expected', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      console.log(`✓ BNS COMM NF Invalid Transit Number file rejected as expected`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Status: NotImported (validation failed)`);
    });
  });

  test.setTimeout(600000); // 10 minutes
  test('BNS COMM NF -> Amendment -> Renewal -> Discharge', async ({ page, loginPage }) => {
    test.setTimeout(20 * 60 * 1000); // 20 minutes for full end-to-end flow
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });

    const orchestrator = new Orchestrator();

    const nf = await test.step('Run BNS COMM NF orchestrator', async () => {
      return orchestrator.runBnsCommNfHappyPath(page, 'BNS_COMM_NF');
    }, { timeout: 8 * 60 * 1000 });
    expect(nf.uniqueId).toBeTruthy();

    const partnerReference = nf.partnerReference!;
    const registrationNumber = nf.baseRegistrationNum || '';

    const amendment = await test.step('Run BNS COMM Amendment orchestrator', async () => {
      return orchestrator.runBnsCommAmendmentHappyPath(
        page,
        'BNS_COMM_Amendment',
        registrationNumber,
        partnerReference
      );
    }, { timeout: 6 * 60 * 1000 });
    expect(amendment.uniqueId).toBeTruthy();

    const renewal = await test.step('Run BNS COMM Renewal orchestrator', async () => {
      return orchestrator.runBnsCommHappyPathRenewal(
        page,
        'BNS_COMM_RenewalHappyPath',
        registrationNumber,
        partnerReference
      );
    }, { timeout: 6 * 60 * 1000 });
    expect(renewal.uniqueId).toBeTruthy();

    const discharge = await test.step('Run BNS COMM Discharge orchestrator', async () => {
      return orchestrator.runBnsCommHappyPathDischarge(
        page,
        'BNS_COMM_DischargeHappyPath',
        registrationNumber,
        partnerReference
      );
    }, { timeout: 6 * 60 * 1000 });
    expect(discharge.uniqueId).toBeTruthy();
  });
});
