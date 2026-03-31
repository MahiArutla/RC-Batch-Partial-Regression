import SftpClient from 'ssh2-sftp-client';
import { loadEnv } from '../config/env';
import path from 'path';

const env = loadEnv();

let sftpClient: SftpClient | null = null;
let isConnected: boolean = false;

async function getSftpClient(): Promise<SftpClient> {
  if (sftpClient && isConnected) {
    return sftpClient;
  }

  sftpClient = new SftpClient();
  await sftpClient.connect({
    host: env.sftpHost,
    port: env.sftpPort,
    username: env.sftpUsername,
    password: env.sftpPassword,
    readyTimeout: 20000,
    retries: 3,
    retry_minTimeout: 2000
  });

  isConnected = true;
  console.log(`✓ Connected to SFTP server: ${env.sftpHost}`);
  return sftpClient;
}

export async function ensureSftpDirectory(remotePath: string): Promise<void> {
  const client = await getSftpClient();

  try {
    await client.mkdir(remotePath, true);
  } catch (error: any) {
    if (error.code !== 4) {
      throw error;
    }
  }
}

export async function uploadFileToSftp(localPath: string, remotePath: string): Promise<void> {
  const client = await getSftpClient();

  const remoteDir = path.dirname(remotePath).replace(/\\/g, '/');
  await ensureSftpDirectory(remoteDir);

  await client.put(localPath, remotePath);
  console.log(`✓ Uploaded: ${localPath} -> ${remotePath}`);
}

export async function downloadFileFromSftp(remotePath: string, localPath: string): Promise<void> {
  const client = await getSftpClient();
  await client.get(remotePath, localPath);
  console.log(`✓ Downloaded: ${remotePath} -> ${localPath}`);
}

export async function listSftpDirectory(remotePath: string): Promise<string[]> {
  const client = await getSftpClient();

  try {
    const files = await client.list(remotePath);
    return files.map(file => file.name);
  } catch (error: any) {
    if (error.code === 2) {
      return [];
    }
    throw error;
  }
}

export async function deleteSftpFile(remotePath: string): Promise<void> {
  const client = await getSftpClient();

  try {
    await client.delete(remotePath);
    console.log(`✓ Deleted: ${remotePath}`);
  } catch (error: any) {
    if (error.code !== 2) {
      throw error;
    }
  }
}

export async function clearSftpDirectory(remotePath: string): Promise<void> {
  const client = await getSftpClient();

  try {
    const files = await listSftpDirectory(remotePath);
    for (const file of files) {
      const filePath = path.posix.join(remotePath, file);
      await deleteSftpFile(filePath);
    }
  } catch (error: any) {
    console.log(`Note: Could not clear directory ${remotePath}: ${error.message}`);
  }
}

export async function sftpPathExists(remotePath: string): Promise<boolean> {
  const client = await getSftpClient();

  try {
    await client.stat(remotePath);
    return true;
  } catch {
    return false;
  }
}

export async function closeSftpConnection(): Promise<void> {
  if (sftpClient && isConnected) {
    await sftpClient.end();
    sftpClient = null;
    isConnected = false;
    console.log('✓ SFTP connection closed');
  }
}
