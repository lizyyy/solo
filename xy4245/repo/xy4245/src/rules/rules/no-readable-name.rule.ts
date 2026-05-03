import { ScanResult, Issue, IssueType, FocusableElement } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class NoReadableNameRule implements Rule {
  readonly type: IssueType = 'no_readable_name';
  readonly name = '无可读名称';
  readonly description = '检测交互元素（按钮、链接、输入框等）是否有可被屏幕阅读器识别的名称';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    for (const element of scanResult.focusableElements) {
      if (!this.isInteractiveElement(element)) {
        continue;
      }

      const readableName = this.getReadableName(element);
      
      if (!readableName || readableName.trim().length === 0) {
        const severity = this.determineSeverity(element);
        const title = this.getTitleForElement(element);
        const description = this.getDescriptionForElement(element);
        const suggestion = this.getSuggestionForElement(element);

        const issue = RulesEngine.createIssue({
          type: 'no_readable_name',
          severity,
          title,
          description,
          element,
          suggestion
        });
        issues.push(issue);
      }
    }

    return issues;
  }

  private isInteractiveElement(element: FocusableElement): boolean {
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
    const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'option', 'switch', 'checkbox', 'radio'];

    if (interactiveTags.includes(element.tag)) {
      return true;
    }

    if (element.role && interactiveRoles.includes(element.role)) {
      return true;
    }

    if (element.tabindex !== null && element.tabindex >= 0) {
      return true;
    }

    return false;
  }

  private getReadableName(element: FocusableElement): string {
    if (element.ariaLabel) {
      return element.ariaLabel;
    }

    if (element.ariaLabelledBy) {
      return `[通过 aria-labelledby 引用: ${element.ariaLabelledBy}]`;
    }

    if (element.textContent && element.textContent.trim().length > 0) {
      const text = element.textContent.trim();
      if (text.length > 0 && !this.isPlaceholderText(text)) {
        return text;
      }
    }

    return '';
  }

  private isPlaceholderText(text: string): boolean {
    const placeholders = [
      '请输入', '请选择', '搜索', '查找', '提交', '确定', '取消',
      '请输入...', '请选择...'
    ];
    return placeholders.some(p => text.toLowerCase() === p.toLowerCase());
  }

  private determineSeverity(element: FocusableElement): Issue['severity'] {
    if (element.tag === 'button' || element.role === 'button') {
      return 'critical';
    }

    if (element.tag === 'a' && element.attributes['href']) {
      return 'high';
    }

    if (element.tag === 'input') {
      const type = (element.attributes['type'] || 'text').toLowerCase();
      if (['submit', 'button', 'image'].includes(type)) {
        return 'critical';
      }
      return 'high';
    }

    if (element.role === 'link' || element.role === 'menuitem' || element.role === 'tab') {
      return 'high';
    }

    return 'medium';
  }

  private getTitleForElement(element: FocusableElement): string {
    if (element.tag === 'button' || element.role === 'button') {
      return '按钮缺少可读名称';
    }
    if (element.tag === 'a' || element.role === 'link') {
      return '链接缺少可读名称';
    }
    if (element.tag === 'input') {
      return '输入框缺少可读名称';
    }
    if (element.role === 'menuitem') {
      return '菜单项缺少可读名称';
    }
    if (element.role === 'tab') {
      return '标签页缺少可读名称';
    }
    return '交互元素缺少可读名称';
  }

  private getDescriptionForElement(element: FocusableElement): string {
    const tagInfo = element.role 
      ? `<${element.tag}> 且 role="${element.role}"`
      : `<${element.tag}>`;
    
    return `发现一个${tagInfo}元素没有可被屏幕阅读器识别的名称。选择器: ${element.selector}。${
      element.ariaLabelledBy 
        ? `虽然设置了 aria-labelledby="${element.ariaLabelledBy}"，但未找到对应的标签元素。`
        : '该元素没有 aria-label，也没有关联的 aria-labelledby，且 textContent 为空或没有意义。'
    }`;
  }

  private getSuggestionForElement(element: FocusableElement): string {
    if (element.tag === 'button' || element.role === 'button') {
      return '请为按钮添加可读名称。推荐方式：1. 使用按钮内的可见文本（最优先）；2. 添加 aria-label="按钮描述" 属性；3. 使用 aria-labelledby 关联描述元素。注意：如果按钮只包含图标，必须提供 aria-label 或 aria-labelledby。';
    }

    if (element.tag === 'a' || element.role === 'link') {
      return '请为链接添加可读名称。推荐方式：1. 使用链接内的可见文本（最优先），文本应描述链接的目的而非动作；2. 添加 aria-label="链接描述" 属性；3. 使用 aria-labelledby。注意：链接文本不应只有"点击这里"、"查看更多"等通用词汇，应该具体描述链接目标。';
    }

    if (element.tag === 'input') {
      const type = (element.attributes['type'] || 'text').toLowerCase();
      
      if (['submit', 'button', 'image'].includes(type)) {
        return '请为输入按钮添加可读名称。对于 type="submit" 或 type="button"，可以使用 value 属性。对于 type="image"，必须提供 alt 属性。也可以使用 aria-label 或 aria-labelledby。';
      }

      return '请为输入框添加可读名称。推荐方式：1. 使用 <label> 标签（最优先），通过 for 属性关联输入框的 id，或嵌套输入框；2. 添加 aria-label="输入框描述"；3. 使用 aria-labelledby；4. 使用 placeholder 只能作为辅助，不能替代标签。';
    }

    return '请为交互元素添加可读名称。推荐方式：1. 使用元素内的可见文本（最优先）；2. 添加 aria-label="描述" 属性；3. 使用 aria-labelledby 关联描述元素。';
  }
}
