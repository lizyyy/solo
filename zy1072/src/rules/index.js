import { RuleBase } from './rule-base.js';
import { RuleEngine } from './rule-engine.js';

export { RuleBase, RuleEngine };

export { 
  DuplicateNameRule, 
  MissingTableRule, 
  UnseatedGuestRule 
} from './validation-rules.js';

export { 
  TableCapacityRule, 
  EmptyTableRule 
} from './table-rules.js';

export { 
  CompanionsSeparatedRule, 
  AvoidConflictRule, 
  PreferWithRule 
} from './relation-rules.js';

export { 
  AccessibilityRule, 
  ChildrenTableRule, 
  QuietZoneRule 
} from './position-rules.js';

export { 
  VIPSeatingRule, 
  DietarySummaryRule, 
  GroupSeatingRule 
} from './special-rules.js';

export async function validateGuestsAndTables(guests, tables, parseErrors = []) {
  const engine = new RuleEngine();
  return engine.validate({ guests, tables, parseErrors });
}
