import { BaseChecker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export class FocusOrderChecker extends BaseChecker {
  name = 'focus-order';
  description = '检查键盘焦点顺序是否逻辑合理，与 DOM 顺序一致';

  async check(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { focusPath, page } = context;

    if (focusPath.length === 0) {
      return { issues, metadata: { skipped: true, reason: 'No focusable elements found' } };
    }

    for (let i = 0; i < focusPath.length - 1; i++) {
      const current = focusPath[i];
      const next = focusPath[i + 1];

      if (!current.isVisible) {
        const elementInfo = await this.getElementInfo(page, current.selector);
        issues.push(
          this.createIssue(
            'focus-order',
            'high',
            '不可见元素获取焦点',
            `索引 ${i} 的元素不可见但可获取焦点，这会导致键盘用户困惑。`,
            '确保不可见的元素（如 display: none、visibility: hidden 或 offscreen 的元素）不被包含在 Tab 焦点序列中。可以使用 tabindex="-1" 或 JavaScript 控制焦点。',
            elementInfo,
            { focusIndex: i }
          )
        );
      }

      if (current.tabIndexValue !== null && current.tabIndexValue > 0) {
        const elementInfo = await this.getElementInfo(page, current.selector);
        issues.push(
          this.createIssue(
            'tabindex',
            'medium',
            '使用正 tabindex 值',
            `元素使用了 tabindex="${current.tabIndexValue}"，这会改变默认的 Tab 焦点顺序。`,
            '避免使用正 tabindex 值，让焦点遵循自然的 DOM 顺序。如果需要调整焦点顺序，可以重新组织 DOM 结构。',
            elementInfo,
            { focusIndex: i }
          )
        );
      }
    }

    const focusLoopResult = await this.checkFocusLoop(context);
    issues.push(...focusLoopResult.issues);

    const domOrderResult = await this.checkDomOrderMatch(context);
    issues.push(...domOrderResult.issues);

    return { issues, metadata: { totalFocusable: focusPath.length } };
  }

  private async checkFocusLoop(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { focusPath } = context;

    const visitedSelectors = new Map<string, number>();

    for (let i = 0; i < focusPath.length; i++) {
      const selector = focusPath[i].selector;
      if (visitedSelectors.has(selector)) {
        const firstIndex = visitedSelectors.get(selector)!;
        const elementInfo = await this.getElementInfo(context.page, selector);
        issues.push(
          this.createIssue(
            'focus-loop',
            'high',
            '焦点循环检测',
            `焦点在第 ${firstIndex} 步和第 ${i} 步回到了相同元素：${selector}。这可能表示焦点陷阱或异常的焦点行为。`,
            '检查是否存在意外的焦点循环。如果是模态框，确保焦点正确地被捕获并能使用 Escape 退出。',
            elementInfo,
            { focusIndex: i, previousFocus: focusPath[i - 1]?.selector }
          )
        );
      }
      visitedSelectors.set(selector, i);
    }

    return { issues };
  }

  private async checkDomOrderMatch(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { focusPath, page } = context;

    const domOrder = await page.evaluate(() => {
      const focusable = document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(focusable).map((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          window.getComputedStyle(el).visibility !== 'hidden';
        return {
          tagName: el.tagName.toLowerCase(),
          isVisible,
          x: rect.left,
          y: rect.top,
        };
      });
    });

    const visibleDomOrder = domOrder.filter((item) => item.isVisible);
    const visibleFocusPath = focusPath.filter((item) => item.isVisible);

    if (visibleFocusPath.length > 0 && visibleDomOrder.length > 0) {
      if (visibleFocusPath.length !== visibleDomOrder.length) {
        issues.push(
          this.createIssue(
            'focus-order',
            'medium',
            'Tab 可聚焦元素数量与 DOM 不匹配',
            `通过 Tab 导航发现 ${visibleFocusPath.length} 个可见的可聚焦元素，但 DOM 中存在 ${visibleDomOrder.length} 个可见的可聚焦元素。`,
            '检查是否有元素被意外跳过或重复导航。这可能是由于 tabindex 或 JavaScript 焦点管理导致的。',
            {
              selector: 'document',
              tagName: 'document',
              accessibleName: '',
              domSnippet: '',
            }
          )
        );
      }
    }

    return { issues };
  }
}
