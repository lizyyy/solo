import { ScanResult, Issue, IssueType, FocusableElement, TabTrajectoryItem } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class FocusOrderViolationRule implements Rule {
  readonly type: IssueType = 'focus_order_violation';
  readonly name = '焦点顺序违规';
  readonly description = '检测 Tab 焦点顺序是否符合逻辑阅读顺序';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    if (!scanResult.trajectory || scanResult.trajectory.items.length < 2) {
      return this.checkStaticTabindex(scanResult);
    }

    const domOrder = this.getDomOrder(scanResult);
    const trajectoryOrder = scanResult.trajectory.items;

    const domIndexMap = new Map<string, number>();
    domOrder.forEach((el, index) => {
      domIndexMap.set(el.selector, index);
      domIndexMap.set(el.xpath, index);
    });

    let lastDomIndex = -1;

    for (let i = 0; i < trajectoryOrder.length; i++) {
      const item = trajectoryOrder[i];
      const currentDomIndex = this.findDomIndex(item, domIndexMap);

      if (currentDomIndex !== null && lastDomIndex !== -1) {
        const hasPositiveTabindex = this.hasPositiveTabindex(item, scanResult);
        
        if (currentDomIndex < lastDomIndex && !hasPositiveTabindex) {
          const matchingElement = scanResult.focusableElements.find(el =>
            el.selector === item.selector || el.xpath === item.xpath
          );

          const issue = RulesEngine.createIssue({
            type: 'focus_order_violation',
            severity: 'high',
            title: '焦点顺序与 DOM 顺序不一致',
            description: `Tab 焦点在第 ${i + 1} 步跳到了一个在 DOM 中更早出现的元素。DOM 索引从 ${lastDomIndex} 跳到了 ${currentDomIndex}。这种焦点顺序的跳跃可能会让键盘用户感到困惑。当前元素: ${item.selector}`,
            element: matchingElement || {
              selector: item.selector,
              xpath: item.xpath,
              tagName: item.tagName,
              textContent: item.textContent,
              ariaLabel: item.ariaLabel
            },
            suggestion: '请确保 Tab 焦点顺序遵循逻辑阅读顺序（通常是从上到下、从左到右）。如果需要调整焦点顺序，应通过 DOM 顺序调整而非使用 tabindex。仅在特殊情况下使用 tabindex="0" 将元素纳入 Tab 序列，或 tabindex="-1" 使元素可编程聚焦。不建议使用 tabindex > 0，因为这会破坏自然的焦点顺序。',
            trajectoryIndex: i
          });
          issues.push(issue);
        }
      }

      if (currentDomIndex !== null) {
        lastDomIndex = currentDomIndex;
      }
    }

    issues.push(...this.checkFocusJumps(scanResult));

    return issues;
  }

  private getDomOrder(scanResult: ScanResult): FocusableElement[] {
    const elements = [...scanResult.focusableElements];
    
    elements.sort((a, b) => {
      if (a.tabindex !== null && a.tabindex > 0 && 
          (b.tabindex === null || b.tabindex <= 0)) {
        return a.tabindex - (b.tabindex || 0);
      }
      if (b.tabindex !== null && b.tabindex > 0 && 
          (a.tabindex === null || a.tabindex <= 0)) {
        return -1;
      }
      if (a.tabindex !== null && b.tabindex !== null && 
          a.tabindex > 0 && b.tabindex > 0) {
        return a.tabindex - b.tabindex;
      }
      
      return 0;
    });

    return elements;
  }

  private findDomIndex(
    item: TabTrajectoryItem, 
    indexMap: Map<string, number>
  ): number | null {
    if (indexMap.has(item.selector)) {
      return indexMap.get(item.selector)!;
    }
    if (indexMap.has(item.xpath)) {
      return indexMap.get(item.xpath)!;
    }
    return null;
  }

  private hasPositiveTabindex(
    item: TabTrajectoryItem,
    scanResult: ScanResult
  ): boolean {
    const element = scanResult.focusableElements.find(el =>
      el.selector === item.selector || el.xpath === item.xpath
    );
    return element !== undefined && element.tabindex !== null && element.tabindex > 0;
  }

  private checkFocusJumps(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    if (!scanResult.trajectory) return [];

    const items = scanResult.trajectory.items;
    const seenSelectors = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (seenSelectors.has(item.selector) && i > 0) {
        const matchingElement = scanResult.focusableElements.find(el =>
          el.selector === item.selector || el.xpath === item.xpath
        );

        const issue = RulesEngine.createIssue({
          type: 'focus_order_violation',
          severity: 'medium',
          title: '焦点循环回到之前的元素',
          description: `Tab 焦点在第 ${i + 1} 步回到了之前已经访问过的元素: ${item.selector}。这可能表示存在焦点循环或意外的焦点跳转。`,
          element: matchingElement || {
            selector: item.selector,
            xpath: item.xpath,
            tagName: item.tagName,
            textContent: item.textContent,
            ariaLabel: item.ariaLabel
          },
          suggestion: '请检查焦点顺序逻辑。如果这是故意的（如焦点陷阱），请确保这是预期行为。否则，可能需要检查是否存在导致焦点循环的 JavaScript 事件处理。',
          trajectoryIndex: i
        });
        issues.push(issue);
      }

      seenSelectors.add(item.selector);
    }

    return issues;
  }

  private checkStaticTabindex(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    const positiveTabindexElements = scanResult.focusableElements.filter(el =>
      el.tabindex !== null && el.tabindex > 0
    );

    if (positiveTabindexElements.length > 0) {
      positiveTabindexElements.forEach(element => {
        const issue = RulesEngine.createIssue({
          type: 'focus_order_violation',
          severity: 'medium',
          title: '使用了正 tabindex 值',
          description: `元素使用了 tabindex="${element.tabindex}"，正值会改变自然的 Tab 顺序，可能导致意外的焦点行为。选择器: ${element.selector}`,
          element,
          suggestion: '建议避免使用正 tabindex 值（tabindex > 0）。正 tabindex 会使元素获得优先级，破坏自然的 DOM 顺序。如果需要调整焦点顺序，应通过重新排列 DOM 元素来实现。使用 tabindex="0" 将元素添加到自然 Tab 序列，或 tabindex="-1" 使元素只能通过编程聚焦。'
        });
        issues.push(issue);
      });
    }

    return issues;
  }
}
