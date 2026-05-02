import { Artifact, SPDXSBOM, SLSAProvenance, Policy, Violation, AuditResult } from './types';

export function validateArtifacts(
  artifacts: Artifact[],
  provenances: SLSAProvenance[],
  sbom: SPDXSBOM | null,
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];

  violations.push(...checkDuplicateDigests(artifacts));
  violations.push(...checkProvenanceMapping(artifacts, provenances, policy));
  violations.push(...checkBuilderIdentity(provenances, policy));
  violations.push(...checkTimeWindow(provenances, policy));
  violations.push(...checkTimestampsOrder(provenances));
  
  if (sbom) {
    violations.push(...checkLicenses(sbom, policy));
  }

  return violations;
}

function checkDuplicateDigests(artifacts: Artifact[]): Violation[] {
  const violations: Violation[] = [];
  const digestMap = new Map<string, string[]>();

  for (const artifact of artifacts) {
    if (!digestMap.has(artifact.digest)) {
      digestMap.set(artifact.digest, []);
    }
    digestMap.get(artifact.digest)!.push(artifact.name);
  }

  for (const [digest, names] of digestMap) {
    if (names.length > 1) {
      violations.push({
        rule: 'duplicate-digest',
        severity: 'warning',
        message: `Digest appears in multiple artifacts: ${names.join(', ')}`,
        details: { digest, artifacts: names }
      });
    }
  }

  return violations;
}

function checkProvenanceMapping(
  artifacts: Artifact[],
  provenances: SLSAProvenance[],
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];
  const provenanceDigests = new Set<string>();

  for (const prov of provenances) {
    for (const subject of prov.subject) {
      for (const digest of Object.values(subject.digest)) {
        provenanceDigests.add(digest);
      }
    }
  }

  for (const artifact of artifacts) {
    if (!provenanceDigests.has(artifact.digest)) {
      violations.push({
        artifactName: artifact.name,
        rule: 'missing-provenance',
        severity: policy.strict ? 'error' : 'warning',
        message: `No provenance attestation found for digest ${artifact.digest}`,
        details: { artifact: artifact.name, digest: artifact.digest }
      });
    }
  }

  return violations;
}

function checkBuilderIdentity(
  provenances: SLSAProvenance[],
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];

  for (const prov of provenances) {
    const builderId = prov.predicate.builder.id;
    const subjectNames = prov.subject.map(s => s.name || 'unknown').join(', ');
    
    const isAllowed = policy.allowedBuilders.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return regex.test(builderId);
      }
      return builderId === allowed;
    });

    if (!isAllowed) {
      violations.push({
        rule: 'invalid-builder',
        severity: 'error',
        message: `Builder ${builderId} not in allowed list for artifacts: ${subjectNames}`,
        details: { builder: builderId, allowed: policy.allowedBuilders }
      });
    }
  }

  return violations;
}

function checkTimeWindow(
  provenances: SLSAProvenance[],
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];
  const now = new Date();

  for (const prov of provenances) {
    const subjectNames = prov.subject.map(s => s.name || 'unknown').join(', ');
    const buildTimeStr = prov.predicate.metadata?.buildFinishedOn;
    
    if (!buildTimeStr) continue;

    const buildTime = new Date(buildTimeStr);
    const hoursDiff = (now.getTime() - buildTime.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > policy.signatureWindowHours) {
      violations.push({
        rule: 'time-window-exceeded',
        severity: 'warning',
        message: `Build time for ${subjectNames} is ${Math.round(hoursDiff)} hours old (exceeds ${policy.signatureWindowHours}h window)`,
        details: { buildTime: buildTimeStr, hoursDiff: Math.round(hoursDiff) }
      });
    }
  }

  return violations;
}

function checkTimestampsOrder(provenances: SLSAProvenance[]): Violation[] {
  const violations: Violation[] = [];

  for (const prov of provenances) {
    const subjectNames = prov.subject.map(s => s.name || 'unknown').join(', ');
    const started = prov.predicate.metadata?.buildStartedOn;
    const finished = prov.predicate.metadata?.buildFinishedOn;

    if (started && finished) {
      const startDate = new Date(started);
      const finishDate = new Date(finished);

      if (startDate > finishDate) {
        violations.push({
          rule: 'timestamp-out-of-order',
          severity: 'error',
          message: `Build started after it finished for artifacts: ${subjectNames}`,
          details: { started, finished }
        });
      }
    }
  }

  return violations;
}

function checkLicenses(
  sbom: SPDXSBOM,
  policy: Policy
): Violation[] {
  const violations: Violation[] = [];

  for (const pkg of sbom.packages) {
    const pkgLicenses: string[] = [];

    if (pkg.licenseConcluded) {
      pkgLicenses.push(pkg.licenseConcluded);
    }
    if (pkg.licenseDeclared) {
      pkgLicenses.push(pkg.licenseDeclared);
    }
    if (pkg.licenses) {
      for (const lic of pkg.licenses) {
        if (lic.licenseId) pkgLicenses.push(lic.licenseId);
        if (lic.name) pkgLicenses.push(lic.name);
      }
    }

    if (pkgLicenses.length === 0) {
      violations.push({
        rule: 'missing-license',
        severity: 'warning',
        message: `No license information for package: ${pkg.name}`,
        details: { package: pkg.name }
      });
    } else {
      const disallowed = pkgLicenses.filter(
        lic => !policy.allowedLicenses.includes(lic) && !policy.allowedLicenses.includes('*')
      );
      if (disallowed.length > 0) {
        violations.push({
          rule: 'disallowed-license',
          severity: 'error',
          message: `Package ${pkg.name} uses disallowed licenses: ${disallowed.join(', ')}`,
          details: { package: pkg.name, licenses: disallowed, allowed: policy.allowedLicenses }
        });
      }
    }
  }

  return violations;
}

export function createAuditResult(
  artifacts: Artifact[],
  provenances: SLSAProvenance[],
  sbom: SPDXSBOM | null,
  policy: Policy,
  violations: Violation[]
): AuditResult {
  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return {
    artifacts,
    provenances,
    sbom,
    policy,
    violations,
    summary: {
      totalArtifacts: artifacts.length,
      passedChecks: 5 - errorCount,
      failedChecks: errorCount,
      warnings: warningCount
    }
  };
}
