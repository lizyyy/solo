import { ScanResult, Issue, IssueType, FocusableElement } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class FocusToHiddenRule implements Rule {
  readonly type: IssueType = 'focus_to_hidden';
  readonly name = '焦点跳到隐藏元素';
  readonly description = '检测 Tab 焦点是否跳到了不可见或 aria-hidden="true" 的元素上';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    if (!scanResult.trajectory) {
      return this.checkStaticElements(scanResult);
    }

    const hiddenElements = scanResult.focusableElements.filter(el => 
      !el.visible || el.ariaHidden
    );

    const hiddenSelectors = new Set(hiddenElements.map(el => el.selector));
    const hiddenXPaths = new Set(hiddenElements.map(el => el.xpath));

    scanResult.trajectory.items.forEach((item, index) => {
      if (!item.visible) {
        const matchingElement = hiddenElements.find(el => 
          el.selector === item.selector || 
          el.xpath === item.xpath
        );

        if (matchingElement) {
          const issue = RulesEngine.createIssue({
            type: 'focus_to_hidden',
            severity: 'critical',
            title: 'Tab 焦点跳到了隐藏元素',
            description: `在 Tab 轨迹第 ${index + 1} 步，焦点跳到了不可见的元素上。${
              matchingElement.ariaHidden ? '该元素设置了 aria-hidden="true"。' : 
              '该元素通过 CSS 隐藏（display: none, visibility: hidden 或 opacity: 0）。'
            }`,
            element: matchingElement,
            suggestion: '请检查 DOM 顺序，确保 Tab 焦点只停留在可见元素上。如果元素是临时隐藏的（如未展开的下拉菜单），请确保它们在隐藏时不会获得焦点。考虑使用 inert 属性或在隐藏元素上设置 tabindex="-1"。',
            trajectoryIndex: index
          });
          issues.push(issue);
        }
      }
    });

    return issues;
  }

  private checkStaticElements(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];
    
    const hiddenFocusable = scanResult.focusableElements.filter(el => 
      (!el.visible || el.ariaHidden) && el.tabindex !== -1
    );

    hiddenFocusable.forEach(element => {
      const issue = RulesEngine.createIssue({
        type: 'focus_to_hidden',
        severity: 'high',
        title: '隐藏元素可获得焦点',
        description: `发现一个${element.ariaHidden ? '设置了 aria-hidden="true"' : 'CSS 隐藏的'}元素，该元素可以通过键盘获得焦点。选择器: ${element.selector}`,
        element,
        suggestion: '请确保隐藏元素不会获得焦点。可以设置 tabindex="-1"，或使用 inert 属性，或确保元素在隐藏状态下不包含可聚焦的子元素。'
      });
      issues.push(issue);
    });

    return issues;
  }
}
