import { validateArtifacts } from './validator';
import type { Artifact, SPDXSBOM, SLSAProvenance, Policy } from './types';

describe('validateArtifacts', () => {
  const mockArtifacts: Artifact[] = [
    { name: 'app:v1', type: 'image', digest: 'sha256:abc123' },
    { name: 'worker:v1', type: 'image', digest: 'sha256:def456' }
  ];

  const mockProvenances: SLSAProvenance[] = [
    {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'app:v1', digest: { sha256: 'abc123' } }],
      predicateType: 'https://slsa.dev/provenance/v1',
      predicate: {
        buildType: 'test',
        builder: { id: 'https://github.com/MyOrg/MyRepo/.github/workflows/release.yml@refs/tags/v1' },
        metadata: { buildStartedOn: '2026-05-02T09:00:00Z', buildFinishedOn: '2026-05-02T09:30:00Z' }
      }
    },
    {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'worker:v1', digest: { sha256: 'def456' } }],
      predicateType: 'https://slsa.dev/provenance/v1',
      predicate: {
        buildType: 'test',
        builder: { id: 'https://github.com/MyOrg/MyRepo/.github/workflows/release.yml@refs/tags/v1' },
        metadata: { buildStartedOn: '2026-05-02T09:00:00Z', buildFinishedOn: '2026-05-02T09:32:00Z' }
      }
    }
  ];

  const mockSBOM: SPDXSBOM = {
    spdxVersion: 'SPDX-2.3',
    name: 'test',
    documentNamespace: 'https://example.com/test',
    packages: [
      { name: 'app', versionInfo: '1.0', licenseConcluded: 'MIT', licenseDeclared: 'MIT' },
      { name: 'worker', versionInfo: '1.0', licenseConcluded: 'Apache-2.0', licenseDeclared: 'Apache-2.0' }
    ]
  };

  const mockPolicy: Policy = {
    version: '1.0',
    allowedBuilders: ['https://github.com/MyOrg/MyRepo/.github/workflows/release.yml@refs/tags/v1'],
    allowedLicenses: ['MIT', 'Apache-2.0'],
    signatureWindowHours: 720,
    requiredAttestations: ['slsa-provenance'],
    strict: false
  };

  it('should pass all checks for valid artifacts', () => {
    const violations = validateArtifacts(mockArtifacts, mockProvenances, mockSBOM, mockPolicy);
    expect(violations.filter(v => v.severity === 'error')).toHaveLength(0);
  });

  it('should detect duplicate digests', () => {
    const artifactsWithDuplicate: Artifact[] = [
      { name: 'app:v1', type: 'image', digest: 'sha256:samehash' },
      { name: 'app:v2', type: 'image', digest: 'sha256:samehash' }
    ];
    const violations = validateArtifacts(artifactsWithDuplicate, [], null, mockPolicy);
    expect(violations.some(v => v.rule === 'duplicate-digest')).toBe(true);
  });

  it('should detect missing provenance', () => {
    const artifactsWithMissing: Artifact[] = [
      { name: 'app:v1', type: 'image', digest: 'sha256:abc123' },
      { name: 'extra:v1', type: 'image', digest: 'sha256:missing' }
    ];
    const violations = validateArtifacts(artifactsWithMissing, mockProvenances, null, mockPolicy);
    expect(violations.some(v => v.rule === 'missing-provenance' && v.artifactName === 'extra:v1')).toBe(true);
  });

  it('should detect invalid builder', () => {
    const badProvenances = [{
      ...mockProvenances[0],
      predicate: {
        ...mockProvenances[0].predicate,
        builder: { id: 'https://github.com/EvilOrg/EvilRepo/.github/workflows/release.yml' }
      }
    }];
    const violations = validateArtifacts(mockArtifacts.slice(0, 1), badProvenances, null, mockPolicy);
    expect(violations.some(v => v.rule === 'invalid-builder' && v.severity === 'error')).toBe(true);
  });

  it('should detect timestamp out of order', () => {
    const badProvenances = [{
      ...mockProvenances[0],
      predicate: {
        ...mockProvenances[0].predicate,
        metadata: { buildStartedOn: '2026-05-02T10:00:00Z', buildFinishedOn: '2026-05-02T09:00:00Z' }
      }
    }];
    const violations = validateArtifacts(mockArtifacts.slice(0, 1), badProvenances, null, mockPolicy);
    expect(violations.some(v => v.rule === 'timestamp-out-of-order' && v.severity === 'error')).toBe(true);
  });

  it('should detect disallowed license', () => {
    const badSBOM = {
      ...mockSBOM,
      packages: [
        { name: 'app', versionInfo: '1.0', licenseConcluded: 'GPL-3.0', licenseDeclared: 'GPL-3.0' }
      ]
    };
    const violations = validateArtifacts(mockArtifacts, mockProvenances, badSBOM, mockPolicy);
    expect(violations.some(v => v.rule === 'disallowed-license' && v.severity === 'error')).toBe(true);
  });

  it('should detect missing license information', () => {
    const badSBOM = {
      ...mockSBOM,
      packages: [
        { name: 'app', versionInfo: '1.0', downloadLocation: 'NOASSERTION' }
      ]
    };
    const violations = validateArtifacts(mockArtifacts, mockProvenances, badSBOM, mockPolicy);
    expect(violations.some(v => v.rule === 'missing-license')).toBe(true);
  });
});
