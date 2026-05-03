import {
  ScanResult,
  CheckResult,
  Issue,
  IssueType,
  Severity,
  ElementInfo,
  Reference,
  FocusableElement
} from '../types';
import { Rule } from './rule.interface';
import { FocusToHiddenRule } from './rules/focus-to-hidden.rule';
import { ModalNotTrappedRule } from './rules/modal-not-trapped.rule';
import { NoReadableNameRule } from './rules/no-readable-name.rule';
import { ShortcutConflictRule } from './rules/shortcut-conflict.rule';
import { FocusOrderViolationRule } from './rules/focus-order-violation.rule';
import { TabindexIssueRule } from './rules/tabindex-issue.rule';
import { AriaRoleMismatchRule } from './rules/aria-role-mismatch.rule';

export class RulesEngine {
  private rules: Map<IssueType, Rule> = new Map();
  private enabledRules: IssueType[] = [
    'focus_to_hidden',
    'modal_not_trapped',
    'no_readable_name',
    'shortcut_conflict',
    'focus_order_violation',
    'tabindex_issue',
    'aria_role_mismatch'
  ];

  constructor() {
    this.registerRule(new FocusToHiddenRule());
    this.registerRule(new ModalNotTrappedRule());
    this.registerRule(new NoReadableNameRule());
    this.registerRule(new ShortcutConflictRule());
    this.registerRule(new FocusOrderViolationRule());
    this.registerRule(new TabindexIssueRule());
    this.registerRule(new AriaRoleMismatchRule());
  }

  private registerRule(rule: Rule): void {
    this.rules.set(rule.type, rule);
  }

  setEnabledRules(rules: IssueType[]): void {
    this.enabledRules = rules;
  }

  getEnabledRules(): IssueType[] {
    return [...this.enabledRules];
  }

  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  check(scanResult: ScanResult): CheckResult {
    const allIssues: Issue[] = [];

    for (const ruleType of this.enabledRules) {
      const rule = this.rules.get(ruleType);
      if (rule) {
        try {
          const issues = rule.check(scanResult);
          allIssues.push(...issues);
        } catch (error) {
          console.error(`规则 ${ruleType} 执行出错: ${(error as Error).message}`);
        }
      }
    }

    const summary = this.buildSummary(allIssues, scanResult);

    return {
      scanResult,
      issues: allIssues,
      summary
    };
  }

  private buildSummary(
    issues: Issue[],
    scanResult: ScanResult
  ): CheckResult['summary'] {
    const byType: Record<IssueType, number> = {
      focus_to_hidden: 0,
      modal_not_trapped: 0,
      no_readable_name: 0,
      shortcut_conflict: 0,
      focus_order_violation: 0,
      tabindex_issue: 0,
      aria_role_mismatch: 0
    };

    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    issues.forEach(issue => {
      byType[issue.type] = (byType[issue.type] || 0) + 1;
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    });

    return {
      total: issues.length,
      byType,
      bySeverity,
      focusableCount: scanResult.focusableElements.length,
      trajectoryLength: scanResult.trajectory?.items.length || 0,
      criticalOperationsCount: scanResult.criticalOperations.length
    };
  }

  static createIssue(options: {
    type: IssueType;
    severity: Severity;
    title: string;
    description: string;
    element: FocusableElement | ElementInfo;
    suggestion: string;
    trajectoryIndex?: number;
  }): Issue {
    const { type, severity, title, description, element, suggestion, trajectoryIndex } = options;

    const elementInfo: ElementInfo = {
      selector: 'selector' in element ? element.selector : '',
      xpath: 'xpath' in element ? element.xpath : '',
      tagName: 'tag' in element ? element.tag.toUpperCase() : element.tagName,
      textContent: 'textContent' in element ? element.textContent : element.textContent,
      ariaLabel: 'ariaLabel' in element ? element.ariaLabel : element.ariaLabel
    };

    const references = RulesEngine.getReferencesForType(type);

    return {
      id: RulesEngine.generateIssueId(type),
      type,
      severity,
      title,
      description,
      element: elementInfo,
      location: {
        htmlSnippet: 'innerHTML' in element ? element.innerHTML.substring(0, 200) : ''
      },
      suggestion,
      references,
      trajectoryIndex,
      status: 'new',
      createdAt: new Date().toISOString()
    };
  }

  private static generateIssueId(type: IssueType): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  private static getReferencesForType(type: IssueType): Reference[] {
    const references: Record<IssueType, Reference[]> = {
      focus_to_hidden: [
        {
          standard: 'WCAG 2.1',
          section: '2.4.3 Focus Order (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#focus-order'
        },
        {
          standard: 'WCAG 2.1',
          section: '2.4.7 Focus Visible (Level AA)',
          url: 'https://www.w3.org/TR/WCAG21/#focus-visible'
        }
      ],
      modal_not_trapped: [
        {
          standard: 'WCAG 2.1',
          section: '2.4.3 Focus Order (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#focus-order'
        },
        {
          standard: 'ARIA Authoring Practices',
          section: 'Dialog Pattern',
          url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/'
        }
      ],
      no_readable_name: [
        {
          standard: 'WCAG 2.1',
          section: '1.1.1 Non-text Content (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#non-text-content'
        },
        {
          standard: 'WCAG 2.1',
          section: '2.4.4 Link Purpose (In Context) (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#link-purpose-in-context'
        },
        {
          standard: 'WCAG 2.1',
          section: '4.1.2 Name, Role, Value (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#name-role-value'
        }
      ],
      shortcut_conflict: [
        {
          standard: 'WCAG 2.1',
          section: '2.1.1 Keyboard (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#keyboard'
        },
        {
          standard: 'WCAG 2.1',
          section: '2.1.4 Character Key Shortcuts (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#character-key-shortcuts'
        }
      ],
      focus_order_violation: [
        {
          standard: 'WCAG 2.1',
          section: '2.4.3 Focus Order (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#focus-order'
        }
      ],
      tabindex_issue: [
        {
          standard: 'WCAG 2.1',
          section: '2.4.3 Focus Order (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#focus-order'
        },
        {
          standard: 'HTML5',
          section: 'The tabindex attribute',
          url: 'https://html.spec.whatwg.org/multipage/interaction.html#the-tabindex-attribute'
        }
      ],
      aria_role_mismatch: [
        {
          standard: 'WCAG 2.1',
          section: '1.3.1 Info and Relationships (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#info-and-relationships'
        },
        {
          standard: 'WCAG 2.1',
          section: '4.1.2 Name, Role, Value (Level A)',
          url: 'https://www.w3.org/TR/WCAG21/#name-role-value'
        },
        {
          standard: 'ARIA in HTML',
          section: 'Document conformance requirements',
          url: 'https://www.w3.org/TR/html-aria/#docconformance'
        }
      ]
    };

    return references[type] || [];
  }
}
