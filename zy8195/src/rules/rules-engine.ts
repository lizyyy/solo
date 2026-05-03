import { v4 as uuidv4 } from 'uuid';
import {
  ParsedCertificate,
  ValidationIssue,
  ValidationIssueType,
  ValidationSeverity,
  ValidationContext,
  CertInventoryItem,
  TrustBundle,
  TrustBundles,
  ServiceGraph,
  ServiceInfo,
} from '../types';
import { CertificateChainValidator } from '../x509/certificate-chain';

export interface RuleCheck {
  id: string;
  name: string;
  description: string;
  severity: ValidationSeverity;
  check: (context: RuleContext) => ValidationIssue[] | Promise<ValidationIssue[]>;
}

export interface RuleContext {
  service: CertInventoryItem;
  serviceInfo?: ServiceInfo;
  certificate: ParsedCertificate;
  allCertificates: Map<string, ParsedCertificate>;
  trustBundles: TrustBundles;
  serviceGraph: ServiceGraph;
  validationContext: ValidationContext;
}

export class RulesEngine {
  private chainValidator: CertificateChainValidator;
  private rules: RuleCheck[];

  constructor() {
    this.chainValidator = new CertificateChainValidator();
    this.rules = this.initializeRules();
  }

  private initializeRules(): RuleCheck[] {
    return [
      {
        id: 'validity_period',
        name: 'Validity Period Check',
        description: 'Check if certificate is within valid date range',
        severity: 'critical',
        check: this.checkValidityPeriod.bind(this),
      },
      {
        id: 'algorithm_strength',
        name: 'Algorithm Strength Check',
        description: 'Check if certificate uses secure algorithms',
        severity: 'high',
        check: this.checkAlgorithmStrength.bind(this),
      },
      {
        id: 'san_match',
        name: 'SAN Match Check',
        description: 'Check if certificate SANs match expected values',
        severity: 'high',
        check: this.checkSANMatch.bind(this),
      },
      {
        id: 'chain_validation',
        name: 'Certificate Chain Validation',
        description: 'Validate certificate chain to trusted root',
        severity: 'critical',
        check: this.checkCertificateChain.bind(this),
      },
      {
        id: 'trust_root_match',
        name: 'Trust Root Match',
        description: 'Check if certificate chains to expected trust bundle',
        severity: 'high',
        check: this.checkTrustRootMatch.bind(this),
      },
      {
        id: 'key_usage',
        name: 'Key Usage Check',
        description: 'Check if certificate has appropriate key usage extensions',
        severity: 'medium',
        check: this.checkKeyUsage.bind(this),
      },
      {
        id: 'service_name_match',
        name: 'Service Name Match',
        description: 'Check if certificate CN/SANs match service name pattern',
        severity: 'high',
        check: this.checkServiceNameMatch.bind(this),
      },
    ];
  }

  async validateService(
    service: CertInventoryItem,
    certificate: ParsedCertificate,
    allCertificates: Map<string, ParsedCertificate>,
    trustBundles: TrustBundles,
    serviceGraph: ServiceGraph,
    validationContext: ValidationContext
  ): Promise<ValidationIssue[]> {
    const serviceInfo = serviceGraph.services.find((s) => s.name === service.serviceName);

    const context: RuleContext = {
      service,
      serviceInfo,
      certificate,
      allCertificates,
      trustBundles,
      serviceGraph,
      validationContext,
    };

    const allIssues: ValidationIssue[] = [];

    for (const rule of this.rules) {
      try {
        const issues = await rule.check(context);
        allIssues.push(...issues);
      } catch (error) {
        console.error(`Rule ${rule.id} failed for service ${service.serviceName}:`, error);
        allIssues.push(
          this.createIssue(
            'unknown',
            rule.severity,
            service.serviceName,
            `Rule ${rule.name} execution failed`,
            `Check certificate configuration manually`,
            { error: String(error) }
          )
        );
      }
    }

    return allIssues;
  }

  private checkValidityPeriod(context: RuleContext): ValidationIssue[] {
    const result = this.chainValidator.checkValidityPeriod(
      context.certificate,
      context.validationContext
    );

    return result.issues.map((issue) => {
      const issueType = issue.type as ValidationIssueType;
      let severity: ValidationSeverity = 'medium';
      let recommendation = '';

      switch (issue.type) {
        case 'expired':
          severity = 'critical';
          recommendation = 'Certificate must be renewed immediately';
          break;
        case 'not_yet_valid':
          severity = 'high';
          recommendation = 'Check clock synchronization or certificate issue date';
          break;
        case 'expiring_soon':
          severity = 'medium';
          recommendation = 'Schedule certificate rotation in the upcoming maintenance window';
          break;
      }

      return this.createIssue(
        issueType,
        severity,
        context.service.serviceName,
        issue.message,
        recommendation,
        {
          validFrom: context.certificate.validFrom.toISOString(),
          validTo: context.certificate.validTo.toISOString(),
        }
      );
    });
  }

  private checkAlgorithmStrength(context: RuleContext): ValidationIssue[] {
    const result = this.chainValidator.checkAlgorithmStrength(
      context.certificate,
      context.validationContext
    );

    return result.issues.map((issue) =>
      this.createIssue(
        'weak_algorithm',
        'high',
        context.service.serviceName,
        issue.message,
        'Reissue certificate with strong algorithm (SHA256+ with RSA 2048+ or ECDSA)',
        {
          signatureAlgorithm: context.certificate.signatureAlgorithm,
          publicKeyAlgorithm: context.certificate.publicKeyAlgorithm,
          publicKeySize: context.certificate.publicKeySize,
        }
      )
    );
  }

  private checkSANMatch(context: RuleContext): ValidationIssue[] {
    if (context.service.expectedSANs.length === 0) {
      return [];
    }

    const result = this.chainValidator.checkSANMatch(
      context.certificate,
      context.service.expectedSANs
    );

    return result.issues.map((issue) =>
      this.createIssue(
        'san_mismatch',
        'high',
        context.service.serviceName,
        issue.message,
        'Reissue certificate with correct Subject Alternative Names',
        {
          expectedSANs: context.service.expectedSANs,
          actualSANs: {
            dns: context.certificate.sanDnsNames,
            ip: context.certificate.sanIpAddresses,
            uri: context.certificate.sanUris,
          },
        }
      )
    );
  }

  private async checkCertificateChain(context: RuleContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const allTrustRoots: ParsedCertificate[] = [];
    const allIntermediates: ParsedCertificate[] = [];

    for (const bundle of Object.values(context.trustBundles)) {
      for (const rootPath of bundle.rootCerts) {
        const rootCert = context.allCertificates.get(rootPath);
        if (rootCert) {
          allTrustRoots.push(rootCert);
        }
      }
      for (const intermediatePath of bundle.intermediateCerts) {
        const intermediateCert = context.allCertificates.get(intermediatePath);
        if (intermediateCert) {
          allIntermediates.push(intermediateCert);
        }
      }
    }

    for (const [, cert] of context.allCertificates) {
      if (cert.isCa && !allTrustRoots.some((r) => r.serialNumber === cert.serialNumber)) {
        allIntermediates.push(cert);
      }
    }

    const chain = await this.chainValidator.validateChain(
      context.certificate,
      allIntermediates,
      allTrustRoots,
      context.validationContext
    );

    if (!chain.isValid) {
      for (const error of chain.validationErrors) {
        if (error.includes('Missing intermediate')) {
          issues.push(
            this.createIssue(
              'missing_intermediate',
              'critical',
              context.service.serviceName,
              error,
              'Install missing intermediate certificate in trust store or certificate bundle',
              {
                issuer: context.certificate.issuer,
                issuerCN: context.certificate.issuerCN,
              }
            )
          );
        } else {
          issues.push(
            this.createIssue(
              'trust_chain_invalid',
              'critical',
              context.service.serviceName,
              error,
              'Verify certificate chain and trust store configuration',
              {
                leafSubject: context.certificate.subjectCN,
                leafIssuer: context.certificate.issuerCN,
              }
            )
          );
        }
      }
    }

    return issues;
  }

  private checkTrustRootMatch(context: RuleContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!context.serviceInfo) {
      return issues;
    }

    const expectedBundle = context.trustBundles[context.serviceInfo.trustBundle];
    if (!expectedBundle) {
      issues.push(
        this.createIssue(
          'trust_root_mismatch',
          'medium',
          context.service.serviceName,
          `Service references trust bundle "${context.serviceInfo.trustBundle}" which is not defined`,
          'Check trust_bundles.yaml configuration',
          { expectedBundle: context.serviceInfo.trustBundle }
        )
      );
      return issues;
    }

    const rootCNs = expectedBundle.rootCerts
      .map((path) => context.allCertificates.get(path)?.subjectCN)
      .filter(Boolean);

    let currentIssuer = context.certificate.issuerCN;
    const visitedIssuers = new Set<string>();

    while (currentIssuer && !visitedIssuers.has(currentIssuer)) {
      visitedIssuers.add(currentIssuer);

      if (rootCNs.includes(currentIssuer)) {
        return issues;
      }

      const nextCert = Array.from(context.allCertificates.values()).find(
        (c) => c.subjectCN === currentIssuer && c.isCa
      );

      if (!nextCert) {
        break;
      }

      currentIssuer = nextCert.issuerCN;
    }

    issues.push(
      this.createIssue(
        'trust_root_mismatch',
        'high',
        context.service.serviceName,
        `Certificate chain does not terminate in trust bundle "${context.serviceInfo.trustBundle}"`,
        `Ensure certificate chains to one of the trusted roots: ${rootCNs.join(', ')}`,
        {
          expectedBundle: context.serviceInfo.trustBundle,
          expectedRoots: rootCNs,
          actualRoot: currentIssuer,
        }
      )
    );

    return issues;
  }

  private checkKeyUsage(context: RuleContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const cert = context.certificate;

    if (cert.isCa) {
      if (!cert.keyUsage.includes('keyCertSign')) {
        issues.push(
          this.createIssue(
            'key_usage_issue',
            'medium',
            context.service.serviceName,
            'CA certificate missing keyCertSign key usage',
            'CA certificates should have keyCertSign key usage extension',
            { keyUsage: cert.keyUsage }
          )
        );
      }
    } else {
      if (cert.keyUsage.length === 0) {
        issues.push(
          this.createIssue(
            'key_usage_issue',
            'low',
            context.service.serviceName,
            'Certificate has no key usage extensions defined',
            'Consider adding appropriate key usage extensions for better security',
            {}
          )
        );
      }

      if (
        cert.extendedKeyUsage.length === 0 ||
        (!cert.extendedKeyUsage.includes('serverAuth') &&
          !cert.extendedKeyUsage.includes('clientAuth'))
      ) {
        issues.push(
          this.createIssue(
            'key_usage_issue',
            'medium',
            context.service.serviceName,
            'Certificate missing serverAuth or clientAuth extended key usage for mTLS',
            'Ensure certificate has appropriate extended key usage for mTLS communication',
            { extendedKeyUsage: cert.extendedKeyUsage }
          )
        );
      }
    }

    return issues;
  }

  private checkServiceNameMatch(context: RuleContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const serviceName = context.service.serviceName.toLowerCase();
    const cert = context.certificate;

    const allNames = [
      cert.subjectCN.toLowerCase(),
      ...cert.sanDnsNames.map((d) => d.toLowerCase()),
    ].filter(Boolean);

    if (allNames.length === 0) {
      issues.push(
        this.createIssue(
          'service_name_mismatch',
          'high',
          context.service.serviceName,
          'Certificate has no CN or DNS SANs to match against service name',
          'Reissue certificate with CN or DNS SAN matching service name',
          { serviceName: context.service.serviceName }
        )
      );
      return issues;
    }

    const matches = allNames.some((name) => {
      if (name === serviceName) {
        return true;
      }
      if (name.startsWith('*.')) {
        const wildcardDomain = name.substring(2);
        const serviceParts = serviceName.split('.');
        if (serviceParts.length >= 2) {
          const serviceDomain = serviceParts.slice(1).join('.');
          return serviceDomain === wildcardDomain;
        }
      }
      return serviceName.endsWith(`.${name}`);
    });

    if (!matches) {
      issues.push(
        this.createIssue(
          'service_name_mismatch',
          'high',
          context.service.serviceName,
          `Service name "${serviceName}" does not match certificate CN/SANs: ${allNames.join(', ')}`,
          'Reissue certificate with CN or SAN matching the service name',
          {
            serviceName: context.service.serviceName,
            certificateNames: allNames,
          }
        )
      );
    }

    return issues;
  }

  private createIssue(
    type: ValidationIssueType,
    severity: ValidationSeverity,
    serviceName: string,
    description: string,
    recommendation: string,
    metadata: Record<string, unknown>
  ): ValidationIssue {
    return {
      id: uuidv4(),
      type,
      severity,
      serviceName,
      description,
      recommendation,
      metadata,
    };
  }

  getRules(): RuleCheck[] {
    return this.rules;
  }
}
