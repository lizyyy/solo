export interface MemoryRegion {
  name: string;
  origin: bigint;
  length: bigint;
  type: 'FLASH' | 'RAM' | 'OTP' | 'RESERVED';
  attributes?: string;
}

export interface Section {
  name: string;
  address: bigint;
  size: bigint;
  fileOffset?: bigint;
  memoryRegion?: string;
  symbols: SymbolInfo[];
}

export interface SymbolInfo {
  name: string;
  address: bigint;
  size: bigint;
  type: 'CODE' | 'DATA' | 'BSS' | 'RODATA' | 'UNKNOWN';
  file?: string;
}

export interface LinkerMap {
  memoryRegions: Map<string, MemoryRegion>;
  sections: Section[];
  entryPoint?: bigint;
}

export interface MemoryRegionConfig {
  name: string;
  origin: string;
  length: string;
  type: 'FLASH' | 'RAM' | 'OTP' | 'RESERVED';
  attributes?: string;
}

export interface MemoryRegionsYaml {
  memoryRegions: MemoryRegionConfig[];
  metadata?: {
    device: string;
    architecture: string;
    totalFlash: string;
    totalRam: string;
  };
}

export interface FeatureEntry {
  featureName: string;
  enabled: boolean;
  memoryImpact: {
    flashDelta: number;
    ramDelta: number;
  };
  dependencies?: string[];
  description?: string;
}

export interface FeaturesCsv {
  features: FeatureEntry[];
}

export interface BootloaderConstraints {
  bootloaderReserved: {
    flash: {
      start: string;
      end: string;
    };
    ram?: {
      start: string;
      end: string;
    };
  };
  otaPartitions: {
    name: string;
    start: string;
    end: string;
    minFreeRequired: string;
  }[];
  rollbackConfig?: {
    maxFlashMargin: string;
    criticalFeatures: string[];
  };
}

export type IssueType = 
  | 'FLASH_OVERFLOW'
  | 'RAM_OVERFLOW'
  | 'BOOTLOADER_OVERLAP'
  | 'OTA_INSUFFICIENT'
  | 'ROLLBACK_RISK'
  | 'SECTION_CROSS_REGION'
  | 'SECTION_OUT_OF_BOUNDS'
  | 'CONFIG_ERROR'
  | 'PARSE_ERROR';

export interface Issue {
  id: string;
  type: IssueType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  affectedRegion?: string;
  address?: bigint;
  size?: bigint;
  details?: Record<string, unknown>;
}

export interface MemoryReport {
  generatedAt: Date;
  summary: {
    flash: {
      total: bigint;
      used: bigint;
      free: bigint;
      utilization: number;
    };
    ram: {
      total: bigint;
      used: bigint;
      free: bigint;
      utilization: number;
    };
  };
  regions: {
    name: string;
    type: string;
    origin: bigint;
    length: bigint;
    used: bigint;
    free: bigint;
    utilization: number;
    sections: {
      name: string;
      address: bigint;
      size: bigint;
    }[];
  }[];
  issues: Issue[];
  features?: {
    enabled: FeatureEntry[];
    disabled: FeatureEntry[];
    rollbackRisk?: {
      canRollback: boolean;
      maxFlashNeeded: bigint;
      availableFlash: bigint;
      criticalFeatures: string[];
    };
  };
  otaStatus?: {
    partitions: {
      name: string;
      start: bigint;
      end: bigint;
      used: bigint;
      free: bigint;
      minRequired: bigint;
      status: 'OK' | 'WARNING' | 'CRITICAL';
    }[];
  };
}

export interface ProcessedRegion extends MemoryRegion {
  used: bigint;
  free: bigint;
  utilization: number;
  sections: Section[];
}

export interface OTAPartitionStatus {
  name: string;
  start: bigint;
  end: bigint;
  used: bigint;
  free: bigint;
  minRequired: bigint;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface FeatureStatus {
  enabled: {
    featureName: string;
    memoryImpact: {
      flashDelta: number;
      ramDelta: number;
    };
  }[];
  disabled: {
    featureName: string;
    memoryImpact: {
      flashDelta: number;
      ramDelta: number;
    };
  }[];
  rollbackRisk?: {
    canRollback: boolean;
    maxFlashNeeded: bigint;
    availableFlash: bigint;
    criticalFeatures: string[];
  };
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}
