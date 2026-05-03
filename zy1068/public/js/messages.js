const MessageManager = {
  messageTypes: {
    cursor: {
      name: '光标位置',
      defaultPayload: () => ({
        x: 0,
        y: 0,
        pageId: 'page-1',
        viewport: { width: 1920, height: 1080 }
      }),
      renderForm: (container) => {
        container.innerHTML = `
          <div class="payload-field">
            <label>X 坐标</label>
            <input type="number" id="cursorX" value="100" min="0" max="4096">
          </div>
          <div class="payload-field">
            <label>Y 坐标</label>
            <input type="number" id="cursorY" value="200" min="0" max="2160">
          </div>
          <div class="payload-field">
            <label>页面 ID</label>
            <input type="text" id="cursorPageId" value="page-1">
          </div>
        `;
      },
      getPayload: () => ({
        x: parseInt(document.getElementById('cursorX').value) || 0,
        y: parseInt(document.getElementById('cursorY').value) || 0,
        pageId: document.getElementById('cursorPageId').value || 'page-1'
      })
    },
    annotation: {
      name: '批注',
      defaultPayload: () => ({
        type: 'comment',
        targetId: 'element-123',
        text: '这里需要修改',
        author: 'User A',
        position: { x: 50, y: 50 }
      }),
      renderForm: (container) => {
        container.innerHTML = `
          <div class="payload-field">
            <label>批注类型</label>
            <select id="annotationType">
              <option value="comment">评论</option>
              <option value="highlight">高亮</option>
              <option value="strikethrough">删除线</option>
              <option value="suggestion">建议</option>
            </select>
          </div>
          <div class="payload-field">
            <label>目标元素 ID</label>
            <input type="text" id="annotationTargetId" value="element-123">
          </div>
          <div class="payload-field">
            <label>批注内容</label>
            <textarea id="annotationText">这里需要修改一下样式</textarea>
          </div>
          <div class="payload-field">
            <label>作者</label>
            <input type="text" id="annotationAuthor" value="User A">
          </div>
        `;
      },
      getPayload: () => ({
        type: document.getElementById('annotationType').value,
        targetId: document.getElementById('annotationTargetId').value,
        text: document.getElementById('annotationText').value,
        author: document.getElementById('annotationAuthor').value
      })
    },
    stroke: {
      name: '白板笔画',
      defaultPayload: () => ({
        strokeId: Utils.generateId(),
        color: '#3b82f6',
        width: 3,
        opacity: 1,
        points: [
          { x: 10, y: 10, pressure: 0.8, time: 0 },
          { x: 50, y: 30, pressure: 0.75, time: 10 },
          { x: 100, y: 60, pressure: 0.7, time: 20 }
        ],
        tool: 'pen'
      }),
      renderForm: (container) => {
        container.innerHTML = `
          <div class="payload-field">
            <label>工具类型</label>
            <select id="strokeTool">
              <option value="pen">钢笔</option>
              <option value="pencil">铅笔</option>
              <option value="eraser">橡皮擦</option>
              <option value="highlighter">荧光笔</option>
            </select>
          </div>
          <div class="payload-field">
            <label>颜色</label>
            <input type="color" id="strokeColor" value="#3b82f6">
          </div>
          <div class="payload-field">
            <label>线宽</label>
            <input type="range" id="strokeWidth" min="1" max="20" value="3">
          </div>
          <div class="payload-field">
            <label>点数 (模拟复杂度)</label>
            <select id="strokePointCount">
              <option value="5">5 个点 (简单)</option>
              <option value="20">20 个点 (中等)</option>
              <option value="100">100 个点 (复杂)</option>
              <option value="500">500 个点 (非常复杂)</option>
            </select>
          </div>
        `;
      },
      getPayload: () => {
        const pointCount = parseInt(document.getElementById('strokePointCount').value);
        const points = [];
        let x = Math.random() * 200;
        let y = Math.random() * 200;
        
        for (let i = 0; i < pointCount; i++) {
          x += (Math.random() - 0.5) * 30;
          y += (Math.random() - 0.5) * 30;
          points.push({
            x: Math.max(0, x),
            y: Math.max(0, y),
            pressure: 0.5 + Math.random() * 0.5,
            time: i * 16
          });
        }
        
        return {
          strokeId: Utils.generateId(),
          color: document.getElementById('strokeColor').value,
          width: parseInt(document.getElementById('strokeWidth').value),
          opacity: document.getElementById('strokeTool').value === 'highlighter' ? 0.4 : 1,
          points,
          tool: document.getElementById('strokeTool').value
        };
      }
    },
    patch: {
      name: '文档 Patch',
      defaultPayload: () => ({
        path: '/document/chapter-1/paragraph-3',
        from: 'v123',
        to: 'v124',
        ops: [
          { type: 'retain', value: 10 },
          { type: 'insert', value: '新增内容' },
          { type: 'delete', value: 5 }
        ],
        author: 'User A',
        timestamp: Date.now()
      }),
      renderForm: (container) => {
        container.innerHTML = `
          <div class="payload-field">
            <label>文档路径</label>
            <input type="text" id="patchPath" value="/document/chapter-1/paragraph-3">
          </div>
          <div class="payload-field">
            <label>从版本</label>
            <input type="text" id="patchFrom" value="v123">
          </div>
          <div class="payload-field">
            <label>到版本</label>
            <input type="text" id="patchTo" value="v124">
          </div>
          <div class="payload-field">
            <label>操作复杂度</label>
            <select id="patchComplexity">
              <option value="simple">简单 (插入)</option>
              <option value="medium">中等 (插入+删除)</option>
              <option value="complex">复杂 (多步操作)</option>
            </select>
          </div>
          <div class="payload-field">
            <label>作者</label>
            <input type="text" id="patchAuthor" value="User A">
          </div>
        `;
      },
      getPayload: () => {
        const complexity = document.getElementById('patchComplexity').value;
        let ops = [];
        
        switch (complexity) {
          case 'simple':
            ops = [
              { type: 'retain', value: 10 },
              { type: 'insert', value: '这是一段新增的文本内容' }
            ];
            break;
          case 'medium':
            ops = [
              { type: 'retain', value: 5 },
              { type: 'delete', value: 3 },
              { type: 'insert', value: '修改' },
              { type: 'retain', value: 20 }
            ];
            break;
          case 'complex':
            ops = [
              { type: 'retain', value: 8 },
              { type: 'delete', value: 5 },
              { type: 'insert', value: '第一处修改' },
              { type: 'retain', value: 15 },
              { type: 'delete', value: 10 },
              { type: 'insert', value: '第二处修改内容较长' },
              { type: 'retain', value: 30 },
              { type: 'insert', value: '末尾追加' }
            ];
            break;
        }
        
        return {
          path: document.getElementById('patchPath').value,
          from: document.getElementById('patchFrom').value,
          to: document.getElementById('patchTo').value,
          ops,
          author: document.getElementById('patchAuthor').value,
          timestamp: Date.now()
        };
      }
    },
    text: {
      name: '纯文本',
      defaultPayload: () => ({
        text: 'Hello, this is a test message.'
      }),
      renderForm: (container) => {
        container.innerHTML = `
          <div class="payload-field">
            <label>消息内容</label>
            <textarea id="textContent">这是一条测试消息，用于验证 WebRTC DataChannel 在弱网环境下的传输性能。</textarea>
          </div>
        `;
      },
      getPayload: () => ({
        text: document.getElementById('textContent').value
      })
    }
  },

  currentType: 'cursor',

  init() {
    this.setupTypeButtons();
    this.renderCurrentForm();
  },

  setupTypeButtons() {
    const buttons = document.querySelectorAll('.msg-type-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
        this.renderCurrentForm();
      });
    });
  },

  renderCurrentForm() {
    const container = document.getElementById('messagePayload');
    const typeConfig = this.messageTypes[this.currentType];
    if (typeConfig && typeConfig.renderForm) {
      typeConfig.renderForm(container);
    }
  },

  getCurrentMessage() {
    const typeConfig = this.messageTypes[this.currentType];
    if (!typeConfig) return null;

    return {
      type: this.currentType,
      payload: typeConfig.getPayload ? typeConfig.getPayload() : typeConfig.defaultPayload()
    };
  },

  createMessage(type, payload) {
    return {
      id: Utils.generateId(),
      seq: 0,
      type,
      payload,
      timestamp: Date.now()
    };
  },

  validateMessage(message) {
    if (!message.type || !this.messageTypes[message.type]) {
      return { valid: false, error: '无效的消息类型' };
    }
    if (!message.payload) {
      return { valid: false, error: '缺少消息 payload' };
    }
    return { valid: true };
  }
};
