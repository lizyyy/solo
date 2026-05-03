import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';
import { ParsedCertificate } from '../types';

export class PemParser {
  async parseCertificateFile(filePath: string): Promise<ParsedCertificate> {
    const pemContent = await fs.promises.readFile(filePath, 'utf-8');
    return this.parsePemContent(pemContent, filePath);
  }

  parsePemContent(pemContent: string, filePath?: string): ParsedCertificate {
    const cert = forge.pki.certificateFromPem(pemContent);
    
    return this.extractCertificateInfo(cert, pemContent, filePath);
  }

  private extractCertificateInfo(
    cert: forge.pki.Certificate,
    pemContent: string,
    filePath?: string
  ): ParsedCertificate {
    const subjectCN = this.getCommonName(cert.subject);
    const issuerCN = this.getCommonName(cert.issuer);

    return {
      pem: pemContent,
      subject: cert.subject.toString(),
      subjectCN,
      issuer: cert.issuer.toString(),
      issuerCN,
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      signatureAlgorithm: this.getSignatureAlgorithm(cert),
      publicKeyAlgorithm: this.getPublicKeyAlgorithm(cert),
      publicKeySize: this.getPublicKeySize(cert),
      sanDnsNames: this.getSanDnsNames(cert),
      sanIpAddresses: this.getSanIpAddresses(cert),
      sanEmailAddresses: this.getSanEmailAddresses(cert),
      sanUris: this.getSanUris(cert),
      isCa: this.getIsCa(cert),
      keyUsage: this.getKeyUsage(cert),
      extendedKeyUsage: this.getExtendedKeyUsage(cert),
      certificatePath: filePath,
    };
  }

  private getCommonName(attr: forge.pki.Certificate['subject']): string {
    const cns = attr.getField('CN');
    if (Array.isArray(cns)) {
      return cns.map((cn) => cn.value).join(', ');
    }
    return cns ? String(cns.value) : '';
  }

  private getSignatureAlgorithm(cert: forge.pki.Certificate): string {
    const sigOid = cert.siginfo.algorithmOid;
    return this.mapOidToAlgorithm(sigOid);
  }

  private getPublicKeyAlgorithm(cert: forge.pki.Certificate): string {
    const key = cert.publicKey;
    if ('e' in key) {
      return 'RSA';
    }
    if ('curve' in key) {
      return 'ECDSA';
    }
    return 'UNKNOWN';
  }

  private getPublicKeySize(cert: forge.pki.Certificate): number {
    const key = cert.publicKey;
    if ('n' in key) {
      return (key.n as forge.jsbn.BigInteger).bitLength();
    }
    return 0;
  }

  private getSanDnsNames(cert: forge.pki.Certificate): string[] {
    const ext = cert.getExtension('subjectAltName');
    if (!ext) return [];
    
    const names: string[] = [];
    const altNames = (ext as { altNames?: Array<{ type: number; value: string }> }).altNames || [];
    
    for (const name of altNames) {
      if (name.type === 2) {
        names.push(name.value);
      }
    }
    return names;
  }

  private getSanIpAddresses(cert: forge.pki.Certificate): string[] {
    const ext = cert.getExtension('subjectAltName');
    if (!ext) return [];
    
    const names: string[] = [];
    const altNames = (ext as { altNames?: Array<{ type: number; ip: string }> }).altNames || [];
    
    for (const name of altNames) {
      if (name.type === 7 && name.ip) {
        names.push(name.ip);
      }
    }
    return names;
  }

  private getSanEmailAddresses(cert: forge.pki.Certificate): string[] {
    const ext = cert.getExtension('subjectAltName');
    if (!ext) return [];
    
    const names: string[] = [];
    const altNames = (ext as { altNames?: Array<{ type: number; value: string }> }).altNames || [];
    
    for (const name of altNames) {
      if (name.type === 1) {
        names.push(name.value);
      }
    }
    return names;
  }

  private getSanUris(cert: forge.pki.Certificate): string[] {
    const ext = cert.getExtension('subjectAltName');
    if (!ext) return [];
    
    const names: string[] = [];
    const altNames = (ext as { altNames?: Array<{ type: number; value: string }> }).altNames || [];
    
    for (const name of altNames) {
      if (name.type === 6) {
        names.push(name.value);
      }
    }
    return names;
  }

  private getIsCa(cert: forge.pki.Certificate): boolean {
    const ext = cert.getExtension('basicConstraints');
    if (!ext) return false;
    return (ext as { cA?: boolean }).cA === true;
  }

  private getKeyUsage(cert: forge.pki.Certificate): string[] {
    const ext = cert.getExtension('keyUsage');
    if (!ext) return [];
    
    const usages: string[] = [];
    const keyUsageExt = ext as {
      digitalSignature?: boolean;
      nonRepudiation?: boolean;
      keyEncipherment?: boolean;
      dataEncipherment?: boolean;
      keyAgreement?: boolean;
      keyCertSign?: boolean;
      cRLSign?: boolean;
      encipherOnly?: boolean;
      decipherOnly?: boolean;
    };

    if (keyUsageExt.digitalSignature) usages.push('digitalSignature');
    if (keyUsageExt.nonRepudiation) usages.push('nonRepudiation');
    if (keyUsageExt.keyEncipherment) usages.push('keyEncipherment');
    if (keyUsageExt.dataEncipherment) usages.push('dataEncipherment');
    if (keyUsageExt.keyAgreement) usages.push('keyAgreement');
    if (keyUsageExt.keyCertSign) usages.push('keyCertSign');
    if (keyUsageExt.cRLSign) usages.push('cRLSign');
    if (keyUsageExt.encipherOnly) usages.push('encipherOnly');
    if (keyUsageExt.decipherOnly) usages.push('decipherOnly');

    return usages;
  }

  private getExtendedKeyUsage(cert: forge.pki.Certificate): string[] {
    const ext = cert.getExtension('extKeyUsage');
    if (!ext) return [];

    const usages: string[] = [];
    const extKeyUsage = ext as { serverAuth?: boolean; clientAuth?: boolean; codeSigning?: boolean; emailProtection?: boolean; timeStamping?: boolean; ocspSigning?: boolean };

    if (extKeyUsage.serverAuth) usages.push('serverAuth');
    if (extKeyUsage.clientAuth) usages.push('clientAuth');
    if (extKeyUsage.codeSigning) usages.push('codeSigning');
    if (extKeyUsage.emailProtection) usages.push('emailProtection');
    if (extKeyUsage.timeStamping) usages.push('timeStamping');
    if (extKeyUsage.ocspSigning) usages.push('ocspSigning');

    return usages;
  }

  private mapOidToAlgorithm(oid: string): string {
    const oidMap: Record<string, string> = {
      '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
      '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
      '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
      '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
      '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
      '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
      '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
    };
    return oidMap[oid] || oid;
  }

  async parseDirectory(dirPath: string): Promise<Map<string, ParsedCertificate>> {
    const certificates = new Map<string, ParsedCertificate>();
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        continue;
      }

      const filePath = path.join(dirPath, entry.name);
      const ext = path.extname(entry.name).toLowerCase();

      if (ext === '.pem' || ext === '.crt' || ext === '.cer') {
        try {
          const cert = await this.parseCertificateFile(filePath);
          certificates.set(filePath, cert);
        } catch (error) {
          console.warn(`Failed to parse certificate ${filePath}:`, error);
        }
      }
    }

    return certificates;
  }

  async parseMultipleFiles(filePaths: string[]): Promise<Map<string, ParsedCertificate>> {
    const certificates = new Map<string, ParsedCertificate>();

    for (const filePath of filePaths) {
      try {
        const cert = await this.parseCertificateFile(filePath);
        certificates.set(filePath, cert);
      } catch (error) {
        console.warn(`Failed to parse certificate ${filePath}:`, error);
      }
    }

    return certificates;
  }
}
