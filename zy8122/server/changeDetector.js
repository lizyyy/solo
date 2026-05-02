const _ = require('lodash');
const TokenAnalyzer = require('./tokenAnalyzer');

class ChangeDetector {
  constructor(rules = {}) {
    this.rules = this.getDefaultRules();
    Object.assign(this.rules, rules);
  }

  getDefaultRules() {
    return {
      breakingChanges: {
        removedTokens: true,
        typeChanges: true,
        valueChanges: {
          color: true,
          dimension: true,
          number: true,
          string: false
        },
        unitChanges: true
      },
      contrast: {
        backgroundTokens: ['color.background', 'color.surface'],
        textTokens: ['color.text', 'color.primary'],
        minRatio: {
          normal: 4.5,
          large: 3
        }
      }
    };
  }

  detectChanges(analyzedV1, analyzedV2) {
    const changes = [];
    const allTokenPaths = new Set([
      ...Object.keys(analyzedV1.allTokens),
      ...Object.keys(analyzedV2.allTokens)
    ]);

    for (const tokenPath of allTokenPaths) {
      const tokenV1 = analyzedV1.allTokens[tokenPath];
      const tokenV2 = analyzedV2.allTokens[tokenPath];
      const resolvedV1 = analyzedV1.resolvedTokens[tokenPath];
      const resolvedV2 = analyzedV2.resolvedTokens[tokenPath];

      if (!tokenV1 && tokenV2) {
        changes.push({
          tokenPath,
          type: 'added',
          oldValue: undefined,
          newValue: tokenV2.value,
          resolvedOldValue: undefined,
          resolvedNewValue: resolvedV2?.value,
          isBreaking: false,
          breakingReason: null,
          token: tokenV2
        });
      } else if (tokenV1 && !tokenV2) {
        const isBreaking = this.rules.breakingChanges.removedTokens;
        changes.push({
          tokenPath,
          type: 'removed',
          oldValue: tokenV1.value,
          newValue: undefined,
          resolvedOldValue: resolvedV1?.value,
          resolvedNewValue: undefined,
          isBreaking,
          breakingReason: isBreaking ? 'Token 被删除，可能导致组件引用失败' : null,
          token: tokenV1
        });
      } else {
        const modification = this.detectModification(
          tokenPath,
          tokenV1, tokenV2,
          resolvedV1, resolvedV2,
          analyzedV1, analyzedV2
        );
        if (modification) {
          changes.push(modification);
        }
      }
    }

    this.checkCycleImpacts(changes, analyzedV1, analyzedV2);
    this.checkContrastRisks(changes, analyzedV2);

    return changes;
  }

  detectModification(tokenPath, tokenV1, tokenV2, resolvedV1, resolvedV2, analyzedV1, analyzedV2) {
    const modifications = [];
    let isBreaking = false;
    let breakingReasons = [];

    if (tokenV1.type !== tokenV2.type) {
      modifications.push({
        field: 'type',
        oldValue: tokenV1.type,
        newValue: tokenV2.type
      });
      if (this.rules.breakingChanges.typeChanges) {
        isBreaking = true;
        breakingReasons.push(`类型从 ${tokenV1.type} 变为 ${tokenV2.type}`);
      }
    }

    const valueChanged = !_.isEqual(tokenV1.value, tokenV2.value);
    if (valueChanged) {
      modifications.push({
        field: 'value',
        oldValue: tokenV1.value,
        newValue: tokenV2.value
      });

      const valueChangeRules = this.rules.breakingChanges.valueChanges;
      if (valueChangeRules[tokenV1.type] !== undefined) {
        if (valueChangeRules[tokenV1.type]) {
          isBreaking = true;
          breakingReasons.push(`值从 ${JSON.stringify(tokenV1.value)} 变为 ${JSON.stringify(tokenV2.value)}`);
        }
      }
    }

    if (resolvedV1?.value && resolvedV2?.value) {
      const dimensionChange = this.checkDimensionChange(resolvedV1.value, resolvedV2.value);
      if (dimensionChange) {
        modifications.push({
          field: 'dimension',
          ...dimensionChange
        });
        if (this.rules.breakingChanges.unitChanges && dimensionChange.unitChanged) {
          isBreaking = true;
          breakingReasons.push(`单位从 ${dimensionChange.oldUnit} 变为 ${dimensionChange.newUnit}`);
        }
        if (dimensionChange.valueChanged) {
          const type = tokenV1.type === 'alias' ? 'dimension' : tokenV1.type;
          if (this.rules.breakingChanges.valueChanges[type]) {
            isBreaking = true;
            breakingReasons.push(`数值从 ${dimensionChange.oldValue} 变为 ${dimensionChange.newValue}`);
          }
        }
      }

      const colorChange = this.checkColorChange(resolvedV1.value, resolvedV2.value);
      if (colorChange) {
        modifications.push({
          field: 'color',
          ...colorChange
        });
        if (this.rules.breakingChanges.valueChanges.color) {
          isBreaking = true;
          breakingReasons.push(`颜色从 ${colorChange.oldHex} 变为 ${colorChange.newHex}`);
        }
      }
    }

    const resolutionChange = this.checkResolutionChange(
      tokenPath, resolvedV1, resolvedV2, analyzedV1, analyzedV2
    );
    if (resolutionChange) {
      modifications.push({
        field: 'resolution',
        ...resolutionChange
      });
    }

    if (modifications.length === 0) {
      return null;
    }

    return {
      tokenPath,
      type: 'modified',
      modifications,
      oldValue: tokenV1.value,
      newValue: tokenV2.value,
      resolvedOldValue: resolvedV1?.value,
      resolvedNewValue: resolvedV2?.value,
      isBreaking,
      breakingReason: breakingReasons.length > 0 ? breakingReasons.join('; ') : null,
      token: tokenV2
    };
  }

  checkDimensionChange(oldValue, newValue) {
    if (!oldValue || !newValue) return null;
    
    const isOldDimension = oldValue.value !== undefined && oldValue.unit !== undefined;
    const isNewDimension = newValue.value !== undefined && newValue.unit !== undefined;
    
    if (!isOldDimension && !isNewDimension) return null;

    const result = {
      valueChanged: false,
      unitChanged: false,
      oldValue: oldValue.value,
      oldUnit: oldValue.unit,
      newValue: newValue.value,
      newUnit: newValue.unit
    };

    if (oldValue.value !== newValue.value) {
      result.valueChanged = true;
      result.valueDelta = newValue.value - oldValue.value;
      result.valueDeltaPercent = ((newValue.value - oldValue.value) / oldValue.value * 100);
    }

    if (oldValue.unit !== newValue.unit) {
      result.unitChanged = true;
    }

    return result.valueChanged || result.unitChanged ? result : null;
  }

  checkColorChange(oldValue, newValue) {
    if (!oldValue || !newValue) return null;
    
    const isOldColor = oldValue.hex !== undefined;
    const isNewColor = newValue.hex !== undefined;
    
    if (!isOldColor && !isNewColor) return null;

    if (oldValue.hex === newValue.hex) {
      return null;
    }

    return {
      oldHex: oldValue.hex,
      newHex: newValue.hex,
      oldRgb: oldValue.rgb,
      newRgb: newValue.rgb,
      changed: true
    };
  }

  checkResolutionChange(tokenPath, resolvedV1, resolvedV2, analyzedV1, analyzedV2) {
    if (!resolvedV1 || !resolvedV2) return null;

    const pathV1 = resolvedV1.resolutionPath || [];
    const pathV2 = resolvedV2.resolutionPath || [];

    if (_.isEqual(pathV1, pathV2)) {
      return null;
    }

    return {
      oldPath: pathV1,
      newPath: pathV2,
      pathChanged: true
    };
  }

  checkCycleImpacts(changes, analyzedV1, analyzedV2) {
    const cyclesV1 = analyzedV1.cycles || [];
    const cyclesV2 = analyzedV2.cycles || [];

    for (const cycle of cyclesV2) {
      for (const tokenPath of cycle.tokens) {
        const existingChange = changes.find(c => c.tokenPath === tokenPath);
        if (existingChange) {
          existingChange.hasCycle = true;
          existingChange.cycleInfo = cycle;
          if (!existingChange.isBreaking) {
            existingChange.isBreaking = true;
            existingChange.breakingReason = (existingChange.breakingReason ? existingChange.breakingReason + '; ' : '') +
              `存在循环别名引用: ${cycle.message}`;
          }
        } else {
          changes.push({
            tokenPath,
            type: 'cycle',
            isBreaking: true,
            breakingReason: `存在循环别名引用: ${cycle.message}`,
            hasCycle: true,
            cycleInfo: cycle
          });
        }
      }
    }
  }

  checkContrastRisks(changes, analyzedV2) {
    const colorChanges = changes.filter(c => {
      const token = c.token;
      return token && (token.type === 'color' || 
        (c.resolvedNewValue && c.resolvedNewValue.hex));
    });

    for (const change of colorChanges) {
      if (!change.resolvedNewValue || !change.resolvedNewValue.hex) continue;

      const relatedTokens = this.findRelatedTokens(change.tokenPath, analyzedV2);
      
      for (const related of relatedTokens) {
        const relatedToken = analyzedV2.resolvedTokens[related];
        if (!relatedToken || !relatedToken.value || !relatedToken.value.hex) continue;

        const contrastRatio = TokenAnalyzer.calculateContrast(
          change.resolvedNewValue.hex,
          relatedToken.value.hex
        );

        if (contrastRatio !== null) {
          const risk = TokenAnalyzer.getContrastRisk(contrastRatio);
          
          if (risk === 'high' || risk === 'medium') {
            change.contrastRisk = risk;
            change.contrastRatio = contrastRatio;
            change.contrastWith = related;
            
            if (!change.isBreaking && risk === 'high') {
              change.isBreaking = true;
              change.breakingReason = (change.breakingReason ? change.breakingReason + '; ' : '') +
                `对比度风险: 与 ${related} 的对比度为 ${contrastRatio.toFixed(2)}:1`;
            }
          }
        }
      }
    }
  }

  findRelatedTokens(tokenPath, analyzed) {
    const related = [];
    const pathParts = tokenPath.split('.');
    
    for (const [path, token] of Object.entries(analyzed.resolvedTokens)) {
      if (path === tokenPath) continue;
      
      const parts = path.split('.');
      if (parts[0] === pathParts[0] && parts[1] === pathParts[1]) {
        related.push(path);
      }
      
      if (token.resolutionPath && token.resolutionPath.includes(tokenPath)) {
        if (!related.includes(path)) {
          related.push(path);
        }
      }
    }

    return related.slice(0, 10);
  }

  analyzeComponentImpacts(componentLogs, changes) {
    const impacts = new Map();
    const tokenChangeMap = new Map();

    for (const change of changes) {
      tokenChangeMap.set(change.tokenPath, change);
      
      const affectedTokens = this.getAffectedTokens(change.tokenPath, changes);
      for (const affected of affectedTokens) {
        if (!tokenChangeMap.has(affected)) {
          tokenChangeMap.set(affected, change);
        }
      }
    }

    for (const log of componentLogs) {
      const componentName = log.component || log.componentName || 'unknown';
      
      if (!impacts.has(componentName)) {
        impacts.set(componentName, {
          componentName,
          affectedTokens: new Set(),
          usageExamples: [],
          severity: 'low'
        });
      }

      const impact = impacts.get(componentName);

      const usedTokens = this.extractUsedTokens(log);
      for (const tokenPath of usedTokens) {
        if (tokenChangeMap.has(tokenPath)) {
          impact.affectedTokens.add(tokenPath);
          
          const change = tokenChangeMap.get(tokenPath);
          if (change.isBreaking) {
            impact.severity = 'high';
          } else if (impact.severity === 'low') {
            impact.severity = 'medium';
          }
        }

        const referencedChange = this.findReferencedChange(tokenPath, tokenChangeMap);
        if (referencedChange && !impact.affectedTokens.has(referencedChange.tokenPath)) {
          impact.affectedTokens.add(referencedChange.tokenPath);
        }
      }

      if (log.usage || log.example) {
        impact.usageExamples.push(log.usage || log.example);
      }
    }

    return Array.from(impacts.values())
      .filter(i => i.affectedTokens.size > 0)
      .map(i => ({
        ...i,
        affectedTokens: Array.from(i.affectedTokens)
      }))
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  extractUsedTokens(log) {
    const tokens = [];
    
    if (log.tokens && Array.isArray(log.tokens)) {
      tokens.push(...log.tokens);
    }
    
    if (log.tokenPath) {
      tokens.push(log.tokenPath);
    }

    if (log.usage && typeof log.usage === 'string') {
      const aliasRegex = /\{([^}]+)\}/g;
      let match;
      while ((match = aliasRegex.exec(log.usage)) !== null) {
        tokens.push(match[1]);
      }
    }

    return tokens;
  }

  getAffectedTokens(tokenPath, changes) {
    const affected = [];
    for (const change of changes) {
      if (change.modifications) {
        for (const mod of change.modifications) {
          if (mod.field === 'resolution' && mod.oldPath) {
            if (mod.oldPath.includes(tokenPath)) {
              affected.push(change.tokenPath);
            }
          }
        }
      }
    }
    return affected;
  }

  findReferencedChange(tokenPath, tokenChangeMap) {
    for (const [path, change] of tokenChangeMap) {
      if (change.token) {
        const value = change.token.value;
        if (typeof value === 'string' && value.includes(`{${tokenPath}}`)) {
          return change;
        }
      }
    }
    return null;
  }

  generateRollbackSuggestions(changes, componentImpacts) {
    const suggestions = [];
    const breakingChanges = changes.filter(c => c.isBreaking);

    for (const change of breakingChanges) {
      const suggestion = this.createRollbackSuggestion(change, componentImpacts);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    const nonBreakingWithImpact = changes.filter(c => 
      !c.isBreaking && 
      (c.type === 'modified' || c.type === 'removed')
    );
    
    for (const change of nonBreakingWithImpact) {
      const hasComponentImpact = componentImpacts.some(
        impact => impact.affectedTokens.includes(change.tokenPath)
      );
      
      if (hasComponentImpact) {
        const suggestion = this.createRollbackSuggestion(change, componentImpacts);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  createRollbackSuggestion(change, componentImpacts) {
    const affectedComponents = componentImpacts.filter(
      impact => impact.affectedTokens.includes(change.tokenPath)
    );

    let priority = 'low';
    let reason = '';
    let action = '';

    if (change.type === 'removed') {
      priority = 'high';
      reason = `Token '${change.tokenPath}' 被删除`;
      action = `恢复 Token '${change.tokenPath}'，值为 ${JSON.stringify(change.oldValue)}`;
      
      if (affectedComponents.length > 0) {
        reason += `，影响 ${affectedComponents.length} 个组件`;
        action += `（影响组件: ${affectedComponents.map(c => c.componentName).join(', ')}）`;
      }
    } else if (change.type === 'cycle') {
      priority = 'high';
      reason = `存在循环别名引用: ${change.cycleInfo?.message}`;
      action = '修复循环别名依赖关系';
    } else if (change.contrastRisk === 'high') {
      priority = 'high';
      reason = `对比度风险高: 与 '${change.contrastWith}' 的对比度为 ${change.contrastRatio?.toFixed(2)}:1`;
      action = `调整颜色值以满足 WCAG AA 标准（建议对比度 >= 4.5:1）`;
    } else if (change.isBreaking) {
      priority = 'medium';
      reason = `破坏性变更: ${change.breakingReason || '未知原因'}`;
      
      if (change.type === 'modified') {
        action = `考虑回滚 '${change.tokenPath}' 的值从 ${JSON.stringify(change.newValue)} 到 ${JSON.stringify(change.oldValue)}`;
      } else {
        action = `评估变更影响并考虑回滚`;
      }
      
      if (affectedComponents.length > 0) {
        reason += `，影响 ${affectedComponents.length} 个组件`;
        priority = 'high';
      }
    } else if (affectedComponents.length > 0) {
      priority = 'medium';
      reason = `变更影响 ${affectedComponents.length} 个组件`;
      action = `验证 '${change.tokenPath}' 变更对受影响组件的兼容性`;
    } else {
      return null;
    }

    return {
      tokenPath: change.tokenPath,
      changeType: change.type,
      priority,
      reason,
      action,
      affectedComponents: affectedComponents.map(c => c.componentName),
      oldValue: change.oldValue,
      newValue: change.newValue,
      change: change
    };
  }
}

module.exports = ChangeDetector;