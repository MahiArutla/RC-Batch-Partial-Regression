test('BNS COMM NF -> Amendment -> Renewal -> Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();
    await loginPage.goto(env.webAppUrl);
    await loginPage.login(env.adminUser, env.adminPassword);
  
    const orchestrator = new Orchestrator();
  
    const nf = await orchestrator.runBnsCommHappyPathNF(page, 'BNS_COMM_HappyPath_NF');
    const partnerReference = nf.partnerReference!;
    const registrationNumber = nf.baseRegistrationNum || '';
  
    const amendment = await orchestrator.runBnsCommHappyPathAmendment(
      page,
      'BNS_COMM_AmendmentHappyPath',
      registrationNumber,
      partnerReference
    );
    expect(amendment.uniqueId).toBeTruthy();
  
    const renewal = await orchestrator.runBnsCommHappyPathRenewal(
      page,
      'BNS_COMM_RenewalHappyPath',
      registrationNumber,
      partnerReference
    );
    expect(renewal.uniqueId).toBeTruthy();
  
    const discharge = await orchestrator.runBnsCommHappyPathDischarge(
      page,
      'BNS_COMM_DischargeHappyPath',
      registrationNumber,
      partnerReference
    );
    expect(discharge.uniqueId).toBeTruthy();
  });
  