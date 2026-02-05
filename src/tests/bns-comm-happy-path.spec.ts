import { test, expect } from '../fixtures/test';

test.setTimeout(600000); // 10 minutes
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('BNS Commercial Smoke', async () => {
  test.setTimeout(20 * 60 * 1000); // 20 minutes for full end-to-end flow
  test('BNS COMM NF -> Amendment -> Renewal -> Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });

    const orchestrator = new Orchestrator();

    const nf = await test.step('Run BNS COMM NF orchestrator', async () => {
      return orchestrator.runBnsCommHappyPathNF(page, 'BNS_COMM_HappyPath_NF');
    }, { timeout: 8 * 60 * 1000 });
    expect(nf.uniqueId).toBeTruthy();

    const partnerReference = nf.partnerReference!;
    const registrationNumber = nf.baseRegistrationNum || '';

    const amendment = await test.step('Run BNS COMM Amendment orchestrator', async () => {
      return orchestrator.runBnsCommHappyPathAmendment(
        page,
        'BNS_COMM_AmendmentHappyPath',
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

