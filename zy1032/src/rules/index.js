const path = require('path');
const { isRuleEnabled, getRuleSeverity } = require('../config');
const colorUtils = require('./color-utils');

const RULES = {
  'img-alt': {
    id: 'img-alt',
    name: '图片缺少 alt 属性',
    description: '所有图片都应该有 alt 属性，装饰性图片使用空 alt=""',
    check: function(parsedData, config) {
      if (!isRuleEnabled('img-alt', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      for (const element of elements) {
        if (element.type === 'img') {
          if (!element.hasAlt) {
            issues.push({
              ruleId: 'img-alt',
              severity: getRuleSeverity('img-alt', config),
              message: '图片缺少 alt 属性',
              details: `图片 src="${element.src}" 没有 alt 属性`,
              fix: '添加 alt 属性：装饰性图片用 alt=""，有意义的图片用描述性文本',
              filePath,
              lineNumber: element.lineNumber,
              context: element.context,
              snippet: element.outerHtml
            });
          } else if (!element.isDecorative && element.altText.trim() === '') {
            issues.push({
              ruleId: 'img-alt',
              severity: getRuleSeverity('img-alt', config),
              message: '图片 alt 属性为空但不是装饰性图片',
              details: `图片 src="${element.src}" 的 alt 属性为空`,
              fix: '如果是装饰性图片，添加 role="presentation"；如果有意义，填写描述性 alt 文本',
              filePath,
              lineNumber: element.lineNumber,
              context: element.context,
              snippet: element.outerHtml
            });
          }
        }
      }
      
      return issues;
    }
  },

  'form-label': {
    id: 'form-label',
    name: '表单控件缺少标签关联',
    description: '所有表单控件都应该有相关联的标签',
    check: function(parsedData, config) {
      if (!isRuleEnabled('form-label', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      for (const element of elements) {
        if (element.type === 'form-control') {
          const hasLabel = element.hasAriaLabel || element.hasAriaLabelledby;
          
          if (!hasLabel) {
            const tagType = element.tagName === 'input' ? `input type="${element.inputType}"` : element.tagName;
            
            if (element.hasId) {
              issues.push({
                ruleId: 'form-label',
                severity: getRuleSeverity('form-label', config),
                message: '表单控件有 id 但缺少 aria-label/aria-labelledby',
                details: `${tagType} 控件有 id="${element.id}" 但没有关联的 aria-label 或 aria-labelledby`,
                fix: '添加 <label for="id"> 标签或使用 aria-label/aria-labelledby',
                filePath,
                lineNumber: element.lineNumber,
                context: element.context,
                snippet: element.outerHtml
              });
            } else {
              issues.push({
                ruleId: 'form-label',
                severity: getRuleSeverity('form-label', config),
                message: '表单控件缺少标签关联',
                details: `${tagType} 控件没有 id 也没有 aria-label/aria-labelledby`,
                fix: '添加 id 并用 <label> 关联，或使用 aria-label 提供描述',
                filePath,
                lineNumber: element.lineNumber,
                context: element.context,
                snippet: element.outerHtml
              });
            }
          }
        }
      }
      
      return issues;
    }
  },

  'button-text': {
    id: 'button-text',
    name: '按钮缺少可读文本',
    description: '按钮应该有可见文本或 aria-label',
    check: function(parsedData, config) {
      if (!isRuleEnabled('button-text', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      for (const element of elements) {
        if (element.type === 'button' && !element.hasReadableText) {
          issues.push({
            ruleId: 'button-text',
            severity: getRuleSeverity('button-text', config),
            message: '按钮缺少可读文本',
            details: '按钮没有可见文本内容，也没有 aria-label 或 aria-labelledby',
            fix: '添加按钮文本，或使用 aria-label/aria-labelledby 描述按钮功能',
            filePath,
            lineNumber: element.lineNumber,
            context: element.context,
            snippet: element.outerHtml
          });
        }
      }
      
      return issues;
    }
  },

  'link-text': {
    id: 'link-text',
    name: '链接缺少可读文本',
    description: '链接应该有描述性文本，避免"点击这里"等模糊描述',
    check: function(parsedData, config) {
      if (!isRuleEnabled('link-text', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      const vagueTexts = ['点击', 'click', '这里', 'here', '更多', 'more', '了解', 'learn'];
      
      for (const element of elements) {
        if (element.type === 'link') {
          if (!element.hasReadableText) {
            issues.push({
              ruleId: 'link-text',
              severity: getRuleSeverity('link-text', config),
              message: '链接缺少可读文本',
              details: element.href 
                ? `链接 href="${element.href}" 没有文本内容或 aria-label`
                : '链接没有 href、文本内容或 aria-label',
              fix: '添加描述性链接文本，或使用 aria-label 描述链接目标',
              filePath,
              lineNumber: element.lineNumber,
              context: element.context,
              snippet: element.outerHtml
            });
          } else {
            const text = (element.textContent || element.ariaLabel || '').toLowerCase();
            const isVague = vagueTexts.some(vague => text.includes(vague));
            
            if (isVague && text.length <= 10) {
              issues.push({
                ruleId: 'link-text',
                severity: getRuleSeverity('link-text', config),
                message: '链接文本可能不够描述性',
                details: `链接文本 "${text}" 可能对屏幕阅读器用户不够明确`,
                fix: '使用更具体的描述，如"查看产品文档"而不是"点击这里"',
                filePath,
                lineNumber: element.lineNumber,
                context: element.context,
                snippet: element.outerHtml
              });
            }
          }
        }
      }
      
      return issues;
    }
  },

  'duplicate-id': {
    id: 'duplicate-id',
    name: '重复的 id 属性',
    description: 'id 属性在页面中应该是唯一的',
    check: function(parsedData, config) {
      if (!isRuleEnabled('duplicate-id', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      const idMap = new Map();
      
      for (const element of elements) {
        if (element.type === 'element-with-id' && element.id) {
          if (idMap.has(element.id)) {
            const firstOccurrence = idMap.get(element.id);
            issues.push({
              ruleId: 'duplicate-id',
              severity: getRuleSeverity('duplicate-id', config),
              message: '重复的 id 属性',
              details: `id="${element.id}" 在第 ${firstOccurrence.lineNumber} 行和第 ${element.lineNumber} 行重复出现`,
              fix: '确保每个 id 在页面中是唯一的，重复的 id 会破坏标签关联和 ARIA 引用',
              filePath,
              lineNumber: element.lineNumber,
              context: element.context,
              snippet: element.outerHtml
            });
          } else {
            idMap.set(element.id, element);
          }
        }
      }
      
      return issues;
    }
  },

  'tabindex': {
    id: 'tabindex',
    name: 'tabindex 风险',
    description: '避免使用正数 tabindex，它会破坏自然的 Tab 顺序',
    check: function(parsedData, config) {
      if (!isRuleEnabled('tabindex', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      for (const element of elements) {
        if (element.type === 'tabindex') {
          if (element.isPositive) {
            issues.push({
              ruleId: 'tabindex',
              severity: getRuleSeverity('tabindex', config),
              message: '使用了正数 tabindex',
              details: `tabindex="${element.tabindex}" 会破坏自然的 Tab 导航顺序`,
              fix: '移除正数 tabindex，使用语义化 HTML（button、a、input 等）来获得自然的焦点顺序，或使用 tabindex="0"',
              filePath,
              lineNumber: element.lineNumber,
              context: element.context,
              snippet: element.outerHtml
            });
          }
          
          if (element.isNegative) {
            const interactiveElements = ['button', 'a', 'input', 'textarea', 'select'];
            if (interactiveElements.includes(element.tagName)) {
              issues.push({
                ruleId: 'tabindex',
                severity: getRuleSeverity('tabindex', config),
                message: '交互元素使用了 tabindex="-1"',
                details: `${element.tagName} 元素使用 tabindex="-1" 会导致无法通过 Tab 键聚焦`,
                fix: '如果需要这个元素可聚焦，移除 tabindex="-1"；如果是程序化聚焦，确保有替代的键盘访问方式',
                filePath,
                lineNumber: element.lineNumber,
                context: element.context,
                snippet: element.outerHtml
              });
            }
          }
        }
      }
      
      return issues;
    }
  },

  'aria-misuse': {
    id: 'aria-misuse',
    name: 'ARIA 属性误用',
    description: '检查常见的 ARIA 错误使用',
    check: function(parsedData, config) {
      if (!isRuleEnabled('aria-misuse', config)) return [];
      
      const issues = [];
      const { filePath, elements } = parsedData;
      
      const invalidRoles = [
        'document', 'application', 'banner', 'complementary', 
        'contentinfo', 'form', 'main', 'navigation', 'region',
        'search', 'alert', 'log', 'marquee', 'status', 'timer'
      ];
      
      for (const element of elements) {
        if (element.type === 'aria-element') {
          if (element.hasRole) {
            const role = element.role;
            
            const explicitRoleElements = {
              'button': ['button'],
              'link': ['a'],
              'checkbox': ['input'],
              'radio': ['input'],
              'textbox': ['input', 'textarea'],
              'listbox': ['select']
            };
            
            for (const [expectedRole, tags] of Object.entries(explicitRoleElements)) {
              if (role === expectedRole && tags.includes(element.tagName)) {
                issues.push({
                  ruleId: 'aria-misuse',
                  severity: getRuleSeverity('aria-misuse', config),
                  message: '不必要的 ARIA role',
                  details: `<${element.tagName}> 元素已经隐含 role="${role}"，不需要显式声明`,
                  fix: `移除冗余的 role="${role}" 属性，语义化 HTML 已经提供了正确的语义`,
                  filePath,
                  lineNumber: element.lineNumber,
                  context: element.context,
                  snippet: element.outerHtml
                });
              }
            }
          }
          
          for (const [attr, value] of Object.entries(element.ariaAttributes)) {
            if (attr === 'aria-hidden' && value === 'true') {
              const interactiveElements = ['button', 'a', 'input', 'textarea', 'select'];
              if (interactiveElements.includes(element.tagName)) {
                issues.push({
                  ruleId: 'aria-misuse',
                  severity: getRuleSeverity('aria-misuse', config),
                  message: '交互元素使用 aria-hidden="true"',
                  details: `<${element.tagName}> 是交互元素，aria-hidden="true" 会让它对屏幕阅读器隐藏`,
                  fix: '移除 aria-hidden="true" 或确保这个元素不需要键盘/屏幕阅读器访问',
                  filePath,
                  lineNumber: element.lineNumber,
                  context: element.context,
                  snippet: element.outerHtml
                });
              }
            }
            
            if (attr === 'aria-label' && !value.trim()) {
              issues.push({
                ruleId: 'aria-misuse',
                severity: getRuleSeverity('aria-misuse', config),
                message: 'aria-label 为空',
                details: 'aria-label 属性值为空，没有提供任何描述',
                fix: '填写有意义的 aria-label 描述，或完全移除空的 aria-label',
                filePath,
                lineNumber: element.lineNumber,
                context: element.context,
                snippet: element.outerHtml
              });
            }
          }
        }
      }
      
      return issues;
    }
  },

  'color-contrast': {
    id: 'color-contrast',
    name: '颜色对比度不足',
    description: '检查前景色和背景色的对比度是否符合 WCAG 标准',
    check: function(parsedData, config) {
      if (!isRuleEnabled('color-contrast', config)) return [];
      
      const issues = [];
      const { filePath, colorRules = [] } = parsedData;
      
      if (parsedData.type !== 'css') return issues;
      
      const threshold = config.contrastThreshold || 4.5;
      
      for (const rule of colorRules) {
        let foregroundColor = null;
        let backgroundColor = null;
        let opacity = null;
        
        for (const decl of rule.declarations) {
          if (decl.property === 'color') {
            const parsed = colorUtils.parseColor(decl.value);
            if (parsed) foregroundColor = parsed;
          }
          if (decl.property === 'background' || decl.property === 'background-color') {
            const parsed = colorUtils.parseColor(decl.value);
            if (parsed) backgroundColor = parsed;
          }
          if (decl.property === 'opacity') {
            opacity = parseFloat(decl.value);
          }
        }
        
        if (foregroundColor && backgroundColor) {
          const contrast = colorUtils.calculateContrast(foregroundColor, backgroundColor);
          
          if (contrast < threshold) {
            const level = contrast >= 3 ? 'AA 大文本' : (contrast >= 4.5 ? 'AA' : '不达标');
            
            issues.push({
              ruleId: 'color-contrast',
              severity: getRuleSeverity('color-contrast', config),
              message: '颜色对比度不足',
              details: `选择器 "${rule.selector}" 的对比度为 ${contrast.toFixed(2)}:1，低于 WCAG AA 标准的 ${threshold}:1`,
              fix: `增加前景色和背景色的对比度。当前：前景 ${foregroundColor.original}，背景 ${backgroundColor.original}`,
              filePath,
              lineNumber: rule.lineNumber,
              context: rule.context,
              data: {
                contrast: contrast.toFixed(2),
                threshold,
                foreground: foregroundColor.original,
                background: backgroundColor.original,
                wcagLevel: level
              }
            });
          }
        }
      }
      
      return issues;
    }
  }
};

function checkAll(parsedData, config) {
  const allIssues = [];
  
  for (const [ruleId, rule] of Object.entries(RULES)) {
    try {
      const issues = rule.check(parsedData, config);
      allIssues.push(...issues);
    } catch (error) {
      console.warn(`规则 ${ruleId} 执行出错: ${error.message}`);
    }
  }
  
  return allIssues;
}

module.exports = {
  RULES,
  checkAll
};
