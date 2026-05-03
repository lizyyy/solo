export interface CertInventoryItem {
  serviceName: string;
  certFilePath: string;
  keyFilePath: string;
  rotationBatch: string;
  expectedSANs: string[];
}

export interface TrustBundle {
  name: string;
  rootCerts: string[];
  intermediateCerts: string[];
  services: string[];
}

export interface TrustBundles {
  [bundleName: string]: TrustBundle;
}

export interface ServiceGraph {
  services: ServiceInfo[];
  relationships: ServiceRelationship[];
}

export interface ServiceInfo {
  name: string;
  trustBundle: string;
  endpoint: string;
}

export interface ServiceRelationship {
  client: string;
  server: string;
  protocol: string;
  requiresMtls: boolean;
}

export interface ParsedCertificate {
  pem: string;
  subject: string;
  subjectCN: string;
  issuer: string;
  issuerCN: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number;
  sanDnsNames: string[];
  sanIpAddresses: string[];
  sanEmailAddresses: string[];
  sanUris: string[];
  isCa: boolean;
  keyUsage: string[];
  extendedKeyUsage: string[];
  certificatePath?: string;
}

export interface CertificateChain {
  leaf: ParsedCertificate;
  intermediates: ParsedCertificate[];
  root?: ParsedCertificate;
  isValid: boolean;
  validationErrors: string[];
}

export interface ValidationIssue {
  id: string;
  type: ValidationIssueType;
  severity: ValidationSeverity;
  serviceName: string;
  description: string;
  recommendation: string;
  metadata: Record<string, unknown>;
}

export type ValidationIssueType = 
  | 'missing_intermediate'
  | 'service_name_mismatch'
  | 'clock_skew'
  | 'expiring_soon'
  | 'expired'
  | 'not_yet_valid'
  | 'weak_algorithm'
  | 'trust_chain_invalid'
  | 'san_mismatch'
  | 'trust_root_mismatch'
  | 'key_usage_issue'
  | 'unknown';

export type ValidationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RotationPlanItem {
  serviceName: string;
  batch: string;
  issues: string[];
  priority: 'immediate' | 'next' | 'later';
  dependencies: string[];
  recommendedAction: string;
}

export interface TrustGraphNode {
  id: string;
  label: string;
  type: 'service' | 'root' | 'intermediate';
  metadata: Record<string, unknown>;
}

export interface TrustGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'trusts' | 'uses' | 'signs';
  metadata: Record<string, unknown>;
}

export interface TrustGraph {
  nodes: TrustGraphNode[];
  edges: TrustGraphEdge[];
}

export interface ValidationContext {
  now: Date;
  clockSkewTolerance: number;
  expirationWarningDays: number;
  allowedAlgorithms: string[];
  allowedKeySizes: number[];
}

export interface ParsedInputs {
  certInventory: CertInventoryItem[];
  trustBundles: TrustBundles;
  serviceGraph: ServiceGraph;
  certificates: Map<string, ParsedCertificate>;
}
