(function(global) {
  'use strict';

  const { formatDate, getStatusLabel, getHistoryIcon, BORROW_STATUS } = global.Models || {};
  const State = global.State;
  const EVENTS = global.EVENTS || {};

  // Toast 组件
  class Toast {
    constructor() {
      this.element = document.getElementById('toast');
      this.timeout = null;
    }

    show(message, type = 'info', duration = 3000) {
      if (!this.element) return;

      if (this.timeout) {
        clearTimeout(this.timeout);
      }

      this.element.textContent = message;
      this.element.className = 'toast';
      
      if (type === 'success') {
        this.element.classList.add('success');
      } else if (type === 'error') {
        this.element.classList.add('error');
      } else if (type === 'warning') {
        this.element.classList.add('warning');
      }

      this.element.classList.remove('hidden');

      this.timeout = setTimeout(() => {
        this.hide();
      }, duration);
    }

    hide() {
      if (this.element) {
        this.element.classList.add('hidden');
      }
    }

    success(message) {
      this.show(message, 'success');
    }

    error(message) {
      this.show(message, 'error');
    }

    warning(message) {
      this.show(message, 'warning');
    }

    info(message) {
      this.show(message, 'info');
    }
  }

  // 模态框组件
  class Modal {
    constructor(elementId) {
      this.element = document.getElementById(elementId);
      this._onClose = null;
      this._bindCloseEvents();
    }

    _bindCloseEvents() {
      if (!this.element) return;

      const closeBtn = this.element.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      this.element.addEventListener('click', (e) => {
        if (e.target === this.element) {
          this.close();
        }
      });
    }

    open(onClose = null) {
      if (!this.element) return;
      this._onClose = onClose;
      this.element.classList.remove('hidden');
    }

    close() {
      if (!this.element) return;
      this.element.classList.add('hidden');
      
      if (this._onClose) {
        this._onClose();
        this._onClose = null;
      }
    }

    isOpen() {
      return this.element && !this.element.classList.contains('hidden');
    }
  }

  // 页面管理器
  class PageManager {
    constructor() {
      this.pages = {
        dashboard: document.getElementById('page-dashboard'),
        items: document.getElementById('page-items'),
        history: document.getElementById('page-history')
      };
      
      this.navButtons = {
        dashboard: document.getElementById('btn-dashboard'),
        items: document.getElementById('btn-items'),
        history: document.getElementById('btn-history')
      };
      
      this.currentPage = 'dashboard';
      this._bindNavEvents();
    }

    _bindNavEvents() {
      Object.keys(this.navButtons).forEach(page => {
        const btn = this.navButtons[page];
        if (btn) {
          btn.addEventListener('click', () => this.switchTo(page));
        }
      });
    }

    switchTo(pageName) {
      Object.keys(this.pages).forEach(page => {
        const pageEl = this.pages[page];
        const navBtn = this.navButtons[page];

        if (page === pageName) {
          if (pageEl) pageEl.classList.remove('hidden');
          if (navBtn) navBtn.classList.add('active');
        } else {
          if (pageEl) pageEl.classList.add('hidden');
          if (navBtn) navBtn.classList.remove('active');
        }
      });

      this.currentPage = pageName;
      this._onPageChange(pageName);
    }

    _onPageChange(pageName) {
      if (pageName === 'dashboard') {
        Components.renderDashboard();
      } else if (pageName === 'items') {
        Components.renderItems();
      } else if (pageName === 'history') {
        Components.renderHistory();
      }
    }
  }

  // 渲染器组件
  class Renderer {
    constructor() {
      this.toast = new Toast();
      this.pageManager = new PageManager();
      
      this.modals = {
        item: new Modal('modal-item'),
        borrow: new Modal('modal-borrow'),
        return: new Modal('modal-return')
      };

      this.currentEditItemId = null;
      this.currentReturnRecordId = null;
      this.filters = {
        project: '',
        status: '',
        historyType: ''
      };
    }

    // ===== 仪表盘渲染 =====

    renderDashboard() {
      this._renderStatistics();
      this._renderProjectFilter();
      this._renderBorrowRecords();
    }

    _renderStatistics() {
      const stats = State.getStatistics();
      
      const statTotal = document.getElementById('stat-total');
      const statBorrowed = document.getElementById('stat-borrowed');
      const statOverdue = document.getElementById('stat-overdue');
      const statAvailable = document.getElementById('stat-available');

      if (statTotal) statTotal.textContent = stats.itemCount;
      if (statBorrowed) statBorrowed.textContent = stats.totalBorrowed;
      if (statOverdue) statOverdue.textContent = stats.overdueCount;
      if (statAvailable) statAvailable.textContent = stats.availableItems;
    }

    _renderProjectFilter() {
      const select = document.getElementById('filter-project');
      if (!select) return;

      const currentValue = select.value;
      const projects = State.projects;

      select.innerHTML = '<option value="">所有项目</option>';
      
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        if (project === currentValue) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }

    _renderBorrowRecords() {
      const tbody = document.querySelector('#table-borrows tbody');
      const emptyState = document.getElementById('empty-borrows');
      const tableContainer = document.querySelector('#table-borrows').closest('.table-container');

      if (!tbody || !emptyState || !tableContainer) return;

      const records = State.getFilteredBorrowRecords(this.filters);

      if (records.length === 0) {
        tbody.innerHTML = '';
        tableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
      }

      tableContainer.classList.remove('hidden');
      emptyState.classList.add('hidden');

      tbody.innerHTML = records.map(record => {
        const status = record.currentStatus;
        const statusClass = status === BORROW_STATUS.OVERDUE ? 'overdue' : 
                           status === BORROW_STATUS.RETURNED ? 'returned' : 'borrowed';
        const statusText = getStatusLabel(status);

        return `
          <tr data-record-id="${record.id}">
            <td>${this.escapeHtml(record.itemName)}</td>
            <td>${this.escapeHtml(record.project)}</td>
            <td>${this.escapeHtml(record.person)}</td>
            <td>${formatDate(record.borrowedAt, 'short')}</td>
            <td>${formatDate(record.expectedReturnAt, 'short')}</td>
            <td>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td>
              <div class="action-btns">
                <button class="action-btn return" data-action="return" data-id="${record.id}">归还</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      this._bindBorrowActionEvents(tbody);
    }

    _bindBorrowActionEvents(tbody) {
      tbody.querySelectorAll('[data-action="return"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const recordId = btn.dataset.id;
          this.showReturnModal(recordId);
        });
      });
    }

    // ===== 物料管理渲染 =====

    renderItems() {
      const items = State.items;
      const tbody = document.querySelector('#table-items tbody');
      const emptyState = document.getElementById('empty-items');
      const tableContainer = document.querySelector('#table-items').closest('.table-container');

      if (!tbody || !emptyState || !tableContainer) return;

      if (items.length === 0) {
        tbody.innerHTML = '';
        tableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
      }

      tableContainer.classList.remove('hidden');
      emptyState.classList.add('hidden');

      tbody.innerHTML = items.map(item => {
        const statusClass = item.status === 'low' ? 'low-stock' : 
                           item.status === 'unavailable' ? 'overdue' : 'available';
        const statusText = item.status === 'low' ? '库存低' :
                          item.status === 'unavailable' ? '无库存' : '正常';

        return `
          <tr data-item-id="${item.id}">
            <td>${this.escapeHtml(item.name)}</td>
            <td>${this.escapeHtml(item.category || '未分类')}</td>
            <td>${item.totalQuantity}</td>
            <td>${item.availableQuantity}</td>
            <td>${item.borrowedQuantity}</td>
            <td>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td>
              <div class="action-btns">
                <button class="action-btn edit" data-action="edit" data-id="${item.id}">编辑</button>
                <button class="action-btn delete" data-action="delete" data-id="${item.id}">删除</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      this._bindItemActionEvents(tbody);
    }

    _bindItemActionEvents(tbody) {
      tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.id;
          this.showItemModal(itemId);
        });
      });

      tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.id;
          this.deleteItem(itemId);
        });
      });
    }

    // ===== 历史记录渲染 =====

    renderHistory() {
      const historyList = document.getElementById('history-list');
      const emptyState = document.getElementById('empty-history');

      if (!historyList || !emptyState) return;

      const records = State.getFilteredHistory(this.filters);

      if (records.length === 0) {
        historyList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');

      historyList.innerHTML = records.map(record => {
        const icon = getHistoryIcon(record.type);
        const timeText = formatDate(record.createdAt, 'long');

        return `
          <div class="history-item">
            <div class="history-icon ${record.type}">${icon}</div>
            <div class="history-content">
              <div class="title">${this.escapeHtml(record.title)}</div>
              <div class="details">${this.escapeHtml(record.details)}</div>
            </div>
            <div class="history-time">${timeText}</div>
          </div>
        `;
      }).join('');
    }

    // ===== 模态框操作 =====

    showItemModal(itemId = null) {
      this.currentEditItemId = itemId;
      const form = document.getElementById('form-item');
      const title = document.getElementById('modal-item-title');

      if (!form || !title) return;

      form.reset();

      if (itemId) {
        const item = State.getItemById(itemId);
        if (!item) {
          this.toast.error('物料不存在');
          return;
        }

        title.textContent = '编辑物料';
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-category').value = item.category || '';
        document.getElementById('item-quantity').value = item.totalQuantity;
        document.getElementById('item-description').value = item.description || '';
      } else {
        title.textContent = '添加物料';
      }

      this.modals.item.open();
    }

    hideItemModal() {
      this.currentEditItemId = null;
      this.modals.item.close();
    }

    showBorrowModal() {
      const form = document.getElementById('form-borrow');
      const itemSelect = document.getElementById('borrow-item');
      const quantityHint = document.getElementById('borrow-available-hint');

      if (!form || !itemSelect) return;

      form.reset();
      
      const availableItems = State.items.filter(item => item.availableQuantity > 0);
      
      itemSelect.innerHTML = '<option value="">请选择物料</option>';
      availableItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (可用: ${item.availableQuantity})`;
        option.dataset.available = item.availableQuantity;
        itemSelect.appendChild(option);
      });

      const today = new Date();
      const defaultReturn = new Date(today);
      defaultReturn.setDate(today.getDate() + 7);
      document.getElementById('borrow-expected-return').value = 
        defaultReturn.toISOString().split('T')[0];

      if (quantityHint) {
        quantityHint.textContent = '';
      }

      itemSelect.addEventListener('change', () => {
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        const available = selectedOption ? selectedOption.dataset.available : null;
        if (available && quantityHint) {
          quantityHint.textContent = `当前可用: ${available}`;
        } else if (quantityHint) {
          quantityHint.textContent = '';
        }
      });

      this.modals.borrow.open();
    }

    hideBorrowModal() {
      this.modals.borrow.close();
    }

    showReturnModal(recordId) {
      this.currentReturnRecordId = recordId;
      const record = State.getBorrowRecordById(recordId);
      const returnInfo = document.getElementById('return-info');

      if (!record) {
        this.toast.error('借还记录不存在');
        return;
      }

      const item = State.getItemById(record.itemId);
      const category = item ? item.category : '';

      if (returnInfo) {
        returnInfo.innerHTML = `
          <div class="info-row">
            <span class="info-label">物料名称</span>
            <span class="info-value">${this.escapeHtml(record.itemName)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">分类</span>
            <span class="info-value">${this.escapeHtml(category || '未分类')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">借出数量</span>
            <span class="info-value">${record.quantity}</span>
          </div>
          <div class="info-row">
            <span class="info-label">借用人</span>
            <span class="info-value">${this.escapeHtml(record.person)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">项目</span>
            <span class="info-value">${this.escapeHtml(record.project)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">借出时间</span>
            <span class="info-value">${formatDate(record.borrowedAt, 'short')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">预计归还</span>
            <span class="info-value">${formatDate(record.expectedReturnAt, 'short')}</span>
          </div>
        `;
      }

      this.modals.return.open();
    }

    hideReturnModal() {
      this.currentReturnRecordId = null;
      this.modals.return.close();
    }

    // ===== 表单提交处理 =====

    handleItemSubmit() {
      const form = document.getElementById('form-item');
      if (!form) return;

      const itemData = {
        id: this.currentEditItemId,
        name: document.getElementById('item-name').value,
        category: document.getElementById('item-category').value,
        totalQuantity: parseInt(document.getElementById('item-quantity').value) || 0,
        description: document.getElementById('item-description').value
      };

      let result;
      if (this.currentEditItemId) {
        const existingItem = State.getItemById(this.currentEditItemId);
        itemData.borrowedQuantity = existingItem ? existingItem.borrowedQuantity : 0;
        result = State.updateItem(this.currentEditItemId, itemData);
      } else {
        itemData.borrowedQuantity = 0;
        result = State.addItem(itemData);
      }

      if (result.success) {
        this.toast.success(this.currentEditItemId ? '物料已更新' : '物料已添加');
        this.hideItemModal();
        this.renderItems();
        this.renderDashboard();
      } else {
        this.toast.error(result.message);
      }
    }

    handleBorrowSubmit() {
      const form = document.getElementById('form-borrow');
      if (!form) return;

      const borrowData = {
        itemId: document.getElementById('borrow-item').value,
        quantity: parseInt(document.getElementById('borrow-quantity').value) || 1,
        project: document.getElementById('borrow-project').value,
        person: document.getElementById('borrow-person').value,
        expectedReturnAt: document.getElementById('borrow-expected-return').value,
        notes: document.getElementById('borrow-notes').value
      };

      const result = State.borrowItem(borrowData);

      if (result.success) {
        this.toast.success('借出登记成功');
        this.hideBorrowModal();
        this.renderDashboard();
        this.renderItems();
      } else {
        this.toast.error(result.message);
      }
    }

    handleReturnConfirm() {
      if (!this.currentReturnRecordId) return;

      const result = State.returnItem(this.currentReturnRecordId);

      if (result.success) {
        this.toast.success('归还确认成功');
        this.hideReturnModal();
        this.renderDashboard();
        this.renderItems();
      } else {
        this.toast.error(result.message);
      }
    }

    deleteItem(itemId) {
      if (!confirm('确定要删除这个物料吗？')) {
        return;
      }

      const result = State.deleteItem(itemId);

      if (result.success) {
        this.toast.success('物料已删除');
        this.renderItems();
        this.renderDashboard();
      } else {
        this.toast.error(result.message);
      }
    }

    // ===== 工具方法 =====

    escapeHtml(text) {
      if (text === null || text === undefined) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    setFilter(type, value) {
      this.filters[type] = value;
    }
  }

  // 创建单例
  const Components = new Renderer();

  // 导出到全局
  global.Components = Components;
  global.Renderer = Renderer;
  global.Toast = Toast;
  global.Modal = Modal;
  global.PageManager = PageManager;

})(window);
