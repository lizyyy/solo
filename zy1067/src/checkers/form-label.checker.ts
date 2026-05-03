import { BaseChecker, CheckerContext, CheckerResult } from './types';
import { AccessibilityIssue } from '../types';

export class FormLabelChecker extends BaseChecker {
  name = 'form-label';
  description = '检查表单控件是否有正确的标签关联，确保屏幕阅读器能正确识别';

  async check(context: CheckerContext): Promise<CheckerResult> {
    const issues: AccessibilityIssue[] = [];
    const { page } = context;

    const formFieldInfo = await page.evaluate(() => {
      const formFieldSelectors = [
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
        'select',
        'textarea',
      ];

      const formFields: Array<{
        selector: string;
        tagName: string;
        type: string | null;
        id: string | null;
        hasLabel: boolean;
        hasExplicitLabel: boolean;
        hasImplicitLabel: boolean;
        hasAriaLabel: boolean;
        hasAriaLabelledby: boolean;
        hasPlaceholder: boolean;
        labelText: string | null;
        ariaLabelText: string | null;
        ariaLabelledbyElements: string[];
        placeholderText: string | null;
        isRequired: boolean;
        isDisabled: boolean;
        isHidden: boolean;
      }> = [];

      const allLabels = document.querySelectorAll('label');
      const labelForMap = new Map<string, HTMLLabelElement>();

      for (const label of Array.from(allLabels)) {
        const forAttr = label.getAttribute('for');
        if (forAttr) {
          labelForMap.set(forAttr, label);
        }
      }

      const formElements = document.querySelectorAll(formFieldSelectors.join(', '));

      for (const el of Array.from(formElements)) {
        const inputEl = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const computed = window.getComputedStyle(inputEl);
        const rect = inputEl.getBoundingClientRect();

        const isHidden =
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          parseInt(computed.opacity) === 0 ||
          (rect.width === 0 && rect.height === 0);

        const explicitLabel = labelForMap.get(inputEl.id);
        
        const hasImplicitLabel = (() => {
          let parent: HTMLElement | null = inputEl.parentElement;
          while (parent) {
            if (parent.tagName === 'LABEL') {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        })();

        const hasAriaLabel = !!inputEl.getAttribute('aria-label');
        const hasAriaLabelledby = !!inputEl.getAttribute('aria-labelledby');
        const hasPlaceholder = !!inputEl.getAttribute('placeholder');

        let labelText: string | null = null;
        if (explicitLabel) {
          labelText = explicitLabel.textContent?.trim() || null;
        } else if (hasImplicitLabel) {
          let parent: HTMLElement | null = inputEl.parentElement;
          while (parent) {
            if (parent.tagName === 'LABEL') {
              labelText = parent.textContent?.trim() || null;
              break;
            }
            parent = parent.parentElement;
          }
        }

        let ariaLabelledbyElements: string[] = [];
        const ariaLabelledby = inputEl.getAttribute('aria-labelledby');
        if (ariaLabelledby) {
          const ids = ariaLabelledby.split(/\s+/);
          for (const id of ids) {
            const labelEl = document.getElementById(id);
            if (labelEl) {
              ariaLabelledbyElements.push(labelEl.textContent?.trim() || '');
            }
          }
        }

        let selector = inputEl.tagName.toLowerCase();
        if (inputEl.id) selector += `#${inputEl.id}`;
        if (inputEl.className) {
          const classes = inputEl.className.split(' ').filter(Boolean).slice(0, 2).join('.');
          if (classes) selector += `.${classes}`;
        }

        const type = inputEl.tagName === 'INPUT' ? (inputEl as HTMLInputElement).type : inputEl.tagName.toLowerCase();

        formFields.push({
          selector,
          tagName: inputEl.tagName.toLowerCase(),
          type,
          id: inputEl.id || null,
          hasLabel: !!explicitLabel || hasImplicitLabel,
          hasExplicitLabel: !!explicitLabel,
          hasImplicitLabel,
          hasAriaLabel,
          hasAriaLabelledby,
          hasPlaceholder,
          labelText,
          ariaLabelText: inputEl.getAttribute('aria-label') || null,
          ariaLabelledbyElements,
          placeholderText: inputEl.getAttribute('placeholder') || null,
          isRequired: inputEl.hasAttribute('required'),
          isDisabled: inputEl.hasAttribute('disabled'),
          isHidden,
        });
      }

      return formFields;
    });

    const visibleFields = formFieldInfo.filter((field) => !field.isHidden && !field.isDisabled);

    for (const field of visibleFields) {
      const hasAccessibleName =
        field.hasLabel ||
        field.hasAriaLabel ||
        field.hasAriaLabelledby;

      if (!hasAccessibleName) {
        const elementInfo = await this.getElementInfo(page, field.selector);
        
        let description = `表单控件 "${field.tagName}" 没有可访问名称。`;
        if (field.type) description += ` 类型: ${field.type}`;
        
        if (field.hasPlaceholder) {
          description += ` 注意：placeholder 不能替代标签。`;
        }

        let recommendation = '为表单控件添加可访问名称。';
        if (field.id) {
          recommendation += ` 使用 <label for="${field.id}"> 关联标签，或添加 aria-label 属性。`;
        } else {
          recommendation += ' 使用 <label> 包裹控件（隐式标签），或添加 aria-label 属性。';
        }

        issues.push(
          this.createIssue(
            'form-label',
            'high',
            '表单控件缺少可访问名称',
            description,
            recommendation,
            {
              ...elementInfo,
              selector: field.selector,
            }
          )
        );
      } else {
        const accessibleName = 
          field.labelText ||
          field.ariaLabelText ||
          field.ariaLabelledbyElements.join(' ') ||
          '';

        if (!accessibleName.trim()) {
          const elementInfo = await this.getElementInfo(page, field.selector);
          
          issues.push(
            this.createIssue(
              'form-label',
              'high',
              '表单控件可访问名称为空',
              `表单控件 "${field.tagName}" 有标签关联，但标签文本为空。`,
              '确保标签或 aria-label 包含描述性文本。标签应简洁地描述该字段的用途。',
              {
                ...elementInfo,
                selector: field.selector,
              }
            )
          );
        }
      }

      if (field.hasPlaceholder && !field.hasLabel && !field.hasAriaLabel && !field.hasAriaLabelledby) {
        const elementInfo = await this.getElementInfo(page, field.selector);
        
        issues.push(
          this.createIssue(
            'form-label',
            'medium',
            '仅使用 placeholder 作为标签',
            `表单控件使用 placeholder ("${field.placeholderText}") 作为唯一的标识，但 placeholder 不能替代永久标签。`,
            'placeholder 在用户开始输入后会消失，不应作为唯一的标识方式。请添加 <label> 或 aria-label 提供永久的可访问名称。',
            {
              ...elementInfo,
              selector: field.selector,
            }
          )
        );
      }

      if (field.hasImplicitLabel && !field.hasExplicitLabel && !field.hasAriaLabel) {
        if (field.id) {
          const elementInfo = await this.getElementInfo(page, field.selector);
          
          issues.push(
            this.createIssue(
              'form-label',
              'low',
              '建议使用显式标签',
              `表单控件使用隐式标签（被 <label> 包裹）。虽然有效，但显式标签（使用 for="${field.id}"）提供更好的兼容性和可点击区域。`,
              '考虑使用显式标签关联：<label for="${field.id}">标签文字</label>。这确保更大的可点击区域和更好的屏幕阅读器兼容性。',
              {
                ...elementInfo,
                selector: field.selector,
              }
            )
          );
        }
      }
    }

    return { 
      issues, 
      metadata: { 
        totalFields: formFieldInfo.length,
        visibleFields: visibleFields.length,
        fieldsWithLabels: visibleFields.filter(f => f.hasLabel).length,
        fieldsWithAriaLabel: visibleFields.filter(f => f.hasAriaLabel || f.hasAriaLabelledby).length,
      } 
    };
  }
}
