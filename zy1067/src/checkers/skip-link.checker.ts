import { BaseChecker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export class SkipLinkChecker extends BaseChecker {
  name = 'skip-link';
  description = '检查是否存在跳过导航的链接，帮助键盘用户快速到达主要内容';

  async check(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { page, focusPath } = context;

    const skipLinkInfo = await page.evaluate(() => {
      const body = document.body;
      const firstElements = Array.from(body.children).slice(0, 5);

      const skipLinks: Array<{
        selector: string;
        text: string;
        href: string;
        isHidden: boolean;
        isVisibleOnFocus: boolean;
        targetElement: string | null;
      }> = [];

      const allLinks = document.querySelectorAll('a[href^="#"]');
      
      for (const link of Array.from(allLinks)) {
        const anchorEl = link as HTMLAnchorElement;
        const text = anchorEl.textContent?.trim().toLowerCase() || '';
        const href = anchorEl.getAttribute('href') || '';
        
        const isSkipLinkText = 
          text.includes('skip') || 
          text.includes('跳过') || 
          text.includes('跳转') ||
          text.includes('main') ||
          text.includes('主要') ||
          text.includes('内容');

        if (isSkipLinkText) {
          const computed = window.getComputedStyle(anchorEl);
          const isHidden =
            computed.display === 'none' ||
            computed.visibility === 'hidden' ||
            parseInt(computed.opacity) === 0 ||
            parseInt(computed.width) === 0 ||
            parseInt(computed.height) === 0 ||
            computed.position === 'absolute' && parseInt(computed.left) < -1000;

          const isVisibleOnFocus = 
            computed.transition !== 'none' ||
            (computed.position === 'absolute' && 
             (computed.getPropertyValue(':focus') !== '' || computed.getPropertyValue(':focus-within') !== ''));

          const targetId = href.replace('#', '');
          let targetElement: string | null = null;
          
          if (targetId) {
            const target = document.getElementById(targetId);
            if (target) {
              targetElement = target.tagName.toLowerCase() + (target.id ? `#${target.id}` : '');
            }
          }

          let selector = anchorEl.tagName.toLowerCase();
          if (anchorEl.id) selector += `#${anchorEl.id}`;
          if (anchorEl.className) {
            const classes = anchorEl.className.split(' ').filter(Boolean).slice(0, 2).join('.');
            if (classes) selector += `.${classes}`;
          }

          skipLinks.push({
            selector,
            text: anchorEl.textContent?.trim() || '',
            href,
            isHidden,
            isVisibleOnFocus,
            targetElement,
          });
        }
      }

      return {
        hasSkipLinks: skipLinks.length > 0,
        skipLinks,
        isFirstFocusableLink: (): boolean => {
          const focusableSelectors = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
          const firstFocusable = document.querySelector(focusableSelectors);
          if (!firstFocusable) return false;
          
          const firstFocusableText = firstFocusable.textContent?.trim().toLowerCase() || '';
          return (
            firstFocusableText.includes('skip') ||
            firstFocusableText.includes('跳过') ||
            firstFocusableText.includes('跳转')
          );
        },
      };
    });

    if (!skipLinkInfo.hasSkipLinks || skipLinkInfo.skipLinks.length === 0) {
      issues.push(
        this.createIssue(
          'skip-link',
          'medium',
          '缺少跳过链接',
          '页面未检测到"跳过导航"的链接。键盘用户需要按 Tab 键多次才能到达主要内容区域。',
          '在页面顶部添加一个跳过导航的链接，链接到主要内容区域。链接文字应该清晰，如"跳过导航"或"跳转到主要内容"。链接可以在默认情况下隐藏，但在获取焦点时显示。',
          {
            selector: 'document',
            tagName: 'document',
            accessibleName: '',
            domSnippet: '',
          }
        )
      );
    } else {
      for (const skipLink of skipLinkInfo.skipLinks) {
        if (skipLink.isHidden && !skipLink.isVisibleOnFocus) {
          const elementInfo = await this.getElementInfo(page, skipLink.selector);
          issues.push(
            this.createIssue(
              'skip-link',
              'high',
              '跳过链接隐藏且无法通过焦点显示',
              `跳过链接 "${skipLink.text}" 被隐藏，且检测不到聚焦时显示的样式。键盘用户无法使用此链接。`,
              '确保跳过链接在获取焦点时可见。可以使用类似 .skip-link:focus { position: static; clip: auto; width: auto; height: auto; } 的样式。',
              {
                ...elementInfo,
                selector: skipLink.selector,
              }
            )
          );
        }

        if (!skipLink.targetElement) {
          const elementInfo = await this.getElementInfo(page, skipLink.selector);
          issues.push(
            this.createIssue(
              'skip-link',
              'medium',
              '跳过链接目标不存在',
              `跳过链接 "${skipLink.text}" 的目标 "${skipLink.href}" 未找到或无效。`,
              '确保跳过链接的 href 指向一个存在的元素 ID，例如 href="#main-content"，并且目标元素存在 tabindex="-1" 以便可以被程序化聚焦。',
              {
                ...elementInfo,
                selector: skipLink.selector,
              }
            )
          );
        }
      }
    }

    if (focusPath.length > 0) {
      const firstFocusItem = focusPath[0];
      const firstElementText = firstFocusItem.elementInfo.textContent?.toLowerCase() || '';
      const firstElementId = firstFocusItem.elementInfo.id || '';
      
      const isSkipLink = 
        firstElementText.includes('skip') ||
        firstElementText.includes('跳过') ||
        firstElementText.includes('跳转') ||
        firstElementId.includes('skip') ||
        firstElementId.includes('skip-link');

      if (!isSkipLink && skipLinkInfo.hasSkipLinks) {
        issues.push(
          this.createIssue(
            'skip-link',
            'low',
            '跳过链接不是第一个可聚焦元素',
            '跳过链接存在，但不是页面上第一个可聚焦的元素。键盘用户可能需要按 Tab 键多次才能到达跳过链接。',
            '将跳过链接放在 DOM 的早期位置，使其成为页面上第一个可聚焦的元素。这样键盘用户可以立即使用它跳过导航。',
            await this.getElementInfo(page, firstFocusItem.selector),
            { focusIndex: 0, nextFocus: focusPath[1]?.selector }
          )
        );
      }
    }

    return { 
      issues, 
      metadata: { 
        skipLinks: skipLinkInfo.skipLinks,
        hasSkipLinks: skipLinkInfo.hasSkipLinks 
      } 
    };
  }
}
