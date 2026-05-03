import { BaseChecker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export class ModalTrapChecker extends BaseChecker {
  name = 'modal-trap';
  description = '检查模态框/弹窗的焦点管理，确保焦点被正确捕获且能正常退出';

  async check(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { page, focusPath } = context;

    const modalInfo = await page.evaluate(() => {
      const modalSelectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '.modal',
        '.modal-dialog',
        '[class*="modal"]',
        '[class*="dialog"]',
        '[class*="Modal"]',
        '[class*="Dialog"]',
      ];

      const modals: Array<{
        selector: string;
        role: string | null;
        ariaModal: string | null;
        ariaHidden: string | null;
        isVisible: boolean;
        hasCloseButton: boolean;
        closeButtonSelectors: string[];
        hasBackdrop: boolean;
        zIndex: string | null;
        isFixed: boolean;
        isAbsolute: boolean;
      }> = [];

      const allModals = document.querySelectorAll(modalSelectors.join(', '));

      for (const el of Array.from(allModals)) {
        const modalEl = el as HTMLElement;
        const computed = window.getComputedStyle(modalEl);
        const rect = modalEl.getBoundingClientRect();

        const isVisible =
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          parseInt(computed.opacity) > 0 &&
          rect.width > 0 &&
          rect.height > 0;

        const closeButtonSelectors: string[] = [];
        const closeButtons = modalEl.querySelectorAll(
          'button[class*="close"], [class*="close"], button[aria-label*="close"], [aria-label*="close"], [data-dismiss]'
        );
        for (const btn of Array.from(closeButtons)) {
          let selector = btn.tagName.toLowerCase();
          if (btn.id) selector += `#${btn.id}`;
          if (btn.className) {
            const classes = (btn as HTMLElement).className.split(' ').filter(Boolean).slice(0, 2).join('.');
            if (classes) selector += `.${classes}`;
          }
          closeButtonSelectors.push(selector);
        }

        let selector = modalEl.tagName.toLowerCase();
        if (modalEl.id) selector += `#${modalEl.id}`;
        if (modalEl.className) {
          const classes = modalEl.className.split(' ').filter(Boolean).slice(0, 2).join('.');
          if (classes) selector += `.${classes}`;
        }

        const backdropSelectors = ['.modal-backdrop', '[class*="backdrop"]', '.overlay'];
        let hasBackdrop = false;
        for (const backdropSelector of backdropSelectors) {
          if (document.querySelector(backdropSelector)) {
            hasBackdrop = true;
            break;
          }
        }

        modals.push({
          selector,
          role: modalEl.getAttribute('role'),
          ariaModal: modalEl.getAttribute('aria-modal'),
          ariaHidden: modalEl.getAttribute('aria-hidden'),
          isVisible,
          hasCloseButton: closeButtonSelectors.length > 0,
          closeButtonSelectors,
          hasBackdrop,
          zIndex: computed.zIndex,
          isFixed: computed.position === 'fixed',
          isAbsolute: computed.position === 'absolute',
        });
      }

      return modals;
    });

    const visibleModals = modalInfo.filter((m) => m.isVisible);

    if (visibleModals.length > 0) {
      for (const modal of visibleModals) {
        if (modal.role !== 'dialog' && modal.role !== 'alertdialog') {
          const elementInfo = await this.getElementInfo(page, modal.selector);
          
          issues.push(
            this.createIssue(
              'modal-trap',
              'high',
              '模态框缺少 role="dialog"',
              '模态框元素没有设置 role="dialog" 或 role="alertdialog"。屏幕阅读器无法正确识别这是一个对话框。',
              '为模态框容器添加 role="dialog" 或 role="alertdialog"。同时添加 aria-modal="true" 表示这是一个模态对话框。',
              {
                ...elementInfo,
                selector: modal.selector,
              }
            )
          );
        }

        if (modal.ariaModal !== 'true') {
          const elementInfo = await this.getElementInfo(page, modal.selector);
          
          issues.push(
            this.createIssue(
              'modal-trap',
              'medium',
              '模态框缺少 aria-modal="true"',
              '模态框没有设置 aria-modal="true"。这会导致屏幕阅读器可能仍然能够访问模态框后面的内容。',
              '为模态框添加 aria-modal="true"，表示这是一个模态对话框，背景内容不应被访问。',
              {
                ...elementInfo,
                selector: modal.selector,
              }
            )
          );
        }

        if (!modal.hasCloseButton) {
          const elementInfo = await this.getElementInfo(page, modal.selector);
          
          issues.push(
            this.createIssue(
              'modal-trap',
              'high',
              '模态框缺少关闭按钮',
              '模态框中没有检测到关闭按钮。键盘用户可能无法关闭模态框。',
              '确保模态框有明确的关闭按钮。按钮应该有清晰的标签，如"关闭"或 aria-label="关闭"。同时确保 Escape 键可以关闭模态框。',
              {
                ...elementInfo,
                selector: modal.selector,
              }
            )
          );
        }
      }
    }

    const modalDetectionResult = await this.checkModalInteraction(context);
    issues.push(...modalDetectionResult.issues);

    return { 
      issues, 
      metadata: { 
        totalModals: modalInfo.length,
        visibleModals: visibleModals.length,
        modalsWithProperRole: visibleModals.filter(m => m.role === 'dialog' || m.role === 'alertdialog').length,
        modalsWithAriaModal: visibleModals.filter(m => m.ariaModal === 'true').length,
      } 
    };
  }

  private async checkModalInteraction(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { page, focusPath } = context;

    const modalTriggers = await page.evaluate(() => {
      const triggers: Array<{
        selector: string;
        tagName: string;
        text: string | null;
        hasDataTarget: boolean;
        hasDataToggle: boolean;
        dataTarget: string | null;
        dataToggle: string | null;
        ariaHaspopup: string | null;
        ariaControls: string | null;
      }> = [];

      const triggerSelectors = [
        'button[data-toggle="modal"]',
        '[data-toggle="modal"]',
        'button[data-target]',
        '[data-target]',
        '[aria-haspopup="dialog"]',
        '[aria-haspopup="true"]',
        '[class*="open-modal"]',
        '[class*="openModal"]',
      ];

      const elements = document.querySelectorAll(triggerSelectors.join(', '));

      for (const el of Array.from(elements)) {
        const triggerEl = el as HTMLElement;
        
        let selector = triggerEl.tagName.toLowerCase();
        if (triggerEl.id) selector += `#${triggerEl.id}`;
        if (triggerEl.className) {
          const classes = triggerEl.className.split(' ').filter(Boolean).slice(0, 2).join('.');
          if (classes) selector += `.${classes}`;
        }

        triggers.push({
          selector,
          tagName: triggerEl.tagName.toLowerCase(),
          text: triggerEl.textContent?.trim() || null,
          hasDataTarget: triggerEl.hasAttribute('data-target'),
          hasDataToggle: triggerEl.hasAttribute('data-toggle'),
          dataTarget: triggerEl.getAttribute('data-target'),
          dataToggle: triggerEl.getAttribute('data-toggle'),
          ariaHaspopup: triggerEl.getAttribute('aria-haspopup'),
          ariaControls: triggerEl.getAttribute('aria-controls'),
        });
      }

      return triggers;
    });

    if (modalTriggers.length > 0) {
      for (const trigger of modalTriggers) {
        if (!trigger.ariaHaspopup) {
          const elementInfo = await this.getElementInfo(page, trigger.selector);
          
          issues.push(
            this.createIssue(
              'modal-trap',
              'medium',
              '模态框触发器缺少 aria-haspopup',
              `按钮 "${trigger.text || trigger.selector}" 看起来是模态框触发器，但缺少 aria-haspopup="dialog" 属性。`,
              '为模态框触发器添加 aria-haspopup="dialog"，让屏幕阅读器知道点击该按钮会打开一个对话框。同时可以添加 aria-controls 指向模态框的 ID。',
              {
                ...elementInfo,
                selector: trigger.selector,
              }
            )
          );
        }
      }
    }

    return { issues };
  }
}
