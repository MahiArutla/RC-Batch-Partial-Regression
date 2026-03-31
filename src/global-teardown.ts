import { closeSftpConnection } from './utils/sftpClient';

export default async function globalTeardown() {
  console.log('Closing SFTP connection...');
  await closeSftpConnection();
}
