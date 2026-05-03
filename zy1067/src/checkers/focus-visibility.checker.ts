import { BaseChecker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export class FocusVisibilityChecker extends BaseChecker {
  name = 'focus-visibility';
  description = '检查焦点是否可见，确保键盘用户能看到当前焦点位置';

  async check(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { focusPath, page } = context;

    if (focusPath.length === 0) {
      return { issues, metadata: { skipped: true } };
    }

    for (let i = 0; i < focusPath.length; i++) {
      const focusItem = focusPath[i];
      
      if (!focusItem.focusVisible && !focusItem.hasVisibleOutline) {
        const elementInfo = await this.getElementInfo(page, focusItem.selector);
        issues.push(
          this.createIssue(
            'focus-visibility',
            'high',
            '焦点不可见',
            `索引 ${i} 的元素获取焦点时没有可见的焦点指示器。键盘用户无法确定当前焦点位置。`,
            '为所有可聚焦元素提供明确的焦点样式。不要使用 outline: none 而不提供替代的焦点样式。可以使用 :focus-visible 伪类或自定义焦点样式。',
            elementInfo,
            { focusIndex: i }
          )
        );
      }
    }

    const outlineOverrideResult = await this.checkOutlineOverride(context);
    issues.push(...outlineOverrideResult.issues);

    return { issues };
  }

  private async checkOutlineOverride(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { page } = context;

    const outlineOverrides = await page.evaluate(() => {
      const focusableSelectors = [
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])',
      ];

      const results: Array<{
        selector: string;
        tagName: string;
        hasOutlineNone: boolean;
        hasOutline: boolean;
        hasBoxShadow: boolean;
        hasBorder: boolean;
        computedStyle: {
          outline: string;
          outlineStyle: string;
          outlineWidth: string;
          boxShadow: string;
          border: string;
        };
      }> = [];

      const elements = document.querySelectorAll(focusableSelectors.join(', '));

      for (const el of Array.from(elements)) {
        const computed = window.getComputedStyle(el);
        const hasOutlineNone =
          computed.outlineStyle === 'none' ||
          computed.outline === 'none' ||
          parseInt(computed.outlineWidth) === 0;
        
        const hasVisibleFocusAlternative =
          computed.boxShadow !== 'none' ||
          computed.borderColor !== 'initial';

        results.push({
          selector: el.tagName.toLowerCase(),
          tagName: el.tagName.toLowerCase(),
          hasOutlineNone,
          hasOutline: computed.outline !== 'none' && parseInt(computed.outlineWidth) > 0,
          hasBoxShadow: computed.boxShadow !== 'none',
          hasBorder: computed.border !== 'none',
          computedStyle: {
            outline: computed.outline,
            outlineStyle: computed.outlineStyle,
            outlineWidth: computed.outlineWidth,
            boxShadow: computed.boxShadow,
            border: computed.border,
          },
        });
      }

      return results;
    });

    const outlineNoneElements = outlineOverrides.filter((e) => e.hasOutlineNone);
    
    if (outlineNoneElements.length > 0) {
      const buttonCount = outlineNoneElements.filter((e) => e.tagName === 'button').length;
      const linkCount = outlineNoneElements.filter((e) => e.tagName === 'a').length;
      const inputCount = outlineNoneElements.filter((e) => ['input', 'select', 'textarea'].includes(e.tagName)).length;

      issues.push(
        this.createIssue(
          'focus-visibility',
          'medium',
          '检测到 outline: none 样式',
          `检测到 ${outlineNoneElements.length} 个元素使用了 outline: none 或类似样式。其中按钮 ${buttonCount} 个，链接 ${linkCount} 个，表单控件 ${inputCount} 个。`,
          '如果使用 outline: none，请确保提供替代的焦点样式（如 box-shadow、border 变化等）。使用 :focus-visible 伪类可以只在键盘导航时显示焦点样式。',
          {
            selector: 'document',
            tagName: 'document',
            accessibleName: '',
            domSnippet: '',
          }
        )
      );
    }

    return { issues };
  }
}
