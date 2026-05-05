export interface Order {
  orderId: string;
  sku: string;
  quantity: number;
  orderTime: string;
  customerType: 'B2C' | 'B2B' | 'VIP';
  shippingMethod: string;
  weight: number;
  volume: number;
}

export interface SkuTag {
  sku: string;
  tags: string[];
}

export interface ZoneCapacity {
  zoneId: string;
  zoneName: string;
  maxOrders: number;
  maxWeight: number;
  maxVolume: number;
  supportedTags: string[];
  excludedTags: string[];
  priority: number;
}

export type ConditionOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'in' | 'notIn';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | (string | number | boolean)[];
}

export type ActionType = 'assignZone' | 'setPriority' | 'excludeZone' | 'setWaveLabel' | 'hold';

export interface Action {
  type: ActionType;
  value: string | number | string[];
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  priority: number;
  conditions: Condition[];
  conditionLogic: 'AND' | 'OR';
  actions: Action[];
  mutuallyExclusiveTags: string[];
  isDefault: boolean;
  enabled: boolean;
}

export interface ValidationError {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  ruleId?: string;
  zoneId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

export enum ConflictType {
  SAME_PRIORITY_MULTIPLE_RULES = 'same_priority_multiple_rules',
  CAPACITY_BOUNDARY = 'capacity_boundary',
  MUTUALLY_EXCLUSIVE_TAGS = 'mutually_exclusive_tags',
  COLD_CHAIN_CONFLICT = 'cold_chain_conflict',
  LARGE_ITEM_CONFLICT = 'large_item_conflict',
  ZONE_EXCLUSION = 'zone_exclusion',
  DEFAULT_FALLBACK = 'default_fallback'
}

export interface Conflict {
  type: ConflictType;
  orderId: string;
  ruleIds: string[];
  zoneIds: string[];
  description: string;
  severity: 'high' | 'medium' | 'low';
  resolvedBy: 'rule_selection' | 'capacity_overflow' | 'exclusion_fallback' | 'default_rule';
  resolutionReason: string;
}

export interface OrderMatchTrace {
  orderId: string;
  matchedRules: {
    ruleId: string;
    ruleName: string;
    priority: number;
    matchedConditions: number;
    totalConditions: number;
    actions: Action[];
  }[];
  assignedZone: string | null;
  waveLabel: string | null;
  conflicts: Conflict[];
  finalDecision: {
    ruleId: string;
    zoneId: string;
    reason: string;
  } | null;
}

export interface ZoneUsage {
  zoneId: string;
  ordersAssigned: number;
  weightUsed: number;
  volumeUsed: number;
  capacityPercentage: number;
  isOverflow: boolean;
  overflowOrders: string[];
}

export interface SimulationResult {
  totalOrders: number;
  ordersWithConflicts: number;
  conflictCountByType: Record<ConflictType, number>;
  orderTraces: OrderMatchTrace[];
  zoneUsage: ZoneUsage[];
  validationResult: ValidationResult;
}

export interface ConflictCase {
  orderId: string;
  conflictType: string;
  rules: string;
  zones: string;
  description: string;
  severity: string;
  resolvedBy: string;
  resolutionReason: string;
  finalZone: string;
  finalRule: string;
}
