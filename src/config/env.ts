import path from 'path';
import { config } from 'dotenv';

let cachedEnv: EnvConfig | null = null;

export interface EnvConfig {
  webAppUrl: string;
  adminUser: string;
  adminPassword: string;
  dbConnectionString: string;
  sftpRoot: string;
  downloadDirectory: string;
  cgeApiBaseUrl: string;
  cgeApiUser: string;
}

export function loadEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  config({ path: path.resolve(process.cwd(), '.env') });

  cachedEnv = {
    webAppUrl: process.env.WEB_APP_URL ?? 'http://qa.admin.cd.cge.dhltd.corp',
    adminUser: process.env.ADMIN_USER ?? 'RCBATCHAUTOUSER@trader.ca',
    adminPassword: process.env.ADMIN_PASSWORD ?? 'Password1!',
    dbConnectionString: process.env.DB_CONNECTION_STRING ?? 'Server=MRKREGDBVWQA43.DHLTD.CORP,1558;Database=CGE_MIDDLEWARE_QA;User Id=MWQAUser;Password=G8n!Zp4Qv2@Hk7Lm;Encrypt=true;TrustServerCertificate=true;',
    sftpRoot: process.env.SFTP_ROOT ?? '\\\\cms_uat_ftp_non_pci.dhltd.corp\\cms_uat_ftp_non_pci\\CMSUATNONPCI\\Usr\\cgecd_qa2',
    downloadDirectory: process.env.DOWNLOAD_DIRECTORY ?? path.resolve(process.cwd(), 'downloads'),
    cgeApiBaseUrl: process.env.CGE_API_BASE_URL ?? 'http://aqa1publicapiwebsvcs.cge.dhltd.corp',
    cgeApiUser: process.env.CGE_API_USER ?? 'superuser'
  };

  return cachedEnv;
}
