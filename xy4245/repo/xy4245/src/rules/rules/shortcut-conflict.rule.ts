import { ScanResult, Issue, IssueType, FocusableElement } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class ShortcutConflictRule implements Rule {
  readonly type: IssueType = 'shortcut_conflict';
  readonly name = '快捷键冲突';
  readonly description = '检测 accesskey 属性的快捷键是否存在冲突或潜在问题';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    const shortcutElements = scanResult.focusableElements.filter(el => 
      el.attributes['accesskey'] !== undefined
    );

    if (shortcutElements.length === 0) {
      return [];
    }

    const shortcutMap: Map<string, FocusableElement[]> = new Map();

    for (const element of shortcutElements) {
      const accesskey = element.attributes['accesskey'];
      const keys = this.parseAccesskey(accesskey);

      for (const key of keys) {
        if (!shortcutMap.has(key)) {
          shortcutMap.set(key, []);
        }
        shortcutMap.get(key)!.push(element);
      }
    }

    for (const [key, elements] of shortcutMap) {
      if (elements.length > 1) {
        for (const element of elements) {
          const otherElements = elements.filter(e => e !== element);
          const issue = RulesEngine.createIssue({
            type: 'shortcut_conflict',
            severity: 'high',
            title: '快捷键冲突',
            description: `发现多个元素使用了相同的 accesskey 快捷键 "${key}"。当前元素选择器: ${element.selector}。冲突的其他元素: ${
              otherElements.map(e => e.selector).join(', ')
            }。`,
            element,
            suggestion: `请为每个元素分配唯一的快捷键。accesskey="${key}" 被 ${elements.length} 个元素共享。建议：1. 检查每个元素的 accesskey 值，确保唯一性；2. 考虑使用更复杂的快捷键组合；3. 提供修改或关闭快捷键的方式（符合 WCAG 2.1 2.1.4）。`
          });
          issues.push(issue);
        }
      }
    }

    for (const element of shortcutElements) {
      const accesskey = element.attributes['accesskey'];
      
      if (this.isSingleCharacter(accesskey)) {
        if (this.isCommonCharacter(accesskey)) {
          const issue = RulesEngine.createIssue({
            type: 'shortcut_conflict',
            severity: 'medium',
            title: '快捷键可能与屏幕阅读器冲突',
            description: `元素使用了单个字符作为快捷键 accesskey="${accesskey}"，这可能与屏幕阅读器的快捷键冲突。选择器: ${element.selector}`,
            element,
            suggestion: '根据 WCAG 2.1 2.1.4 (Character Key Shortcuts)，如果使用单个字符作为快捷键，应提供以下至少一种机制：1. 可以关闭快捷键；2. 可以将快捷键重新映射为使用一个或多个非打印键（如 Ctrl、Alt）的组合；3. 快捷键仅在组件获得焦点时激活。'
          });
          issues.push(issue);
        }
      }

      const readableName = this.getReadableName(element);
      if (!readableName || readableName.trim().length === 0) {
        const issue = RulesEngine.createIssue({
          type: 'shortcut_conflict',
          severity: 'medium',
          title: '带快捷键的元素缺少可读名称',
          description: `一个带有 accesskey="${accesskey}" 快捷键的元素没有可读名称。选择器: ${element.selector}。用户无法知道这个快捷键触发什么操作。`,
          element,
          suggestion: '请为带有快捷键的元素添加可读名称（通过可见文本、aria-label 或 aria-labelledby）。同时，考虑添加视觉提示显示快捷键（如 "提交 (Alt+S)"）。'
        });
        issues.push(issue);
      }
    }

    return issues;
  }

  private parseAccesskey(accesskey: string): string[] {
    if (!accesskey) return [];
    
    return accesskey
      .split(/[\s+]+/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
  }

  private isSingleCharacter(key: string): boolean {
    const keys = this.parseAccesskey(key);
    return keys.length === 1 && keys[0].length === 1;
  }

  private isCommonCharacter(key: string): boolean {
    const commonChars = [
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];
    
    const keys = this.parseAccesskey(key);
    return keys.some(k => commonChars.includes(k.toLowerCase()));
  }

  private getReadableName(element: FocusableElement): string {
    if (element.ariaLabel) {
      return element.ariaLabel;
    }

    if (element.ariaLabelledBy) {
      return `[aria-labelledby: ${element.ariaLabelledBy}]`;
    }

    if (element.textContent && element.textContent.trim().length > 0) {
      return element.textContent.trim();
    }

    return '';
  }
}
