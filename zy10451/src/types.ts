export interface PortMapping {
  hostPort: number;
  containerPort: number;
  protocol?: string;
  hostIp?: string;
  raw: string;
}

export interface ComposeService {
  name: string;
  image?: string;
  ports: PortMapping[];
  environment: Record<string, string | number | boolean | null>;
  file: string;
  line?: number;
}

export interface ComposeFile {
  path: string;
  services: ComposeService[];
  parseErrors: ParseError[];
}

export interface ParseError {
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface PortConflict {
  port: number;
  hostIp?: string;
  services: {
    name: string;
    file: string;
    containerPort: number;
    protocol?: string;
    line?: number;
  }[];
  severity: 'high' | 'medium' | 'low';
}

export interface ServiceNameConflict {
  name: string;
  services: {
    file: string;
    line?: number;
  }[];
}

export interface DetectionResult {
  composeFiles: string[];
  totalServices: number;
  totalPorts: number;
  portConflicts: PortConflict[];
  serviceNameConflicts: ServiceNameConflict[];
  parseErrors: ParseError[];
  scanTime: string;
}

export interface CLIOptions {
  paths: string[];
  outputDir: string;
  format: string[];
  verbose: boolean;
  strict: boolean;
}

export interface FixSuggestion {
  conflictType: 'port' | 'serviceName';
  priority: number;
  description: string;
  affectedFiles: string[];
  action: string;
}