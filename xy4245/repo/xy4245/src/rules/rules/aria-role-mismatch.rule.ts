import { ScanResult, Issue, IssueType, FocusableElement } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class AriaRoleMismatchRule implements Rule {
  readonly type: IssueType = 'aria_role_mismatch';
  readonly name = 'ARIA 角色不匹配';
  readonly description = '检测 ARIA role 属性与原生语义的不匹配或不当使用';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    for (const element of scanResult.focusableElements) {
      if (!element.role) {
        continue;
      }

      const role = element.role;

      issues.push(...this.checkRoleVsNativeSemantics(element, role));
      issues.push(...this.checkRoleRequirements(element, role));
      issues.push(...this.checkDeprecatedRoles(element, role));
    }

    return issues;
  }

  private checkRoleVsNativeSemantics(
    element: FocusableElement,
    role: string
  ): Issue[] {
    const issues: Issue[] = [];

    const nativeRoleMappings: Record<string, string[]> = {
      'button': ['button'],
      'link': ['a'],
      'checkbox': ['input[type="checkbox"]'],
      'radio': ['input[type="radio"]'],
      'textbox': ['input[type="text"]', 'input[type="email"]', 'input[type="password"]', 'textarea'],
      'combobox': ['select'],
      'option': ['option'],
      'heading': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      'list': ['ul', 'ol'],
      'listitem': ['li'],
      'table': ['table'],
      'row': ['tr'],
      'cell': ['td'],
      'columnheader': ['th'],
      'rowheader': ['th'],
      'img': ['img'],
      'form': ['form'],
      'search': ['form']
    };

    const genericRoles = ['generic', 'presentation', 'none'];
    if (genericRoles.includes(role)) {
      const hasMeaningfulSemantics = this.hasMeaningfulNativeSemantics(element);
      if (hasMeaningfulSemantics) {
        const issue = RulesEngine.createIssue({
          type: 'aria_role_mismatch',
          severity: 'high',
          title: '有语义元素被设置为无角色',
          description: `一个具有语义的 <${element.tag}> 元素被设置了 role="${role}"，这会移除其原生语义。选择器: ${element.selector}`,
          element,
          suggestion: `请谨慎使用 role="${role}"。这个角色会移除元素的原生语义，使其对屏幕阅读器而言成为一个通用容器。如果需要隐藏元素的语义，请确保这是有意的。如果是误设置，请移除 role 属性，让元素保持其原生语义。`
        });
        issues.push(issue);
      }
      return issues;
    }

    const explicitRoles = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox'];
    if (explicitRoles.includes(role)) {
      const nativeElements = nativeRoleMappings[role] || [];
      const isNativeElement = nativeElements.some(native => {
        if (native.includes('[type="')) {
          const tagMatch = native.match(/^(\w+)\[/);
          if (tagMatch && element.tag === tagMatch[1]) {
            const typeMatch = native.match(/type="([^"]+)"/);
            if (typeMatch) {
              const actualType = (element.attributes['type'] || 'text').toLowerCase();
              return actualType === typeMatch[1];
            }
          }
          return false;
        }
        return element.tag === native;
      });

      if (isNativeElement) {
        const issue = RulesEngine.createIssue({
          type: 'aria_role_mismatch',
          severity: 'low',
          title: '冗余的 ARIA role',
          description: `元素 <${element.tag}> 已经具有原生语义等同于 role="${role}"，设置明确的 role 是冗余的。选择器: ${element.selector}`,
          element,
          suggestion: '可以考虑移除冗余的 role 属性。原生 HTML 元素已经具有隐式的 ARIA 语义，重复设置相同的 role 没有必要。但请注意，如果在某些特殊情况下（如为了兼容性）保留它也没有害处。'
        });
        issues.push(issue);
      }
    }

    const invalidRoleCombinations: Record<string, string[]> = {
      'button': ['a', 'input'],
      'link': ['button', 'input[type="button"]'],
      'checkbox': ['button', 'a'],
      'radio': ['button', 'a']
    };

    const invalidTags = invalidRoleCombinations[role];
    if (invalidTags) {
      const tag = element.tag;
      const type = element.attributes['type'];
      
      for (const invalidTag of invalidTags) {
        if (invalidTag.includes('[type="')) {
          const tagMatch = invalidTag.match(/^(\w+)\[/);
          if (tagMatch && tag === tagMatch[1]) {
            const typeMatch = invalidTag.match(/type="([^"]+)"/);
            if (typeMatch && type === typeMatch[1]) {
              const issue = RulesEngine.createIssue({
                type: 'aria_role_mismatch',
                severity: 'medium',
                title: 'ARIA role 与原生语义可能冲突',
                description: `元素 <${tag} type="${type}"> 设置了 role="${role}"，这可能与原生语义冲突或产生意外行为。选择器: ${element.selector}`,
                element,
                suggestion: `请考虑是否需要使用 role="${role}"。<${tag}> 元素已有原生语义，添加不同的 role 可能会让屏幕阅读器用户感到困惑。如果需要自定义控件的行为，建议使用更通用的元素（如 <div> 或 <span>）并添加适当的 ARIA 属性和键盘交互。`
              });
              issues.push(issue);
            }
          }
        } else if (tag === invalidTag && !type) {
          const issue = RulesEngine.createIssue({
            type: 'aria_role_mismatch',
            severity: 'medium',
            title: 'ARIA role 与原生语义可能冲突',
            description: `元素 <${tag}> 设置了 role="${role}"，这可能与原生语义冲突。选择器: ${element.selector}`,
            element,
            suggestion: `请考虑是否需要使用 role="${role}"。<${tag}> 元素已有原生语义，添加不同的 role 可能会让屏幕阅读器用户感到困惑。如果需要自定义控件，建议使用 <div> 或 <span> 配合完整的 ARIA 实现。`
          });
          issues.push(issue);
        }
      }
    }

    return issues;
  }

  private checkRoleRequirements(
    element: FocusableElement,
    role: string
  ): Issue[] {
    const issues: Issue[] = [];

    const rolesRequiringAccessibleName = [
      'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
      'dialog', 'alertdialog'
    ];

    if (rolesRequiringAccessibleName.includes(role)) {
      const hasAccessibleName = 
        element.ariaLabel !== null || 
        element.ariaLabelledBy !== null ||
        (element.textContent && element.textContent.trim().length > 0);

      if (!hasAccessibleName) {
        const issue = RulesEngine.createIssue({
          type: 'aria_role_mismatch',
          severity: 'critical',
          title: `role="${role}" 元素缺少可访问名称`,
          description: `元素设置了 role="${role}"，但没有可访问名称（没有 aria-label、aria-labelledby 或有意义的 textContent）。选择器: ${element.selector}`,
          element,
          suggestion: `请为 role="${role}" 元素提供可访问名称。推荐方式：1. 使用元素内的可见文本（最优先）；2. 添加 aria-label="描述"；3. 使用 aria-labelledby 关联描述元素。`
        });
        issues.push(issue);
      }
    }

    const rolesRequiringSpecificChildren: Record<string, { parent: string; children: string[] }[]> = {
      'tablist': [{ parent: 'tablist', children: ['tab'] }],
      'menu': [{ parent: 'menu', children: ['menuitem', 'menuitemcheckbox', 'menuitemradio'] }],
      'radiogroup': [{ parent: 'radiogroup', children: ['radio'] }],
      'group': []
    };

    return issues;
  }

  private checkDeprecatedRoles(
    element: FocusableElement,
    role: string
  ): Issue[] {
    const issues: Issue[] = [];

    const deprecatedRoles: Record<string, string> = {
      'directory': 'list',
      'img': 'img (非废弃但应谨慎使用)',
      'presentation': 'none (优先使用 role="none")',
      'region': 'region (需要 aria-label 或 aria-labelledby)'
    };

    if (role === 'presentation') {
      const issue = RulesEngine.createIssue({
        type: 'aria_role_mismatch',
        severity: 'low',
        title: '使用了已废弃的 role="presentation"',
        description: `元素使用了 role="presentation"，建议使用 role="none" 替代。选择器: ${element.selector}`,
        element,
        suggestion: '考虑使用 role="none" 替代 role="presentation"。两者功能相同，但 role="none" 是更现代的命名方式，更清晰地表达其意图。'
      });
      issues.push(issue);
    }

    if (role === 'region') {
      const hasLabel = element.ariaLabel !== null || element.ariaLabelledBy !== null;
      if (!hasLabel) {
        const issue = RulesEngine.createIssue({
          type: 'aria_role_mismatch',
          severity: 'medium',
          title: 'role="region" 缺少可访问名称',
          description: `元素设置了 role="region"，但没有 aria-label 或 aria-labelledby。未命名的 region 不会被屏幕阅读器地标导航识别。选择器: ${element.selector}`,
          element,
          suggestion: '请为 role="region" 元素添加 aria-label 或 aria-labelledby 来命名该区域。未命名的区域对屏幕阅读器用户来说是不可发现的地标。如果这不是一个重要的地标区域，考虑移除 role="region"。'
        });
        issues.push(issue);
      }
    }

    return issues;
  }

  private hasMeaningfulNativeSemantics(element: FocusableElement): boolean {
    const meaningfulTags = [
      'a', 'button', 'input', 'select', 'textarea', 'label',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'form', 'fieldset', 'legend',
      'article', 'section', 'nav', 'aside', 'header', 'footer', 'main',
      'figure', 'figcaption',
      'details', 'summary',
      'dialog',
      'img', 'figure',
      'time', 'mark', 'q', 'blockquote', 'cite'
    ];

    if (meaningfulTags.includes(element.tag)) {
      if (element.tag === 'input') {
        const type = (element.attributes['type'] || 'text').toLowerCase();
        if (type === 'hidden') {
          return false;
        }
      }
      return true;
    }

    return false;
  }
}
