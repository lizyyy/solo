import db from "../db/index.js";
import type { RewardRule } from "../../shared/types.js";

const getRules = (): RewardRule[] => {
  const rules = db.prepare("SELECT * FROM reward_rules").all() as RewardRule[];
  return rules;
};

const getRuleValue = (ruleKey: string): number => {
  const rule = db
    .prepare("SELECT rule_value FROM reward_rules WHERE rule_key = ?")
    .get(ruleKey) as { rule_value: number } | undefined;
  return rule?.rule_value ?? 0;
};

const updateRules = (
  rules: { rule_key: string; rule_value: number }[]
): RewardRule[] => {
  const updateStmt = db.prepare(`
    UPDATE reward_rules 
    SET rule_value = ?, updated_at = datetime('now', 'localtime')
    WHERE rule_key = ?
  `);

  const transaction = db.transaction((rulesToUpdate) => {
    for (const rule of rulesToUpdate) {
      updateStmt.run(rule.rule_value, rule.rule_key);
    }
  });

  transaction(rules);
  return getRules();
};

export default {
  getRules,
  getRuleValue,
  updateRules,
};
