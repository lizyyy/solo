import { HtmlParser } from '../../src/parser/html-parser';

describe('HtmlParser', () => {
  describe('getFocusableElements', () => {
    it('应该识别标准的可聚焦元素', () => {
      const html = `
        <html>
          <body>
            <a href="#">链接</a>
            <button>按钮</button>
            <input type="text">
            <select></select>
            <textarea></textarea>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      
      expect(focusable.length).toBeGreaterThanOrEqual(5);
    });

    it('应该识别带 tabindex 的元素', () => {
      const html = `
        <html>
          <body>
            <div tabindex="0">可聚焦div</div>
            <span tabindex="0">可聚焦span</span>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      
      expect(focusable.length).toBe(2);
    });

    it('应该忽略 disabled 的元素', () => {
      const html = `
        <html>
          <body>
            <button disabled>禁用按钮</button>
            <input disabled>
            <select disabled></select>
            <button>可用按钮</button>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      const buttons = focusable.filter(e => e.tag === 'button');
      
      expect(buttons.length).toBe(1);
    });
  });

  describe('isVisible', () => {
    it('应该检测 display: none 的隐藏元素', () => {
      const html = `
        <html>
          <body>
            <button style="display: none">隐藏按钮</button>
            <button>可见按钮</button>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      
      const hiddenButton = focusable.find(e => e.textContent === '隐藏按钮');
      const visibleButton = focusable.find(e => e.textContent === '可见按钮');
      
      expect(hiddenButton?.visible).toBe(false);
      expect(visibleButton?.visible).toBe(true);
    });

    it('应该检测 visibility: hidden 的隐藏元素', () => {
      const html = `
        <html>
          <body>
            <button style="visibility: hidden">隐藏按钮</button>
            <button>可见按钮</button>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      
      const hiddenButton = focusable.find(e => e.textContent === '隐藏按钮');
      const visibleButton = focusable.find(e => e.textContent === '可见按钮');
      
      expect(hiddenButton?.visible).toBe(false);
      expect(visibleButton?.visible).toBe(true);
    });

    it('应该检测 aria-hidden="true"', () => {
      const html = `
        <html>
          <body>
            <button aria-hidden="true">aria隐藏</button>
            <button>正常按钮</button>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      
      const ariaHiddenButton = focusable.find(e => e.textContent === 'aria隐藏');
      const normalButton = focusable.find(e => e.textContent === '正常按钮');
      
      expect(ariaHiddenButton?.ariaHidden).toBe(true);
      expect(normalButton?.ariaHidden).toBe(false);
    });
  });

  describe('getReadableName', () => {
    it('应该返回 aria-label', () => {
      const html = `
        <html>
          <body>
            <button aria-label="提交表单">
              <span>提交</span>
            </button>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      const button = focusable.find(e => e.tag === 'button');
      
      expect(button?.ariaLabel).toBe('提交表单');
    });

    it('应该返回元素的 textContent', () => {
      const html = `
        <html>
          <body>
            <button>点击这里</button>
            <a href="#">链接文本</a>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const focusable = parser.getFocusableElements();
      
      const button = focusable.find(e => e.tag === 'button');
      const link = focusable.find(e => e.tag === 'a');
      
      expect(button?.textContent).toBe('点击这里');
      expect(link?.textContent).toBe('链接文本');
    });
  });

  describe('getModalElements', () => {
    it('应该识别带有 aria-modal="true" 的对话框', () => {
      const html = `
        <html>
          <body>
            <div role="dialog" aria-modal="true">
              <h2>模态框</h2>
              <button>关闭</button>
            </div>
            <div role="dialog">
              <h2>非模态框</h2>
            </div>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const modals = parser.getModalElements();
      
      expect(modals.length).toBe(1);
    });

    it('应该识别 role="alertdialog" 元素', () => {
      const html = `
        <html>
          <body>
            <div role="alertdialog" aria-modal="true">
              <h2>警告框</h2>
            </div>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const modals = parser.getModalElements();
      
      expect(modals.length).toBe(1);
    });
  });

  describe('getShortcutElements', () => {
    it('应该识别带有 accesskey 的元素', () => {
      const html = `
        <html>
          <body>
            <button accesskey="s">保存 (Alt+S)</button>
            <a href="#" accesskey="h">首页</a>
            <button>普通按钮</button>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const shortcuts = parser.getShortcutElements();
      
      expect(shortcuts.length).toBe(2);
      expect(shortcuts.some(s => s.letter === 's')).toBe(true);
      expect(shortcuts.some(s => s.letter === 'h')).toBe(true);
    });
  });

  describe('getPageTitle', () => {
    it('应该返回页面标题', () => {
      const html = `
        <html>
          <head>
            <title>测试页面标题</title>
          </head>
          <body>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const title = parser.getPageTitle();
      
      expect(title).toBe('测试页面标题');
    });

    it('应该在没有标题时返回默认值', () => {
      const html = `
        <html>
          <body>
          </body>
        </html>
      `;
      
      const parser = new HtmlParser(html);
      const title = parser.getPageTitle();
      
      expect(title).toBe('Untitled');
    });
  });
});
