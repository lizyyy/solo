import { Page } from 'playwright';
import {
  AccessibilityIssue,
  FocusPathItem,
  ElementInfo,
  IssueType,
  Severity,
} from '../types';

export interface CheckerContext {
  page: Page;
  url: string;
  routeId: string;
  routeName: string;
  focusPath: FocusPathItem[];
  timeout: number;
}

export interface CheckerResult {
  issues: AccessibilityIssue[];
  metadata?: Record<string, unknown>;
}

export interface Checker {
  name: string;
  description: string;
  enabled: boolean;
  
  check(context: CheckerContext): Promise<CheckerResult>;
}

export abstract class BaseChecker implements Checker {
  abstract name: string;
  abstract description: string;
  enabled: boolean = true;

  abstract check(context: CheckerContext): Promise<CheckerResult>;

  protected createIssue(
    type: IssueType,
    severity: Severity,
    title: string,
    description: string,
    recommendation: string,
    element: ElementInfo & { selector: string; domSnippet?: string },
    context?: {
      focusIndex?: number;
      previousFocus?: string;
      nextFocus?: string;
    }
  ): AccessibilityIssue {
    return {
      id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      description,
      recommendation,
      element,
      context,
    };
  }

  protected async getElementInfo(
    page: Page,
    selector: string
  ): Promise<ElementInfo & { selector: string; domSnippet?: string }> {
    return page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (!el) {
        return {
          selector: sel,
          tagName: 'unknown',
        };
      }

      const getAccessibleName = (element: HTMLElement): string => {
        if (element.getAttribute('aria-label')) {
          return element.getAttribute('aria-label')!;
        }
        if (element.getAttribute('aria-labelledby')) {
          const labelledby = element.getAttribute('aria-labelledby')!;
          const labelEl = document.getElementById(labelledby);
          return labelEl?.textContent?.trim() || '';
        }
        if (element.getAttribute('title')) {
          return element.getAttribute('title')!;
        }
        if (element.getAttribute('placeholder')) {
          return element.getAttribute('placeholder')!;
        }
        return element.textContent?.trim() || '';
      };

      const getDomSnippet = (element: HTMLElement, maxLength: number = 300): string => {
        const outerHtml = element.outerHTML;
        if (outerHtml.length <= maxLength) {
          return outerHtml;
        }
        return outerHtml.slice(0, maxLength - 3) + '...';
      };

      return {
        selector: sel,
        tagName: el.tagName.toLowerCase(),
        id: el.id || undefined,
        className: el.className || undefined,
        textContent: el.textContent?.trim() || undefined,
        accessibleName: getAccessibleName(el),
        role: el.getAttribute('role') || undefined,
        type: el.getAttribute('type') || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        ariaLabelledby: el.getAttribute('aria-labelledby') || undefined,
        placeholder: el.getAttribute('placeholder') || undefined,
        title: el.getAttribute('title') || undefined,
        domSnippet: getDomSnippet(el),
      };
    }, selector);
  }
}
