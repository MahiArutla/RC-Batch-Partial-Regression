import { test, expect } from '../fixtures/test';
import { LoginPage } from '../pages/login.page';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';
import { loadScenarioData } from '../data/testData';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { DbService } from '../utils/dbUtility';

test.describe('GBC All Province Happy Path', () => {
  test('GBC NF smoke', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'GBC_AllProvinceHappyPath';
    const fileDetails = loadScenarioData(scenarioId);
    const orchestrator = new Orchestrator();
    const db = new DbService();
    const hangfirePage = new HangfireJobsPage(page);

    await test.step('Create NF file', async () => {
      await orchestrator.createNfFile(fileDetails);
    });

    await test.step('Trigger Hangfire jobs', async () => {
      await hangfirePage.goToHFJobs(db, fileDetails);
    });

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
