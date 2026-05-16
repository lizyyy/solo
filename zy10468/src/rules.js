import { matchPackagePattern } from './packages.js';

export function validateBoundaryRules(edges, packages, config) {
  const violations = [];

  for (const edge of edges) {
    const result = checkSingleEdge(edge, config.rules);
    if (result.violation) {
      violations.push({
        ...edge,
        rule: result.rule,
        reason: result.reason,
        severity: result.severity || 'error',
      });
    }
  }

  return violations;
}

function checkSingleEdge(edge, rules) {
  const fromPackage = edge.from;
  const toPackage = edge.to;

  for (const [pattern, rule] of Object.entries(rules)) {
    if (matchPackagePattern(fromPackage, pattern)) {
      if (rule.deny) {
        for (const denyPattern of rule.deny) {
          if (matchPackagePattern(toPackage, denyPattern)) {
            return {
              violation: true,
              rule: pattern,
              reason: `${fromPackage} 被禁止依赖 ${toPackage} (匹配规则: ${pattern} deny ${denyPattern})`,
              severity: 'error',
            };
          }
        }
      }

      if (rule.allow) {
        let allowed = false;
        for (const allowPattern of rule.allow) {
          if (matchPackagePattern(toPackage, allowPattern)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          return {
            violation: true,
            rule: pattern,
            reason: `${fromPackage} 不允许依赖 ${toPackage} (仅允许: ${rule.allow.join(', ')})`,
            severity: 'error',
          };
        }
      }
    }
  }

  return { violation: false };
}

export function generateFixSuggestions(violation) {
  const suggestions = [];

  suggestions.push({
    type: 'refactor',
    title: '重构依赖关系',
    description: `考虑将 ${violation.importPath} 中的功能提取到双方都可以依赖的共享包中`,
  });

  suggestions.push({
    type: 'rule',
    title: '更新边界规则',
    description: `如果此依赖是有意的，可以在 .monoboundrc.json 中为 ${violation.from} 添加对 ${violation.to} 的允许规则`,
    code: `{
  "rules": {
    "${violation.from}": {
      "allow": ["...", "${violation.to}"]
    }
  }
}`,
  });

  suggestions.push({
    type: 'invert',
    title: '反转依赖方向',
    description: `考虑使用依赖倒置原则，让 ${violation.to} 依赖 ${violation.from} 而不是相反`,
  });

  return suggestions;
}
