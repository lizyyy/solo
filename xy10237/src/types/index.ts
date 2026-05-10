export type MaterialType = 'invoice' | 'composition' | 'declaration';

export type CheckStatus = 'passed' | 'failed' | 'pending' | 'manual_review';

export type SampleType = 
  | 'electronic'
  | 'textile'
  | 'chemical'
  | 'food'
  | 'medical'
  | 'general';

export interface Material {
  id: string;
  type: MaterialType;
  name: string;
  filePath: string;
  uploadedAt: string;
  valid: boolean;
  notes?: string;
}

export interface Sample {
  id: string;
  name: string;
  type: SampleType;
  description: string;
  originCountry: string;
  destinationCountry: string;
  value: number;
  currency: string;
  quantity: number;
  materials: Material[];
  createdAt: string;
  updatedAt: string;
}

export interface CountryRule {
  countryCode: string;
  countryName: string;
  requiredMaterials: MaterialType[];
  additionalRequirements?: AdditionalRequirement[];
  restrictions?: string[];
  valueThreshold?: number;
  notes?: string;
}

export interface AdditionalRequirement {
  name: string;
  description: string;
  mandatory: boolean;
}

export interface CheckItem {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

export interface CheckResult {
  id: string;
  sampleId: string;
  sampleName: string;
  destinationCountry: string;
  status: CheckStatus;
  checkItems: CheckItem[];
  errors: string[];
  warnings: string[];
  missingMaterials: MaterialType[];
  checkedAt: string;
  runNumber: number;
}

export interface CheckHistory {
  sampleId: string;
  results: CheckResult[];
}

export interface StorageConfig {
  dataDir: string;
}
