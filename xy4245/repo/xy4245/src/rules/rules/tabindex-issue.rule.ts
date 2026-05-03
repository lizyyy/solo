import { ScanResult, Issue, IssueType, FocusableElement } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class TabindexIssueRule implements Rule {
  readonly type: IssueType = 'tabindex_issue';
  readonly name = 'tabindex 问题';
  readonly description = '检测 tabindex 属性的不当使用';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    for (const element of scanResult.focusableElements) {
      if (element.tabindex === null) {
        continue;
      }

      if (element.tabindex > 0) {
        const issue = RulesEngine.createIssue({
          type: 'tabindex_issue',
          severity: 'medium',
          title: '使用了正 tabindex 值',
          description: `元素使用了 tabindex="${element.tabindex}"。正值 tabindex 会改变自然的 Tab 导航顺序，使元素优先获得焦点，这可能导致键盘用户的焦点顺序与视觉顺序不一致。选择器: ${element.selector}`,
          element,
          suggestion: '建议避免使用正 tabindex 值。正 tabindex 会破坏 DOM 的自然焦点顺序，使维护变得困难。更好的做法是：1. 通过重新排列 DOM 元素来调整焦点顺序；2. 如果元素需要可聚焦但不在 Tab 序列中，使用 tabindex="-1"；3. 如果需要将元素添加到 Tab 序列中，使用 tabindex="0"。'
        });
        issues.push(issue);
      }

      if (element.tabindex === -1) {
        if (this.isNaturallyFocusable(element)) {
          if (element.visible && !element.ariaHidden) {
            const issue = RulesEngine.createIssue({
              type: 'tabindex_issue',
              severity: 'low',
              title: '原生可聚焦元素设置了 tabindex="-1"',
              description: `一个原生可聚焦的 <${element.tag}> 元素设置了 tabindex="-1"，这会将其从 Tab 序列中移除。如果这是故意的，可能没问题；否则，这可能是一个错误。选择器: ${element.selector}`,
              element,
              suggestion: '请确认是否有意将该元素从 Tab 序列中移除。原生可聚焦元素（如按钮、链接、输入框）默认就在 Tab 序列中。设置 tabindex="-1" 会让用户无法通过 Tab 键访问该元素。如果需要元素可编程聚焦但不通过 Tab 访问，这是正确的做法。否则，考虑移除 tabindex="-1"。'
            });
            issues.push(issue);
          }
        }
      }

      if (element.tabindex === 0) {
        if (!this.isNaturallyFocusable(element)) {
          if (this.shouldHaveRole(element)) {
            const issue = RulesEngine.createIssue({
              type: 'tabindex_issue',
              severity: 'high',
              title: '自定义可聚焦元素缺少适当的 ARIA 角色',
              description: `一个非原生可聚焦元素设置了 tabindex="0"，但没有设置适当的 ARIA 角色或语义。这会让屏幕阅读器用户无法理解该元素的用途。选择器: ${element.selector}`,
              element,
              suggestion: '当使自定义元素可聚焦时（通过 tabindex="0"），请确保提供适当的语义：1. 设置 role 属性（如 role="button"、role="link"）；2. 提供可读名称（通过 aria-label 或 aria-labelledby）；3. 实现键盘交互（如 Enter 和 Space 键激活按钮）；4. 确保元素具有适当的视觉焦点样式。'
            });
            issues.push(issue);
          }
        }
      }
    }

    issues.push(...this.checkTabindexConsistency(scanResult));

    return issues;
  }

  private isNaturallyFocusable(element: FocusableElement): boolean {
    const naturallyFocusableTags = [
      'a', 'area', 'button', 'input', 'select', 'textarea', 'iframe'
    ];

    if (naturallyFocusableTags.includes(element.tag)) {
      if (element.tag === 'input') {
        const type = (element.attributes['type'] || 'text').toLowerCase();
        if (['hidden'].includes(type)) {
          return false;
        }
        if (element.attributes['disabled']) {
          return false;
        }
      }
      return true;
    }

    if (element.attributes['contenteditable'] === 'true') {
      return true;
    }

    return false;
  }

  private shouldHaveRole(element: FocusableElement): boolean {
    const hasRole = element.role !== null;
    const hasAriaLabel = element.ariaLabel !== null;
    const hasAriaLabelledBy = element.ariaLabelledBy !== null;

    if (!hasRole && !hasAriaLabel && !hasAriaLabelledBy) {
      return true;
    }

    if (!hasRole) {
      return true;
    }

    return false;
  }

  private checkTabindexConsistency(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    const positiveTabindexElements = scanResult.focusableElements.filter(el =>
      el.tabindex !== null && el.tabindex > 0
    );

    if (positiveTabindexElements.length > 0) {
      const tabindexValues = positiveTabindexElements.map(el => el.tabindex!);
      const uniqueValues = new Set(tabindexValues);
      
      if (uniqueValues.size !== tabindexValues.length) {
        for (const element of positiveTabindexElements) {
          const others = positiveTabindexElements.filter(el => 
            el !== element && el.tabindex === element.tabindex
          );
          
          if (others.length > 0) {
            const issue = RulesEngine.createIssue({
              type: 'tabindex_issue',
              severity: 'high',
              title: '多个元素使用了相同的正 tabindex 值',
              description: `多个元素使用了相同的 tabindex="${element.tabindex}" 值。选择器: ${element.selector}。其他使用相同值的元素: ${others.map(e => e.selector).join(', ')}。`,
              element,
              suggestion: '每个使用正 tabindex 的元素应该有唯一的值。但是，更好的做法是完全避免使用正 tabindex，而是通过 DOM 顺序来控制焦点顺序。请考虑移除所有正 tabindex 值，通过重新排列 DOM 元素来调整焦点顺序。'
            });
            issues.push(issue);
          }
        }
      }
    }

    return issues;
  }
}
