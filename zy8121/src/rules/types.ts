import { ParsedSVG, ProcessRules, BarcodeItem, Issue } from '../types';

export interface RuleContext {
  svg: ParsedSVG;
  rules: ProcessRules;
  barcodes?: BarcodeItem[];
  orderInfo?: {
    orderId: string;
    productName: string;
  };
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  check: (context: RuleContext) => Issue[];
}

export type RuleCategory = 
  | 'viewbox' 
  | 'dieline' 
  | 'bleed' 
  | 'spot_color' 
  | 'registration' 
  | 'barcode'
  | 'dimension';
