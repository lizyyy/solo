import * as fs from 'fs';
import { execSync } from 'child_process';
import { CertificateInfo } from './types';

export class CertificateValidator {
  static parseFromFile(filePath: string, password?: string): CertificateInfo {
    if (!fs.existsSync(filePath)) {
      throw new Error(`证书文件不存在: ${filePath}`);
    }

    const ext = filePath.split('.').pop()?.toLowerCase();
    
    if (ext === 'p12' || ext === 'pfx') {
      return this.parseP12(filePath, password);
    } else if (ext === 'cer' || ext === 'crt' || ext === 'pem') {
      return this.parseCer(filePath);
    } else {
      throw new Error(`不支持的证书格式: ${ext}`);
    }
  }

  private static parseP12(filePath: string, password?: string): CertificateInfo {
    try {
      const pwdArg = password ? `-passin pass:${password}` : '-passin pass:';
      const output = execSync(
        `openssl pkcs12 -in "${filePath}" ${pwdArg} -nokeys -clcerts 2>/dev/null | openssl x509 -text -noout 2>/dev/null`,
        { encoding: 'utf8' }
      );
      return this.parseX509Output(output, filePath);
    } catch (e) {
      throw new Error(`解析 P12 证书失败 (可能需要密码): ${filePath}`);
    }
  }

  private static parseCer(filePath: string): CertificateInfo {
    try {
      const output = execSync(
        `openssl x509 -in "${filePath}" -inform DER -text -noout 2>/dev/null || openssl x509 -in "${filePath}" -inform PEM -text -noout 2>/dev/null`,
        { encoding: 'utf8' }
      );
      return this.parseX509Output(output, filePath);
    } catch (e) {
      throw new Error(`解析证书失败: ${filePath}`);
    }
  }

  private static parseX509Output(output: string, filePath: string): CertificateInfo {
    const lines = output.split('\n');
    const result: Partial<CertificateInfo> = {
      filePath,
      isValid: true,
      isExpired: false
    };

    let inValidity = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('Subject:')) {
        const cnMatch = line.match(/CN=([^,]+)/);
        if (cnMatch) {
          result.commonName = cnMatch[1].trim();
          result.name = cnMatch[1].trim();
        }
        
        const ouMatch = line.match(/OU=([^,]+)/);
        if (ouMatch) {
          result.teamId = ouMatch[1].trim();
        }
        
        const oMatch = line.match(/O=([^,]+)/);
        if (oMatch) {
          result.teamName = oMatch[1].trim();
        }
      }
      
      if (line.startsWith('Validity')) {
        inValidity = true;
        continue;
      }
      
      if (inValidity && line.startsWith('Not Before:')) {
        const dateStr = line.replace('Not Before:', '').trim();
        result.notBefore = new Date(dateStr);
      }
      
      if (inValidity && line.startsWith('Not After :')) {
        const dateStr = line.replace('Not After :', '').trim();
        result.notAfter = new Date(dateStr);
        inValidity = false;
      }
      
      if (line.startsWith('Serial Number:')) {
        const serialMatch = line.match(/Serial Number:\s*(.+)/);
        if (serialMatch) {
          result.serialNumber = serialMatch[1].trim();
        }
      }
    }

    result.type = this.detectCertificateType(result.commonName || '');
    
    const now = new Date();
    if (result.notBefore && result.notAfter) {
      result.isExpired = now > result.notAfter;
      result.isValid = now >= result.notBefore && now <= result.notAfter;
    }

    return result as CertificateInfo;
  }

  private static detectCertificateType(commonName: string): 'development' | 'distribution' | 'unknown' {
    const cn = commonName.toLowerCase();
    if (cn.includes('development') || cn.includes('iphone developer')) {
      return 'development';
    }
    if (cn.includes('distribution') || cn.includes('iphone distribution') || cn.includes('apple distribution')) {
      return 'distribution';
    }
    return 'unknown';
  }

  static getDaysUntilExpiration(cert: CertificateInfo): number {
    const now = new Date();
    const diff = cert.notAfter.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  static isExpiringSoon(cert: CertificateInfo, days: number): boolean {
    const daysLeft = this.getDaysUntilExpiration(cert);
    return daysLeft <= days && daysLeft > 0;
  }

  static parseDirectory(directory: string, password?: string): CertificateInfo[] {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
      throw new Error(`目录不存在或不是目录: ${directory}`);
    }

    const certs: CertificateInfo[] = [];
    const files = fs.readdirSync(directory);
    const validExts = ['.p12', '.pfx', '.cer', '.crt', '.pem'];
    
    files.forEach(file => {
      const ext = '.' + file.split('.').pop()?.toLowerCase();
      if (validExts.includes(ext)) {
        const fullPath = `${directory}/${file}`;
        try {
          certs.push(this.parseFromFile(fullPath, password));
        } catch (e) {
          console.warn(`警告: 解析证书失败 ${file}: ${e}`);
        }
      }
    });

    return certs;
  }

  static parseFiles(paths: string[], password?: string): CertificateInfo[] {
    const certs: CertificateInfo[] = [];
    const validExts = ['.p12', '.pfx', '.cer', '.crt', '.pem'];
    
    paths.forEach(path => {
      try {
        const stat = fs.statSync(path);
        if (stat.isDirectory()) {
          certs.push(...this.parseDirectory(path, password));
        } else {
          const ext = '.' + path.split('.').pop()?.toLowerCase();
          if (validExts.includes(ext)) {
            certs.push(this.parseFromFile(path, password));
          }
        }
      } catch (e) {
        console.warn(`警告: 处理路径失败 ${path}: ${e}`);
      }
    });

    return certs;
  }
}
