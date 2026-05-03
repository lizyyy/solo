import { ScanResult, Issue, IssueType, TabTrajectoryItem } from '../types';
import { Rule } from '../rule.interface';
import { RulesEngine } from '../rules-engine';

export class ModalNotTrappedRule implements Rule {
  readonly type: IssueType = 'modal_not_trapped';
  readonly name = '对话框未困住焦点';
  readonly description = '检测模态对话框（modal）打开时，焦点是否被困住在对话框内';

  check(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    if (!scanResult.trajectory) {
      return this.checkStaticModal(scanResult);
    }

    const modalElements = scanResult.focusableElements.filter(el => 
      el.ariaModal || el.role === 'dialog' || el.role === 'alertdialog'
    );

    if (modalElements.length === 0) {
      return [];
    }

    const modalSelectors = new Set(modalElements.map(el => el.selector));
    const modalXPaths = new Set(modalElements.map(el => el.xpath));

    const isModalElement = (item: TabTrajectoryItem): boolean => {
      if (item.isModal) return true;
      if (modalSelectors.has(item.selector)) return true;
      if (modalXPaths.has(item.xpath)) return true;
      return false;
    };

    let inModal = false;
    let modalEntryIndex: number | null = null;

    for (let i = 0; i < scanResult.trajectory.items.length; i++) {
      const item = scanResult.trajectory.items[i];
      const isModal = isModalElement(item);

      if (!inModal && isModal) {
        inModal = true;
        modalEntryIndex = i;
      }

      if (inModal && !isModal && modalEntryIndex !== null) {
        const escapedElement = scanResult.focusableElements.find(el =>
          el.selector === item.selector || el.xpath === item.xpath
        );

        const modalElement = scanResult.focusableElements.find(el =>
          isModalElement(scanResult.trajectory!.items[modalEntryIndex!])
        );

        const issue = RulesEngine.createIssue({
          type: 'modal_not_trapped',
          severity: 'critical',
          title: '模态对话框未困住焦点',
          description: `在 Tab 轨迹第 ${i + 1} 步，焦点从模态对话框逃离到了外部元素。对话框应该在打开时将焦点困住在对话框内。${
            modalEntryIndex !== null ? `焦点在第 ${modalEntryIndex + 1} 步进入对话框。` : ''
          }`,
          element: escapedElement || {
            selector: item.selector,
            xpath: item.xpath,
            tagName: item.tagName,
            textContent: item.textContent,
            ariaLabel: item.ariaLabel
          },
          suggestion: '请实现焦点陷阱（focus trap）机制。当模态对话框打开时，应确保：1. 焦点移至对话框内第一个可聚焦元素；2. Tab 键循环在对话框内；3. Shift+Tab 反向循环；4. 对话框外的元素无法被焦点。常用方法：监听 keydown 事件，在边界元素处手动重定向焦点；或使用 inert 属性使对话框外元素不可交互；或使用 aria-hidden="true" 配合 tabindex="-1"。',
          trajectoryIndex: i
        });
        issues.push(issue);

        inModal = false;
        modalEntryIndex = null;
      }
    }

    return issues;
  }

  private checkStaticModal(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];
    
    const modals = scanResult.focusableElements.filter(el =>
      el.ariaModal || el.role === 'dialog' || el.role === 'alertdialog'
    );

    if (modals.length === 0) {
      return [];
    }

    for (const modal of modals) {
      if (!modal.ariaModal) {
        const issue = RulesEngine.createIssue({
          type: 'modal_not_trapped',
          severity: 'high',
          title: '对话框缺少 aria-modal 属性',
          description: `发现一个对话框元素（role="${modal.role}"）但缺少 aria-modal="true" 属性。选择器: ${modal.selector}`,
          element: modal,
          suggestion: '请在对话框元素上添加 aria-modal="true" 属性，这会告知屏幕阅读器该对话框是模态的，对话框外的内容不可用。同时请确保实现焦点陷阱机制。'
        });
        issues.push(issue);
      }
    }

    return issues;
  }
}
