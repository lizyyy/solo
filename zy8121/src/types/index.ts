export interface OrderRecord {
  orderId: string;
  productName: string;
  customer: string;
  dueDate: string;
  material: string;
  quantity: number;
  notes?: string;
}

export interface SVGPath {
  id?: string;
  d: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
}

export interface SVGElement {
  type: 'path' | 'circle' | 'rect' | 'line' | 'text';
  id?: string;
  attributes: Record<string, string>;
}

export interface ParsedSVG {
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  width?: number;
  height?: number;
  unit?: string;
  elements: SVGElement[];
  paths: SVGPath[];
  rawContent: string;
}

export interface ProcessRule {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface ProcessRules {
  bleed: {
    margin: number;
    unit: string;
  };
  spotColors: {
    allowedPrefixes: string[];
    caseSensitive: boolean;
  };
  registrationMarks: {
    required: boolean;
    size: {
      min: number;
      max: number;
    };
    positionTolerance: number;
  };
  barcode: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    quietZone: number;
  };
  dieline: {
    strokeColor: string;
    strokeWidth: number;
    mustBeClosed: boolean;
  };
  customRules?: ProcessRule[];
}

export interface BarcodeItem {
  id: string;
  type: 'EAN13' | 'CODE128' | 'QR' | 'UPC';
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  details?: Record<string, unknown>;
  location?: {
    x?: number;
    y?: number;
    elementId?: string;
  };
  suggestion?: string;
}

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface ValidationResult {
  orderId: string;
  timestamp: string;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  issues: Issue[];
  metadata: {
    svgFileName?: string;
    orderFileName?: string;
    rulesFileName?: string;
    barcodesFileName?: string;
  };
}
