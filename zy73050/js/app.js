// ============================================================
// 主入口 App：绑定事件、初始化、状态管理
// ============================================================

const App = {
  state: {
    currentFilter: 'all',
    searchKeyword: '',
    selectedWorkorderId: null,
    showOverride: true,
    guideStepIndex: 0,
  },

  init() {
    // 初始化哈希注册（预注册已有工单，防止模拟去重时误判）
    WORKORDERS.forEach(wo => {
      const hash = Core.generateWorkorderHash(wo);
      Core.submittedHashes.add(hash);
    });

    // 默认选中第一个工单（有晚到备件 + 有断档的那张，让场景更清晰）
    this.state.selectedWorkorderId = WORKORDERS[0].id;

    // 渲染初始内容
    this.refreshAll();

    // 绑定全局事件
    this.bindEvents();

    // 首次进入提示引导（延迟一点让内容先出来）
    setTimeout(() => {
      UI.showToast('欢迎使用塔吊维保工单回放系统，点击右上「引导」了解用法', 'info');
    }, 500);
  },

  refreshAll() {
    UI.renderStatusChips();
    UI.renderFilterCounts();
    this.refreshWorkorderList();
    this.refreshDetail();
  },

  refreshWorkorderList() {
    UI.renderWorkorderList(
      this.state.currentFilter,
      this.state.searchKeyword,
      this.state.selectedWorkorderId
    );
  },

  refreshDetail() {
    const wo = WORKORDERS.find(w => w.id === this.state.selectedWorkorderId);
    if (!wo) return;
    UI.renderDetailHeader(wo);
    UI.renderPartsList(wo);
    UI.renderSamplingList(wo);
    Timeline.render(wo, this.state.showOverride);
  },

  // ----------------------------------------------------------
  // 事件绑定
  // ----------------------------------------------------------
  bindEvents() {
    // 分类 Tab 切换
    document.querySelectorAll('#filterTabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#filterTabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.state.currentFilter = tab.dataset.filter;
        this.refreshWorkorderList();
      });
    });

    // 搜索
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchKeyword = e.target.value;
        this.refreshWorkorderList();
      });
    }

    // 人工改判开关
    const toggleOverride = document.getElementById('toggleOverride');
    if (toggleOverride) {
      toggleOverride.addEventListener('change', (e) => {
        this.state.showOverride = e.target.checked;
        const wo = WORKORDERS.find(w => w.id === this.state.selectedWorkorderId);
        if (wo) Timeline.render(wo, this.state.showOverride);
      });
    }

    // 重新导出
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.handleExport());
    }

    // 接手引导
    const btnGuide = document.getElementById('btnGuide');
    if (btnGuide) {
      btnGuide.addEventListener('click', () => this.openGuide());
    }
    const btnCloseGuide = document.getElementById('btnCloseGuide');
    if (btnCloseGuide) {
      btnCloseGuide.addEventListener('click', () => this.closeGuide());
    }
    const btnGuidePrev = document.getElementById('btnGuidePrev');
    if (btnGuidePrev) {
      btnGuidePrev.addEventListener('click', () => this.setGuideStep(this.state.guideStepIndex - 1));
    }
    const btnGuideNext = document.getElementById('btnGuideNext');
    if (btnGuideNext) {
      btnGuideNext.addEventListener('click', () => {
        if (this.state.guideStepIndex === UI.GUIDE_STEPS.length - 1) {
          this.closeGuide();
        } else {
          this.setGuideStep(this.state.guideStepIndex + 1);
        }
      });
    }

    // 重复提交确认
    const btnDupConfirm = document.getElementById('btnDupConfirm');
    if (btnDupConfirm) {
      btnDupConfirm.addEventListener('click', () => {
        document.getElementById('duplicateModal').classList.remove('open');
      });
    }

    // 版本历史关闭
    const btnCloseVersion = document.getElementById('btnCloseVersion');
    if (btnCloseVersion) {
      btnCloseVersion.addEventListener('click', () => {
        document.getElementById('versionModal').classList.remove('open');
      });
    }

    // 点击遮罩关闭弹窗
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('open');
      });
    });

    // 补录备注（模拟演示：为当前工单第一个备件追加一条备注）
    const btnUploadRemark = document.getElementById('btnUploadRemark');
    if (btnUploadRemark) {
      btnUploadRemark.addEventListener('click', () => this.handleAddRemark());
    }

    // 上传截图（模拟演示）
    const btnUploadScreenshot = document.getElementById('btnUploadScreenshot');
    if (btnUploadScreenshot) {
      btnUploadScreenshot.addEventListener('click', () => this.handleAddScreenshot());
    }

    // 模拟重复提交（连续压两次同一工单的校验）
    // 当用户快速双击列表项时触发
    this._lastClickTime = 0;
    this._lastClickWoId = null;
  },

  // ----------------------------------------------------------
  // 选择工单
  // ----------------------------------------------------------
  selectWorkorder(woId) {
    // 检测双击：模拟"两次相同请求压塔吊维保工单回放"
    const now = Date.now();
    if (this._lastClickWoId === woId && now - this._lastClickTime < 400) {
      // 模拟提交两次同一个工单 -> 去重检测
      this.simulateDuplicateSubmit(woId);
    }
    this._lastClickTime = now;
    this._lastClickWoId = woId;

    this.state.selectedWorkorderId = woId;
    this.refreshAll();
  },

  // ----------------------------------------------------------
  // 模拟重复提交（核心需求：重复提交不能算两份）
  // ----------------------------------------------------------
  simulateDuplicateSubmit(woId) {
    const existing = WORKORDERS.find(w => w.id === woId);
    if (!existing) return;

    // 构造一个完全相同的"新提交"对象（仅id不同，但业务关键字段相同）
    const duplicateCandidate = {
      ...existing,
      id: 'WO-DUP-SIMULATE',
    };

    const result = Core.checkDuplicate(duplicateCandidate);

    if (result.isDuplicate) {
      // 弹出重复提交提醒
      this.showDuplicateModal(result);
    }
  },

  showDuplicateModal(result) {
    const modal = document.getElementById('duplicateModal');
    const info = document.getElementById('duplicateInfo');
    const wo = result.existingWo;

    info.innerHTML = `
      <div class="modal-info-row">
        <span class="modal-info-label">唯一哈希</span>
        <span class="modal-info-value warn">${result.hash}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">匹配工单</span>
        <span class="modal-info-value">${wo.id}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">塔吊</span>
        <span class="modal-info-value">${wo.craneName}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">处理状态</span>
        <span class="modal-info-value">${Core.getStatusLabel(wo.status)}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">统计结果</span>
        <span class="modal-info-value warn">去重有效 · 仅保留1份</span>
      </div>`;

    modal.classList.add('open');
    UI.showToast('已拦截重复提交，边界样本未重复计数', 'warn');
  },

  // ----------------------------------------------------------
  // 版本历史弹窗
  // ----------------------------------------------------------
  openVersionModal(woId, partId, type) {
    UI.renderVersionModal(woId, partId, type);
  },

  // ----------------------------------------------------------
  // 接手引导
  // ----------------------------------------------------------
  openGuide() {
    this.state.guideStepIndex = 0;
    UI.renderGuide(0);
    document.getElementById('guideModal').classList.add('open');
  },
  closeGuide() {
    document.getElementById('guideModal').classList.remove('open');
  },
  setGuideStep(idx) {
    if (idx < 0 || idx >= UI.GUIDE_STEPS.length) return;
    this.state.guideStepIndex = idx;
    UI.renderGuide(idx);
  },

  // ----------------------------------------------------------
  // 模拟追加备注版本
  // ----------------------------------------------------------
  handleAddRemark() {
    const wo = WORKORDERS.find(w => w.id === this.state.selectedWorkorderId);
    if (!wo || wo.parts.length === 0) return;

    const part = wo.parts[0];
    const demoContents = [
      '现场小宋补录：今日复核时发现备件包装完好，拆封验收合格。',
      '现场小宋补录：月底复核确认，备件使用量与出库量吻合，无异常。',
      '现场小宋补录：项目抽检资料完整，照片已归档，复核通过。',
    ];
    const content = demoContents[Math.floor(Math.random() * demoContents.length)];
    const v = Core.addRemarkVersion(wo.id, part.id, content);
    if (v) {
      UI.showToast(`已追加「${part.name}」备注 v${v.version}，历史版本保留`, 'success');
      this.refreshDetail();
    }
  },

  // ----------------------------------------------------------
  // 模拟追加截图版本
  // ----------------------------------------------------------
  handleAddScreenshot() {
    const wo = WORKORDERS.find(w => w.id === this.state.selectedWorkorderId);
    if (!wo || wo.parts.length === 0) return;

    const part = wo.parts[0];
    const demo = [
      { name: '现场到货签收单', preview: '📄' },
      { name: '安装过程照片', preview: '📷' },
      { name: '使用量核对表', preview: '📊' },
    ];
    const item = demo[Math.floor(Math.random() * demo.length)];
    const v = Core.addScreenshotVersion(wo.id, part.id, item.name, item.preview);
    if (v) {
      UI.showToast(`已上传「${item.name}」截图 v${v.version}，旧版本保留`, 'success');
      this.refreshDetail();
    }
  },

  // ----------------------------------------------------------
  // 导出
  // ----------------------------------------------------------
  handleExport() {
    const wo = WORKORDERS.find(w => w.id === this.state.selectedWorkorderId);
    const data = Core.exportCurrentView(
      this.state.currentFilter,
      this.state.searchKeyword,
      wo
    );
    UI.showToast(
      `已导出 ${data.exportMeta.totalCount} 条工单 · 筛选：${this.state.currentFilter || '全部'}`,
      'info'
    );
  },
};

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', () => App.init());
