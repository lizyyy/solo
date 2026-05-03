import { RulesEngine } from '../../src/rules/rules-engine';
import { ScanResult, IssueType, Severity } from '../../src/types';

describe('RulesEngine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
  });

  describe('initialization', () => {
    it('应该启用所有默认规则', () => {
      const enabled = engine.getEnabledRules();
      expect(enabled.length).toBeGreaterThan(0);
    });

    it('应该允许设置启用的规则', () => {
      const testRules: IssueType[] = ['focus_to_hidden', 'no_readable_name'];
      engine.setEnabledRules(testRules);
      expect(engine.getEnabledRules()).toEqual(testRules);
    });
  });

  describe('focus_to_hidden rule', () => {
    it('应该检测焦点跳到隐藏元素', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#visible-btn',
            xpath: '//button[1]',
            textContent: '可见按钮',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'visible-btn',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '可见按钮'
          },
          {
            tag: 'button',
            selector: '#hidden-btn',
            xpath: '//button[2]',
            textContent: '隐藏按钮',
            tabindex: null,
            visible: false,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'hidden-btn',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '隐藏按钮'
          }
        ],
        trajectory: {
          pageUrl: 'http://example.com',
          snapshotId: 'test-123',
          timestamp: Date.now(),
          items: [
            {
              timestamp: Date.now(),
              selector: '#visible-btn',
              xpath: '//button[1]',
              tagName: 'BUTTON',
              textContent: '可见按钮',
              ariaLabel: null,
              visible: true,
              isFocused: true,
              isModal: false
            },
            {
              timestamp: Date.now() + 100,
              selector: '#hidden-btn',
              xpath: '//button[2]',
              tagName: 'BUTTON',
              textContent: '隐藏按钮',
              ariaLabel: null,
              visible: false,
              isFocused: true,
              isModal: false
            }
          ],
          metadata: {
            browser: 'Chrome',
            viewport: { width: 1920, height: 1080 }
          }
        },
        criticalOperations: []
      };

      engine.setEnabledRules(['focus_to_hidden']);
      const result = engine.check(scanResult);

      const focusToHiddenIssues = result.issues.filter(i => i.type === 'focus_to_hidden');
      expect(focusToHiddenIssues.length).toBeGreaterThan(0);
      expect(focusToHiddenIssues[0].severity).toBe('critical' as Severity);
    });

    it('应该检测设置了 aria-hidden="true" 的元素', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#aria-hidden-btn',
            xpath: '//button',
            textContent: 'aria隐藏',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: true,
            ariaModal: false,
            role: null,
            id: 'aria-hidden-btn',
            className: '',
            attributes: { 'aria-hidden': 'true' },
            clickable: true,
            innerHTML: 'aria隐藏'
          }
        ],
        trajectory: null,
        criticalOperations: []
      };

      engine.setEnabledRules(['focus_to_hidden']);
      const result = engine.check(scanResult);

      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('no_readable_name rule', () => {
    it('应该检测没有可读名称的按钮', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#icon-btn',
            xpath: '//button',
            textContent: '',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'icon-btn',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '<svg></svg>'
          }
        ],
        trajectory: null,
        criticalOperations: []
      };

      engine.setEnabledRules(['no_readable_name']);
      const result = engine.check(scanResult);

      expect(result.issues.length).toBeGreaterThan(0);
      const issue = result.issues[0];
      expect(issue.type).toBe('no_readable_name');
      expect(issue.severity).toBe('critical' as Severity);
    });

    it('不应该检测有 aria-label 的按钮', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#icon-btn',
            xpath: '//button',
            textContent: '',
            tabindex: null,
            visible: true,
            ariaLabel: '关闭窗口',
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'icon-btn',
            className: '',
            attributes: { 'aria-label': '关闭窗口' },
            clickable: true,
            innerHTML: '<svg></svg>'
          }
        ],
        trajectory: null,
        criticalOperations: []
      };

      engine.setEnabledRules(['no_readable_name']);
      const result = engine.check(scanResult);

      expect(result.issues.length).toBe(0);
    });

    it('不应该检测有文本内容的按钮', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#text-btn',
            xpath: '//button',
            textContent: '提交表单',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'text-btn',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '提交表单'
          }
        ],
        trajectory: null,
        criticalOperations: []
      };

      engine.setEnabledRules(['no_readable_name']);
      const result = engine.check(scanResult);

      expect(result.issues.length).toBe(0);
    });
  });

  describe('shortcut_conflict rule', () => {
    it('应该检测相同的 accesskey', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#btn1',
            xpath: '//button[1]',
            textContent: '保存',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'btn1',
            className: '',
            attributes: { accesskey: 's' },
            clickable: true,
            innerHTML: '保存'
          },
          {
            tag: 'a',
            selector: '#link1',
            xpath: '//a',
            textContent: '首页',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'link1',
            className: '',
            attributes: { accesskey: 's' },
            clickable: true,
            innerHTML: '首页'
          }
        ],
        trajectory: null,
        criticalOperations: []
      };

      engine.setEnabledRules(['shortcut_conflict']);
      const result = engine.check(scanResult);

      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('modal_not_trapped rule', () => {
    it('应该检测焦点逃离模态框', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'div',
            selector: '#modal',
            xpath: '//div[@id="modal"]',
            textContent: '模态框',
            tabindex: null,
            visible: true,
            ariaLabel: '弹窗',
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: true,
            role: 'dialog',
            id: 'modal',
            className: '',
            attributes: { role: 'dialog', 'aria-modal': 'true' },
            clickable: false,
            innerHTML: '<button>关闭</button>'
          },
          {
            tag: 'button',
            selector: '#modal-close',
            xpath: '//div[@id="modal"]/button',
            textContent: '关闭',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'modal-close',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '关闭'
          },
          {
            tag: 'button',
            selector: '#outside-btn',
            xpath: '//button[@id="outside-btn"]',
            textContent: '外部按钮',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'outside-btn',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '外部按钮'
          }
        ],
        trajectory: {
          pageUrl: 'http://example.com',
          snapshotId: 'test-123',
          timestamp: Date.now(),
          items: [
            {
              timestamp: Date.now(),
              selector: '#modal-close',
              xpath: '//div[@id="modal"]/button',
              tagName: 'BUTTON',
              textContent: '关闭',
              ariaLabel: null,
              visible: true,
              isFocused: true,
              isModal: true
            },
            {
              timestamp: Date.now() + 100,
              selector: '#outside-btn',
              xpath: '//button[@id="outside-btn"]',
              tagName: 'BUTTON',
              textContent: '外部按钮',
              ariaLabel: null,
              visible: true,
              isFocused: true,
              isModal: false
            }
          ],
          metadata: {
            browser: 'Chrome',
            viewport: { width: 1920, height: 1080 }
          }
        },
        criticalOperations: []
      };

      engine.setEnabledRules(['modal_not_trapped']);
      const result = engine.check(scanResult);

      const modalIssues = result.issues.filter(i => i.type === 'modal_not_trapped');
      expect(modalIssues.length).toBeGreaterThan(0);
    });
  });

  describe('check summary', () => {
    it('应该生成正确的摘要', () => {
      const scanResult: ScanResult = {
        snapshotId: 'test-123',
        timestamp: new Date().toISOString(),
        pageTitle: 'Test Page',
        pageUrl: 'http://example.com',
        focusableElements: [
          {
            tag: 'button',
            selector: '#test-btn',
            xpath: '//button',
            textContent: '',
            tabindex: null,
            visible: true,
            ariaLabel: null,
            ariaLabelledBy: null,
            ariaHidden: false,
            ariaModal: false,
            role: null,
            id: 'test-btn',
            className: '',
            attributes: {},
            clickable: true,
            innerHTML: '<svg></svg>'
          }
        ],
        trajectory: null,
        criticalOperations: []
      };

      engine.setEnabledRules(['no_readable_name']);
      const result = engine.check(scanResult);

      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.byType['no_readable_name']).toBeGreaterThan(0);
      expect(result.summary.focusableCount).toBe(1);
    });
  });
});
