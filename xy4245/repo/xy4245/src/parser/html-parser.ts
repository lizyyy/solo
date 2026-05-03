import { JSDOM } from 'jsdom';
import { FocusableElement } from '../types';

export class HtmlParser {
  private dom: JSDOM;
  private document: Document;

  constructor(htmlContent: string) {
    this.dom = new JSDOM(htmlContent, {
      runScripts: 'dangerously',
      resources: 'usable'
    });
    this.document = this.dom.window.document;
  }

  getPageTitle(): string {
    const titleElement = this.document.querySelector('title');
    return titleElement?.textContent?.trim() || 'Untitled';
  }

  getPageUrl(): string | null {
    const baseElement = this.document.querySelector('base');
    if (baseElement && baseElement.href) {
      return baseElement.href;
    }
    return null;
  }

  getFocusableElements(): FocusableElement[] {
    const focusableSelectors = [
      'a[href]',
      'area[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      'iframe',
      '[contenteditable="true"]'
    ];

    const selector = focusableSelectors.join(', ');
    const elements = this.document.querySelectorAll(selector);
    
    return Array.from(elements).map(el => this.parseElement(el as HTMLElement));
  }

  private parseElement(element: HTMLElement): FocusableElement {
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      attributes[attr.name] = attr.value;
    }

    return {
      tag: element.tagName.toLowerCase(),
      selector: this.getCssSelector(element),
      xpath: this.getXPath(element),
      textContent: element.textContent?.trim() || '',
      tabindex: this.parseTabindex(element),
      visible: this.isVisible(element),
      ariaLabel: element.getAttribute('aria-label') || null,
      ariaLabelledBy: element.getAttribute('aria-labelledby') || null,
      ariaHidden: element.getAttribute('aria-hidden') === 'true',
      ariaModal: element.getAttribute('aria-modal') === 'true',
      role: element.getAttribute('role') || null,
      id: element.id || null,
      className: element.className || null,
      attributes,
      clickable: this.isClickable(element),
      innerHTML: element.innerHTML.substring(0, 500)
    };
  }

  private parseTabindex(element: HTMLElement): number | null {
    const tabindex = element.getAttribute('tabindex');
    if (tabindex === null) return null;
    const value = parseInt(tabindex, 10);
    return isNaN(value) ? null : value;
  }

  private isVisible(element: HTMLElement): boolean {
    const style = this.dom.window.getComputedStyle(element);
    
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    
    let parent: HTMLElement | null = element.parentElement;
    while (parent) {
      const parentStyle = this.dom.window.getComputedStyle(parent);
      if (parentStyle.display === 'none') return false;
      if (parentStyle.visibility === 'hidden') return false;
      if (parentStyle.overflow === 'hidden') {
        const parentRect = parent.getBoundingClientRect();
        if (rect.right < parentRect.left || rect.left > parentRect.right ||
            rect.bottom < parentRect.top || rect.top > parentRect.bottom) {
          return false;
        }
      }
      parent = parent.parentElement;
    }
    
    return true;
  }

  private isClickable(element: HTMLElement): boolean {
    const clickableTags = ['button', 'a', 'input', 'select', 'textarea'];
    if (clickableTags.includes(element.tagName.toLowerCase())) return true;
    
    if (element.hasAttribute('onclick')) return true;
    
    const role = element.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'tab', 'option'].includes(role)) {
      return true;
    }
    
    return false;
  }

  private getCssSelector(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      let sibling = current.previousElementSibling;
      let sameTagCount = 1;
      
      while (sibling) {
        if (sibling.tagName.toLowerCase() === selector) {
          sameTagCount++;
        }
        sibling = sibling.previousElementSibling;
      }

      if (current.className && typeof current.className === 'string' && current.className.trim()) {
        const classes = current.className.trim().split(/\s+/);
        selector += classes.map(c => `.${this.escapeCssSelector(c)}`).join('');
      }

      if (sameTagCount > 1 || current.nextElementSibling) {
        selector += `:nth-of-type(${sameTagCount})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  private escapeCssSelector(className: string): string {
    return className.replace(/[!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, '\\$&');
  }

  private getXPath(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      const tagName = current.tagName.toLowerCase();
      
      let sibling: HTMLElement | null = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const hasNextSiblingWithSameTag = Array.from(current.parentNode?.children || [])
        .some((child, i) => 
          child !== current && 
          child.nodeType === Node.ELEMENT_NODE && 
          (child as HTMLElement).tagName.toLowerCase() === tagName
        );

      if (index > 0 || hasNextSiblingWithSameTag) {
        parts.unshift(`${tagName}[${index + 1}]`);
      } else {
        parts.unshift(tagName);
      }

      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  getElementsBySelector(selector: string): HTMLElement[] {
    return Array.from(this.document.querySelectorAll(selector)) as HTMLElement[];
  }

  getElementById(id: string): HTMLElement | null {
    return this.document.getElementById(id);
  }

  getModalElements(): HTMLElement[] {
    const modalSelectors = [
      '[role="dialog"][aria-modal="true"]',
      '[role="alertdialog"][aria-modal="true"]',
      '.modal[aria-modal="true"]',
      '[data-modal="true"]'
    ];

    const elements: HTMLElement[] = [];
    for (const selector of modalSelectors) {
      const found = this.document.querySelectorAll(selector);
      elements.push(...Array.from(found) as HTMLElement[]);
    }

    return elements;
  }

  getShortcutElements(): { element: HTMLElement; accesskey: string; letter: string }[] {
    const results: { element: HTMLElement; accesskey: string; letter: string }[] = [];
    
    const elements = this.document.querySelectorAll('[accesskey]');
    for (const el of elements) {
      const accesskey = el.getAttribute('accesskey');
      if (accesskey) {
        const letters = accesskey.split(/\s+/);
        for (const letter of letters) {
          if (letter) {
            results.push({
              element: el as HTMLElement,
              accesskey,
              letter: letter.toLowerCase()
            });
          }
        }
      }
    }

    return results;
  }

  getReadableName(element: HTMLElement): string {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labels = ariaLabelledBy.split(/\s+/);
      const labelTexts: string[] = [];
      for (const id of labels) {
        const labelEl = this.document.getElementById(id);
        if (labelEl && labelEl.textContent) {
          labelTexts.push(labelEl.textContent.trim());
        }
      }
      if (labelTexts.length > 0) {
        return labelTexts.join(' ').trim();
      }
    }

    const tagName = element.tagName.toLowerCase();
    if (tagName === 'input') {
      const inputEl = element as HTMLInputElement;
      if (inputEl.type === 'submit' || inputEl.type === 'button') {
        if (inputEl.value) return inputEl.value.trim();
      }
      
      const label = this.findAssociatedLabel(inputEl);
      if (label) return label.trim();

      const placeholder = inputEl.getAttribute('placeholder');
      if (placeholder) return placeholder.trim();
    }

    if (tagName === 'button') {
      const text = element.textContent?.trim();
      if (text) return text;
    }

    if (tagName === 'a') {
      const text = element.textContent?.trim();
      if (text) return text;
      
      const img = element.querySelector('img');
      if (img) {
        const alt = img.getAttribute('alt');
        if (alt) return alt.trim();
      }
    }

    if (tagName === 'img') {
      const alt = element.getAttribute('alt');
      if (alt) return alt.trim();
    }

    const text = element.textContent?.trim();
    if (text && text.length > 0) {
      return text.substring(0, 100);
    }

    return '';
  }

  private findAssociatedLabel(input: HTMLInputElement): string | null {
    if (input.id) {
      const label = this.document.querySelector(`label[for="${input.id}"]`);
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }

    let parent: HTMLElement | null = input.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === 'label' && parent.textContent) {
        const labelText = parent.textContent.trim();
        const inputText = input.value?.trim() || '';
        if (labelText && labelText !== inputText) {
          return labelText;
        }
      }
      parent = parent.parentElement;
    }

    return null;
  }
}
