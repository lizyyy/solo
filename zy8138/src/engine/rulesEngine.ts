import type { Scene, Prop, PropAppearance, ContinuityRule, ContinuityIssue } from '../types';

export interface RuleEngineInput {
  scenes: Scene[];
  props: Prop[];
  appearances: PropAppearance[];
  rules: ContinuityRule[];
}

export interface RuleEngineResult {
  issues: ContinuityIssue[];
  statistics: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export function runContinuityChecks(input: RuleEngineInput): RuleEngineResult {
  const issues: ContinuityIssue[] = [];
  const { scenes, props, appearances, rules } = input;

  const enabledRules = rules.filter(r => r.enabled);

  for (const rule of enabledRules) {
    switch (rule.ruleType) {
      case 'prop_disappearance':
        issues.push(...checkPropDisappearance(scenes, props, appearances, rule));
        break;
      case 'state_regression':
        issues.push(...checkStateRegression(props, appearances, rule));
        break;
      case 'duplicate_prop_number':
        issues.push(...checkDuplicatePropNumber(props, rule));
        break;
      case 'reshoot_date_issue':
        issues.push(...checkReshootDateIssue(scenes, rule));
        break;
      case 'missing_responsibility':
        issues.push(...checkMissingResponsibility(props, rule));
        break;
      case 'unverified_condition':
        issues.push(...checkUnverifiedCondition(appearances, rule));
        break;
      default:
        break;
    }
  }

  const statistics = {
    total: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  };

  return { issues, statistics };
}

function checkPropDisappearance(
  scenes: Scene[],
  props: Prop[],
  appearances: PropAppearance[],
  rule: ContinuityRule
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  const sortedScenes = [...scenes].sort((a, b) => 
    new Date(a.plannedShootDate).getTime() - new Date(b.plannedShootDate).getTime()
  );

  for (const prop of props) {
    const propAppearances = appearances.filter(a => a.propId === prop.id);
    
    if (propAppearances.length === 0) continue;

    const appearanceSceneIds = new Set(propAppearances.map(a => a.sceneId));

    let foundFirstAppearance = false;
    let foundLastAppearance = false;
    const missingScenes: Scene[] = [];

    for (const scene of sortedScenes) {
      const appearsInScene = appearanceSceneIds.has(scene.id);
      
      if (appearsInScene) {
        if (!foundFirstAppearance) {
          foundFirstAppearance = true;
        }
        foundLastAppearance = true;
        
        if (missingScenes.length > 0) {
          for (const missingScene of missingScenes) {
            issues.push(createIssue(
              rule,
              `道具 '${prop.name}' (#${prop.propNumber}) 在场景 ${missingScene.sceneNumber} 中突然消失（该场景位于道具首次出现和最后出现之间）`,
              prop,
              missingScene,
              missingScenes.map(s => s.sceneNumber)
            ));
          }
          missingScenes.length = 0;
        }
      } else if (foundFirstAppearance && !foundLastAppearance) {
        missingScenes.push(scene);
      }
    }
  }

  return issues;
}

function checkStateRegression(
  props: Prop[],
  appearances: PropAppearance[],
  rule: ContinuityRule
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const prop of props) {
    const propAppearances = [...appearances.filter(a => a.propId === prop.id)]
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < propAppearances.length; i++) {
      const prev = propAppearances[i - 1];
      const curr = propAppearances[i];

      if (prev.state && curr.state) {
        const prevStateLower = prev.state.toLowerCase();
        const currStateLower = curr.state.toLowerCase();

        const regressionPairs: [string, string][] = [
          ['broken', 'good'],
          ['damaged', 'good'],
          ['worn', 'new'],
          ['used', 'new'],
          ['opened', 'sealed'],
          ['unwrapped', 'wrapped'],
        ];

        for (const [later, earlier] of regressionPairs) {
          if (prevStateLower.includes(later) && currStateLower.includes(earlier)) {
            issues.push(createIssue(
              rule,
              `道具 '${prop.name}' (#${prop.propNumber}) 状态出现倒退：从 '${prev.state}' 变回 '${curr.state}'`,
              prop,
              undefined,
              [prev.id, curr.id]
            ));
            break;
          }
        }
      }
    }
  }

  return issues;
}

function checkDuplicatePropNumber(
  props: Prop[],
  rule: ContinuityRule
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const propNumberMap = new Map<string, Prop[]>();

  for (const prop of props) {
    if (!propNumberMap.has(prop.propNumber)) {
      propNumberMap.set(prop.propNumber, []);
    }
    propNumberMap.get(prop.propNumber)!.push(prop);
  }

  for (const [propNumber, propsWithNumber] of propNumberMap) {
    if (propsWithNumber.length > 1) {
      const propNames = propsWithNumber.map(p => p.name).join(', ');
      issues.push(createIssue(
        rule,
        `道具编号 '${propNumber}' 被多个道具使用：${propNames}`,
        undefined,
        undefined,
        propsWithNumber.map(p => p.id)
      ));
    }
  }

  return issues;
}

function checkReshootDateIssue(
  scenes: Scene[],
  rule: ContinuityRule
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const scene of scenes) {
    if (scene.reshootDate) {
      const reshootDate = new Date(scene.reshootDate);
      const plannedDate = new Date(scene.plannedShootDate);
      
      if (reshootDate < plannedDate) {
        issues.push(createIssue(
          rule,
          `场景 ${scene.sceneNumber} 的补拍日期 (${scene.reshootDate}) 早于计划拍摄日期 (${scene.plannedShootDate})`,
          undefined,
          scene,
          [scene.id]
        ));
      }

      if (scene.actualShootDate) {
        const actualDate = new Date(scene.actualShootDate);
        if (reshootDate < actualDate) {
          issues.push(createIssue(
            rule,
            `场景 ${scene.sceneNumber} 的补拍日期 (${scene.reshootDate}) 早于实际拍摄日期 (${scene.actualShootDate})`,
            undefined,
            scene,
            [scene.id]
          ));
        }
      }
    }
  }

  return issues;
}

function checkMissingResponsibility(
  props: Prop[],
  rule: ContinuityRule
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const prop of props) {
    if (!prop.responsiblePerson || prop.responsiblePerson.trim() === '') {
      issues.push(createIssue(
        rule,
        `道具 '${prop.name}' (#${prop.propNumber}) 没有指定负责人`,
        prop,
        undefined,
        [prop.id]
      ));
    }
  }

  return issues;
}

function checkUnverifiedCondition(
  appearances: PropAppearance[],
  rule: ContinuityRule
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const appearance of appearances) {
    if (appearance.condition.toLowerCase() === 'unknown' || 
        appearance.condition.toLowerCase() === 'unverified') {
      issues.push(createIssue(
        rule,
        `道具出现记录的状态为 '${appearance.condition}'，需要确认`,
        undefined,
        undefined,
        [appearance.id]
      ));
    }
  }

  return issues;
}

function createIssue(
  rule: ContinuityRule,
  description: string,
  prop?: Prop,
  scene?: Scene,
  relatedItems: string[] = []
): ContinuityIssue {
  return {
    id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    description,
    propId: prop?.id,
    propName: prop?.name,
    sceneId: scene?.id,
    sceneNumber: scene?.sceneNumber,
    relatedItems,
    timestamp: Date.now(),
  };
}
