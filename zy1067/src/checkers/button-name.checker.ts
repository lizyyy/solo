import { BaseChecker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export class ButtonNameChecker extends BaseChecker {
  name = 'button-name';
  description = '检查按钮是否有可访问的名称，确保屏幕阅读器能正确识别按钮功能';

  async check(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { page } = context;

    const buttonInfo = await page.evaluate(() => {
      const buttons: Array<{
        selector: string;
        tagName: string;
        type: string | null;
        id: string | null;
        textContent: string | null;
        hasAriaLabel: boolean;
        ariaLabelText: string | null;
        hasAriaLabelledby: boolean;
        ariaLabelledbyText: string | null;
        hasTitle: boolean;
        titleText: string | null;
        hasInnerElements: boolean;
        innerImageAlt: string | null;
        isHidden: boolean;
        isDisabled: boolean;
        role: string | null;
        isLinkButton: boolean;
        isDivButton: boolean;
        hasOnClick: boolean;
        hasTabindex: boolean;
      }> = [];

      const allButtons = document.querySelectorAll(
        'button, [role="button"], a[role="button"], [onclick]:not(button)'
      );

      for (const el of Array.from(allButtons)) {
        const buttonEl = el as HTMLElement;
        const computed = window.getComputedStyle(buttonEl);
        const rect = buttonEl.getBoundingClientRect();

        const isHidden =
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          parseInt(computed.opacity) === 0 ||
          (rect.width === 0 && rect.height === 0);

        const isDisabled =
          buttonEl.hasAttribute('disabled') ||
          buttonEl.getAttribute('aria-disabled') === 'true';

        const role = buttonEl.getAttribute('role');
        const tagName = buttonEl.tagName.toLowerCase();

        const hasOnClick = buttonEl.hasAttribute('onclick');
        const hasTabindex = buttonEl.hasAttribute('tabindex');

        let textContent = buttonEl.textContent?.trim() || null;

        const innerImages = buttonEl.querySelectorAll('img[alt]');
        let innerImageAlt: string | null = null;
        if (innerImages.length > 0) {
          const alts = Array.from(innerImages)
            .map((img) => img.getAttribute('alt'))
            .filter(Boolean);
          if (alts.length > 0) {
            innerImageAlt = alts.join(' ');
          }
        }

        const innerIcons = buttonEl.querySelectorAll('[class*="icon"], [class*="Icon"], i, svg');
        const hasInnerElements = innerImages.length > 0 || innerIcons.length > 0;

        if (textContent === '' && hasInnerElements) {
          textContent = null;
        }

        const hasAriaLabel = !!buttonEl.getAttribute('aria-label');
        const ariaLabelText = buttonEl.getAttribute('aria-label') || null;

        const hasAriaLabelledby = !!buttonEl.getAttribute('aria-labelledby');
        let ariaLabelledbyText: string | null = null;
        const ariaLabelledby = buttonEl.getAttribute('aria-labelledby');
        if (ariaLabelledby) {
          const ids = ariaLabelledby.split(/\s+/);
          const texts: string[] = [];
          for (const id of ids) {
            const labelEl = document.getElementById(id);
            if (labelEl) {
              const labelText = labelEl.textContent?.trim();
              if (labelText) texts.push(labelText);
            }
          }
          if (texts.length > 0) {
            ariaLabelledbyText = texts.join(' ');
          }
        }

        const hasTitle = !!buttonEl.getAttribute('title');
        const titleText = buttonEl.getAttribute('title') || null;

        let selector = tagName;
        if (buttonEl.id) selector += `#${buttonEl.id}`;
        if (buttonEl.className) {
          const classes = buttonEl.className.split(' ').filter(Boolean).slice(0, 2).join('.');
          if (classes) selector += `.${classes}`;
        }

        const type = tagName === 'button' 
          ? (buttonEl as HTMLButtonElement).type || 'button'
          : null;

        buttons.push({
          selector,
          tagName,
          type,
          id: buttonEl.id || null,
          textContent,
          hasAriaLabel,
          ariaLabelText,
          hasAriaLabelledby,
          ariaLabelledbyText,
          hasTitle,
          titleText,
          hasInnerElements,
          innerImageAlt,
          isHidden,
          isDisabled,
          role,
          isLinkButton: tagName === 'a' && role === 'button',
          isDivButton: ['div', 'span'].includes(tagName) && role === 'button',
          hasOnClick,
          hasTabindex,
        });
      }

      return buttons;
    });

    const visibleButtons = buttonInfo.filter((btn) => !btn.isHidden && !btn.isDisabled);

    for (const button of visibleButtons) {
      const accessibleName =
        button.textContent ||
        button.ariaLabelText ||
        button.ariaLabelledbyText ||
        button.innerImageAlt ||
        button.titleText;

      if (!accessibleName || accessibleName.trim() === '') {
        const elementInfo = await this.getElementInfo(page, button.selector);

        let description = '按钮没有可访问的名称。';
        
        if (button.hasInnerElements && !button.textContent) {
          description += ' 该按钮包含图标/图片但没有替代文本或 aria-label。';
        }

        if (button.isDivButton) {
          description += ` 这是一个使用 role="button" 的 ${button.tagName} 元素。`;
        }

        if (button.hasInnerElements) {
          if (button.innerImageAlt) {
            description += ` 内部图片的 alt 为: "${button.innerImageAlt}"`;
          }
        }

        let recommendation = '为按钮提供可访问名称：';
        
        if (button.textContent) {
          recommendation += '\n- 确保按钮内有描述性文本';
        }
        if (button.hasInnerElements) {
          recommendation += '\n- 为图标按钮添加 aria-label 描述其功能';
          recommendation += '\n- 确保内部图片有合适的 alt 属性';
        }
        if (button.isDivButton) {
          recommendation += `\n- 如果使用自定义按钮（div/span with role="button"），确保有 aria-label 或可见文本`;
        }

        issues.push(
          this.createIssue(
            'button-name',
            'high',
            '按钮缺少可访问名称',
            description,
            recommendation,
            {
              ...elementInfo,
              selector: button.selector,
            }
          )
        );
      }

      if (button.isDivButton) {
        if (!button.hasTabindex) {
          const elementInfo = await this.getElementInfo(page, button.selector);
          
          issues.push(
            this.createIssue(
              'tabindex',
              'high',
              '自定义按钮缺少 tabindex',
              `使用 role="button" 的 ${button.tagName} 元素没有 tabindex，无法通过键盘 Tab 键访问。`,
              '为自定义按钮添加 tabindex="0" 使其可通过 Tab 键聚焦。同时确保支持 Enter 和 Space 键触发点击事件。',
              {
                ...elementInfo,
                selector: button.selector,
              }
            )
          );
        }

        if (button.hasOnClick && !button.hasTabindex) {
          const elementInfo = await this.getElementInfo(page, button.selector);
          
          issues.push(
            this.createIssue(
              'focus-order',
              'high',
              '有点击事件但不可聚焦',
              `元素有 onclick 事件但没有 tabindex，鼠标用户可以点击但键盘用户无法访问。`,
              '添加 tabindex="0" 使元素可聚焦。如果是按钮，考虑使用原生 <button> 元素代替自定义元素。',
              {
                ...elementInfo,
                selector: button.selector,
              }
            )
          );
        }
      }

      if (button.hasOnClick && !['button', 'a', 'input'].includes(button.tagName)) {
        if (!button.hasTabindex) {
          const elementInfo = await this.getElementInfo(page, button.selector);
          
          issues.push(
            this.createIssue(
              'tabindex',
              'high',
              '有点击事件的元素不可聚焦',
              `${button.tagName} 元素有 onclick 事件但没有 tabindex，键盘用户无法访问。`,
              '如果该元素是交互式的，请添加 tabindex="0" 使其可通过 Tab 键聚焦。同时确保支持键盘事件（Enter/Space）。',
              {
                ...elementInfo,
                selector: button.selector,
              }
            )
          );
        }
      }
    }

    return { 
      issues, 
      metadata: { 
        totalButtons: buttonInfo.length,
        visibleButtons: visibleButtons.length,
        customButtons: visibleButtons.filter(b => b.isDivButton).length,
        buttonsWithNames: visibleButtons.filter(b => {
          const name = b.textContent || b.ariaLabelText || b.ariaLabelledbyText || b.innerImageAlt || b.titleText;
          return name && name.trim() !== '';
        }).length,
      } 
    };
  }
}
