export interface Artifact {
  name: string;
  type: 'image' | 'archive';
  digest: string;
  tags?: string[];
  path?: string;
}

export interface ArtifactsFile {
  version: string;
  artifacts: Artifact[];
  releaseDate?: string;
}

export interface SBOMLicense {
  licenseId?: string;
  name?: string;
}

export interface SBOMPackage {
  name: string;
  versionInfo?: string;
  downloadLocation?: string;
  licenseConcluded?: string;
  licenseDeclared?: string;
  licenses?: SBOMLicense[];
  checksums?: {
    algorithm: string;
    value: string;
  }[];
}

export interface SPDXSBOM {
  spdxVersion: string;
  name: string;
  documentNamespace: string;
  packages: SBOMPackage[];
}

export interface SLSAProvenance {
  _type: string;
  subject: {
    name?: string;
    digest: {
      [alg: string]: string;
    };
  }[];
  predicateType: string;
  predicate: {
    buildType: string;
    builder: {
      id: string;
    };
    invocation?: {
      configSource?: {
        uri?: string;
        digest?: {
          [alg: string]: string;
        };
      };
    };
    metadata?: {
      buildStartedOn?: string;
      buildFinishedOn?: string;
      completeness?: {
        [key: string]: boolean;
      };
      reproducible?: boolean;
    };
    materials?: {
      uri?: string;
      digest?: {
        [alg: string]: string;
      };
    }[];
  };
}

export interface Policy {
  version: string;
  allowedBuilders: string[];
  allowedLicenses: string[];
  signatureWindowHours: number;
  requiredAttestations: string[];
  strict?: boolean;
}

export interface Violation {
  artifactName?: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  details?: any;
}

export interface AuditResult {
  artifacts: Artifact[];
  provenances: SLSAProvenance[];
  sbom: SPDXSBOM | null;
  policy: Policy;
  violations: Violation[];
  summary: {
    totalArtifacts: number;
    passedChecks: number;
    failedChecks: number;
    warnings: number;
  };
}
