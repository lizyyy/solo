import * as forge from 'node-forge';
import { ParsedCertificate, CertificateChain, ValidationContext } from '../types';
import { PemParser } from '../parsers/pem-parser';

export class CertificateChainValidator {
  private pemParser: PemParser;

  constructor() {
    this.pemParser = new PemParser();
  }

  async validateChain(
    leafCert: ParsedCertificate,
    intermediateCerts: ParsedCertificate[],
    rootCerts: ParsedCertificate[],
    context: ValidationContext
  ): Promise<CertificateChain> {
    const validationErrors: string[] = [];
    const orderedIntermediates: ParsedCertificate[] = [];

    let currentCert = leafCert;
    const processedCerts = new Set<string>();

    while (true) {
      const issuerCN = currentCert.issuerCN;
      const issuer = currentCert.issuer;

      if (processedCerts.has(currentCert.serialNumber)) {
        validationErrors.push('Certificate chain contains a cycle');
        break;
      }
      processedCerts.add(currentCert.serialNumber);

      if (currentCert.isCa && currentCert.issuerCN === currentCert.subjectCN) {
        const rootMatch = rootCerts.find(
          (root) => root.serialNumber === currentCert.serialNumber
        );
        if (rootMatch) {
          return {
            leaf: leafCert,
            intermediates: orderedIntermediates.slice(0, -1),
            root: currentCert,
            isValid: validationErrors.length === 0,
            validationErrors,
          };
        }
        validationErrors.push('Self-signed certificate not in trusted roots');
        break;
      }

      const nextCert = this.findIssuer(
        issuer,
        issuerCN,
        [...intermediateCerts, ...rootCerts]
      );

      if (!nextCert) {
        validationErrors.push(
          `Missing intermediate certificate: issuer ${issuerCN || issuer}`
        );
        break;
      }

      const isRoot = rootCerts.some(
        (root) => root.serialNumber === nextCert.serialNumber
      );

      if (isRoot) {
        return {
          leaf: leafCert,
          intermediates: orderedIntermediates,
          root: nextCert,
          isValid: validationErrors.length === 0,
          validationErrors,
        };
      }

      orderedIntermediates.push(nextCert);
      currentCert = nextCert;
    }

    return {
      leaf: leafCert,
      intermediates: orderedIntermediates,
      root: undefined,
      isValid: validationErrors.length === 0,
      validationErrors,
    };
  }

  private findIssuer(
    issuer: string,
    issuerCN: string,
    candidates: ParsedCertificate[]
  ): ParsedCertificate | undefined {
    return candidates.find((candidate) => {
      if (candidate.subject === issuer) {
        return true;
      }
      if (issuerCN && candidate.subjectCN === issuerCN) {
        return true;
      }
      return false;
    });
  }

  verifyCertificateSignature(
    childCert: ParsedCertificate,
    parentCert: ParsedCertificate
  ): boolean {
    try {
      const child = forge.pki.certificateFromPem(childCert.pem);
      const parent = forge.pki.certificateFromPem(parentCert.pem);

      return child.verify(parent as unknown as forge.pki.Certificate);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  checkValidityPeriod(
    cert: ParsedCertificate,
    context: ValidationContext
  ): { 
    isValid: boolean; 
    issues: { type: string; message: string }[] 
  } {
    const issues: { type: string; message: string }[] = [];
    const now = context.now;
    const clockSkewMs = context.clockSkewTolerance * 60 * 1000;

    const effectiveNow = now.getTime();
    const validFrom = cert.validFrom.getTime();
    const validTo = cert.validTo.getTime();

    if (effectiveNow < validFrom - clockSkewMs) {
      issues.push({
        type: 'not_yet_valid',
        message: `Certificate not yet valid. Valid from: ${cert.validFrom.toISOString()}`,
      });
    }

    if (effectiveNow > validTo + clockSkewMs) {
      issues.push({
        type: 'expired',
        message: `Certificate has expired. Valid until: ${cert.validTo.toISOString()}`,
      });
    } else {
      const daysUntilExpiry = (validTo - effectiveNow) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry <= context.expirationWarningDays) {
        issues.push({
          type: 'expiring_soon',
          message: `Certificate expires in ${Math.ceil(daysUntilExpiry)} days`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  checkAlgorithmStrength(
    cert: ParsedCertificate,
    context: ValidationContext
  ): { 
    isValid: boolean; 
    issues: { type: string; message: string }[] 
  } {
    const issues: { type: string; message: string }[] = [];

    const sigAlg = cert.signatureAlgorithm.toLowerCase();
    const allowedAlgs = context.allowedAlgorithms.map((a) => a.toLowerCase());

    if (!allowedAlgs.some((alg) => sigAlg.includes(alg))) {
      issues.push({
        type: 'weak_algorithm',
        message: `Disallowed signature algorithm: ${cert.signatureAlgorithm}`,
      });
    }

    if (sigAlg.includes('sha1')) {
      issues.push({
        type: 'weak_algorithm',
        message: `Weak signature algorithm (SHA1): ${cert.signatureAlgorithm}`,
      });
    }

    if (cert.publicKeyAlgorithm === 'RSA') {
      if (cert.publicKeySize < 2048) {
        issues.push({
          type: 'weak_algorithm',
          message: `Weak RSA key size: ${cert.publicKeySize} bits (minimum 2048 required)`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  checkSANMatch(
    cert: ParsedCertificate,
    expectedSANs: string[]
  ): { 
    isValid: boolean; 
    issues: { type: string; message: string }[] 
  } {
    const issues: { type: string; message: string }[] = [];
    const actualSANs = [
      ...cert.sanDnsNames,
      ...cert.sanIpAddresses,
      ...cert.sanUris,
    ];

    for (const expectedSAN of expectedSANs) {
      const matches = actualSANs.some((actualSAN) =>
        this.matchSAN(expectedSAN, actualSAN)
      );

      if (!matches) {
        issues.push({
          type: 'san_mismatch',
          message: `Expected SAN "${expectedSAN}" not found in certificate. Actual SANs: ${actualSANs.join(', ') || 'none'}`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private matchSAN(expected: string, actual: string): boolean {
    if (expected === actual) {
      return true;
    }

    if (expected.startsWith('*.')) {
      const wildcardDomain = expected.substring(2);
      const actualParts = actual.split('.');
      
      if (actualParts.length >= 2) {
        const actualDomain = actualParts.slice(1).join('.');
        if (actualDomain === wildcardDomain) {
          return true;
        }
      }
    }

    return false;
  }
}
