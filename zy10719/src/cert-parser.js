const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

class CertParser {
  constructor() {
    this.certs = new Map();
  }

  parseCertFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const certs = this.extractCertificates(content);
      
      if (certs.length === 0) {
        return {
          success: false,
          error: '未找到有效证书',
          filePath
        };
      }

      const parsedCerts = certs.map((pem, index) => {
        try {
          const cert = forge.pki.certificateFromPem(pem);
          return this.parseCertificate(cert, index, filePath);
        } catch (e) {
          return {
            success: false,
            error: `证书解析失败: ${e.message}`,
            index,
            filePath
          };
        }
      });

      return {
        success: true,
        filePath,
        certs: parsedCerts,
        chainLength: parsedCerts.length,
        chainComplete: this.isChainComplete(parsedCerts)
      };
    } catch (e) {
      return {
        success: false,
        error: `文件读取失败: ${e.message}`,
        filePath
      };
    }
  }

  extractCertificates(content) {
    const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
    return content.match(regex) || [];
  }

  parseCertificate(cert, index, filePath) {
    const subject = this.parseDN(cert.subject);
    const issuer = this.parseDN(cert.issuer);
    const sans = this.getSANs(cert);
    const validFrom = new Date(cert.validity.notBefore);
    const validTo = new Date(cert.validity.notAfter);
    const now = new Date();
    const daysRemaining = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

    const fingerprint = forge.md.sha256.create();
    fingerprint.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
    const fingerprintSha256 = fingerprint.digest().toHex().match(/.{2}/g).join(':');

    return {
      success: true,
      index,
      filePath,
      subject,
      issuer,
      commonName: subject.CN || '',
      sans,
      allDomains: [subject.CN, ...sans].filter(Boolean),
      validFrom,
      validTo,
      daysRemaining,
      isExpired: daysRemaining <= 0,
      isExpiringSoon: daysRemaining > 0 && daysRemaining <= 30,
      fingerprintSha256,
      serialNumber: cert.serialNumber,
      signatureAlgorithm: cert.signatureOid,
      publicKeyAlgorithm: cert.publicKey.algorithm,
      isCA: cert.getExtension('basicConstraints')?.cA || false,
      isWildcard: this.isWildcardDomain(subject.CN) || sans.some(s => this.isWildcardDomain(s))
    };
  }

  parseDN(dn) {
    const result = {};
    dn.attributes.forEach(attr => {
      const shortName = attr.name || attr.type;
      result[shortName] = attr.value;
    });
    return result;
  }

  getSANs(cert) {
    const sanExt = cert.getExtension('subjectAltName');
    if (!sanExt) return [];
    
    const sans = [];
    sanExt.altNames.forEach(name => {
      if (name.type === 2) {
        sans.push(name.value);
      }
    });
    return sans;
  }

  isWildcardDomain(domain) {
    return domain && domain.startsWith('*.');
  }

  isChainComplete(certs) {
    if (certs.length <= 1) return true;
    
    for (let i = 0; i < certs.length - 1; i++) {
      const child = certs[i];
      const parent = certs[i + 1];
      
      if (!child.success || !parent.success) continue;
      
      const childIssuerCN = child.issuer.CN;
      const parentSubjectCN = parent.subject.CN;
      
      if (childIssuerCN !== parentSubjectCN) {
        return false;
      }
    }
    return true;
  }

  loadCertificatesFromDir(dirPath) {
    const results = [];
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile() && /\.(pem|crt|cer|cert)$/i.test(file)) {
        const result = this.parseCertFile(filePath);
        results.push(result);
        
        if (result.success && result.certs.length > 0) {
          const leafCert = result.certs[0];
          if (leafCert.success && !leafCert.isCA) {
            leafCert.allDomains.forEach(domain => {
              if (!this.certs.has(domain)) {
                this.certs.set(domain, []);
              }
              this.certs.get(domain).push({
                domain,
                certInfo: leafCert,
                chainInfo: result,
                sourceFile: file
              });
            });
          }
        }
      }
    });
    
    return results;
  }

  findCertForDomain(domain) {
    if (this.certs.has(domain)) {
      return this.certs.get(domain);
    }
    
    const wildcardMatches = [];
    for (const [certDomain, certs] of this.certs.entries()) {
      if (this.isWildcardDomain(certDomain)) {
        const baseDomain = certDomain.substring(2);
        if (domain.endsWith(baseDomain) && domain !== baseDomain) {
          wildcardMatches.push(...certs);
        }
      }
    }
    
    return wildcardMatches.length > 0 ? wildcardMatches : null;
  }

  getAllCerts() {
    return Array.from(this.certs.values()).flat();
  }
}

module.exports = CertParser;
