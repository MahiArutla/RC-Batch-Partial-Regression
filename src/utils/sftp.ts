import SftpClient from 'ssh2-sftp-client';
import { loadEnv } from '../config/env';
import fs from 'fs/promises';
import path from 'path';

const env = loadEnv();

export class SftpHelper {
  private client: SftpClient;
  private isConnected: boolean = false;

  constructor() {
    this.client = new SftpClient();
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect({
        host: env.sftpHost,
        port: env.sftpPort,
        username: env.sftpUsername,
        password: env.sftpPassword,
        readyTimeout: 30000,
        retries: 3,
        retry_minTimeout: 2000
      });
      this.isConnected = true;
      console.log(`✓ Connected to SFTP server: ${env.sftpHost}:${env.sftpPort}`);
    } catch (error) {
      console.error('Failed to connect to SFTP server:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
      console.log('✓ Disconnected from SFTP server');
    }
  }

  async ensureRemoteDirectory(remotePath: string): Promise<void> {
    await this.connect();
    try {
      await this.client.mkdir(remotePath, true);
    } catch (error: any) {
      // Ignore error if directory already exists
      if (error.code !== 4) {
        throw error;
      }
    }
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.connect();
    const remoteDir = path.dirname(remotePath).replace(/\\/g, '/');
    await this.ensureRemoteDirectory(remoteDir);
    await this.client.put(localPath, remotePath);
    console.log(`✓ Uploaded: ${localPath} -> ${remotePath}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.connect();
    try {
      await this.client.delete(remotePath);
      console.log(`✓ Deleted: ${remotePath}`);
    } catch (error: any) {
      // Ignore error if file doesn't exist
      if (error.code !== 2) {
        throw error;
      }
    }
  }

  async listFiles(remotePath: string): Promise<string[]> {
    await this.connect();
    try {
      const list = await this.client.list(remotePath);
      return list.map(item => item.name);
    } catch (error: any) {
      // Return empty array if directory doesn't exist
      if (error.code === 2) {
        return [];
      }
      throw error;
    }
  }

  async clearRemoteDirectory(remotePath: string): Promise<void> {
    await this.connect();
    try {
      const files = await this.listFiles(remotePath);
      if (files.length > 0) {
        console.log(`Clearing ${files.length} file(s) from ${remotePath}`);
        for (const file of files) {
          const filePath = `${remotePath}/${file}`.replace(/\\/g, '/');
          await this.deleteFile(filePath);
        }
        console.log(`✓ Directory cleared: ${remotePath}`);
      }
    } catch (error) {
      console.log(`clearRemoteDirectory: ${remotePath} - ${error instanceof Error ? error.message : 'Directory does not exist'}`);
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.connect();
    const localDir = path.dirname(localPath);
    await fs.mkdir(localDir, { recursive: true });
    await this.client.get(remotePath, localPath);
    console.log(`✓ Downloaded: ${remotePath} -> ${localPath}`);
  }

  async fileExists(remotePath: string): Promise<boolean> {
    await this.connect();
    try {
      await this.client.stat(remotePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let sftpInstance: SftpHelper | null = null;

export function getSftpClient(): SftpHelper {
  if (!sftpInstance) {
    sftpInstance = new SftpHelper();
  }
  return sftpInstance;
}

export async function closeSftpConnection(): Promise<void> {
  if (sftpInstance) {
    await sftpInstance.disconnect();
    sftpInstance = null;
  }
}
