import * as fs from 'fs';
import * as plist from 'plist';
import { execSync } from 'child_process';
import { MobileProvision } from './types';

export class ProvisionParser {
  static parse(filePath: string): MobileProvision {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Profile 文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(filePath);
    const plistContent = this.extractPlistFromPKCS7(content);
    
    if (!plistContent) {
      throw new Error(`无法从 Profile 中提取 plist 数据: ${filePath}`);
    }

    try {
      const data = plist.parse(plistContent) as Record<string, any>;
      return this.mapToMobileProvision(data, filePath);
    } catch (e) {
      throw new Error(`解析 Profile plist 失败: ${filePath}, 错误: ${e}`);
    }
  }

  private static extractPlistFromPKCS7(content: Buffer): string | null {
    const str = content.toString('utf8');
    const start = str.indexOf('<?xml');
    const end = str.indexOf('</plist>');
    
    if (start === -1 || end === -1) {
      return null;
    }
    
    return str.substring(start, end + 8);
  }

  private static mapToMobileProvision(data: Record<string, any>, filePath: string): MobileProvision {
    const applicationIdentifier = data['Entitlements']?.['application-identifier'] || '';
    const bundleId = this.extractBundleId(applicationIdentifier);
    
    const developerCertificates: string[] = [];
    if (Array.isArray(data['DeveloperCertificates'])) {
      data['DeveloperCertificates'].forEach((cert: Buffer) => {
        developerCertificates.push(cert.toString('base64'));
      });
    }

    return {
      filePath,
      name: data['Name'] || '',
      uuid: data['UUID'] || '',
      bundleId,
      teamId: data['TeamIdentifier']?.[0] || '',
      teamName: data['TeamName'] || '',
      expirationDate: data['ExpirationDate'] ? new Date(data['ExpirationDate']) : new Date(0),
      creationDate: data['CreationDate'] ? new Date(data['CreationDate']) : new Date(0),
      applicationIdentifier,
      entitlements: data['Entitlements'] || {},
      developerCertificates,
      provisionsAllDevices: data['ProvisionsAllDevices'],
      provisionedDevices: data['ProvisionedDevices']
    };
  }

  private static extractBundleId(applicationIdentifier: string): string {
    const parts = applicationIdentifier.split('.');
    if (parts.length <= 1) {
      return applicationIdentifier;
    }
    return parts.slice(1).join('.');
  }

  static parseDirectory(directory: string): MobileProvision[] {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
      throw new Error(`目录不存在或不是目录: ${directory}`);
    }

    const profiles: MobileProvision[] = [];
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
      if (file.endsWith('.mobileprovision')) {
        const fullPath = `${directory}/${file}`;
        try {
          profiles.push(this.parse(fullPath));
        } catch (e) {
          console.warn(`警告: 解析 Profile 失败 ${file}: ${e}`);
        }
      }
    });

    return profiles;
  }

  static parseFiles(paths: string[]): MobileProvision[] {
    const profiles: MobileProvision[] = [];
    
    paths.forEach(path => {
      try {
        const stat = fs.statSync(path);
        if (stat.isDirectory()) {
          profiles.push(...this.parseDirectory(path));
        } else if (path.endsWith('.mobileprovision')) {
          profiles.push(this.parse(path));
        }
      } catch (e) {
        console.warn(`警告: 处理路径失败 ${path}: ${e}`);
      }
    });

    return profiles;
  }
}
