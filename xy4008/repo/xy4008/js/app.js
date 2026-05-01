(function(global) {
  'use strict';

  const Components = global.Components;
  const State = global.State;
  const CSV = global.CSV;
  const Toast = Components.toast;

  // 应用主类
  class App {
    constructor() {
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      
      this._bindGlobalEvents();
      this._bindFormEvents();
      this._bindFilterEvents();
      this._bindButtonEvents();
      this._bindFileInputEvents();
      
      Components.renderDashboard();
      
      this.initialized = true;
      console.log('物料借还追踪系统已初始化');
    }

    _bindGlobalEvents() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          Object.values(Components.modals).forEach(modal => {
            if (modal.isOpen()) {
              modal.close();
            }
          });
        }
      });

      setInterval(() => {
        const overdueCount = State.overdueRecords.length;
        if (overdueCount > 0) {
        }
      }, 60000);
    }

    _bindFormEvents() {
      const itemForm = document.getElementById('form-item');
      if (itemForm) {
        itemForm.addEventListener('submit', (e) => {
          e.preventDefault();
          Components.handleItemSubmit();
        });
      }

      const borrowForm = document.getElementById('form-borrow');
      if (borrowForm) {
        borrowForm.addEventListener('submit', (e) => {
          e.preventDefault();
          Components.handleBorrowSubmit();
        });
      }

      const cancelItemBtn = document.getElementById('cancel-item');
      if (cancelItemBtn) {
        cancelItemBtn.addEventListener('click', () => {
          Components.hideItemModal();
        });
      }

      const cancelBorrowBtn = document.getElementById('cancel-borrow');
      if (cancelBorrowBtn) {
        cancelBorrowBtn.addEventListener('click', () => {
          Components.hideBorrowModal();
        });
      }

      const cancelReturnBtn = document.getElementById('cancel-return');
      if (cancelReturnBtn) {
        cancelReturnBtn.addEventListener('click', () => {
          Components.hideReturnModal();
        });
      }

      const confirmReturnBtn = document.getElementById('confirm-return');
      if (confirmReturnBtn) {
        confirmReturnBtn.addEventListener('click', () => {
          Components.handleReturnConfirm();
        });
      }
    }

    _bindFilterEvents() {
      const filterProject = document.getElementById('filter-project');
      const filterStatus = document.getElementById('filter-status');
      const filterHistoryType = document.getElementById('filter-history-type');

      if (filterProject) {
        filterProject.addEventListener('change', () => {
          Components.setFilter('project', filterProject.value);
          Components._renderBorrowRecords();
        });
      }

      if (filterStatus) {
        filterStatus.addEventListener('change', () => {
          Components.setFilter('status', filterStatus.value);
          Components._renderBorrowRecords();
        });
      }

      if (filterHistoryType) {
        filterHistoryType.addEventListener('change', () => {
          Components.setFilter('historyType', filterHistoryType.value);
          Components.renderHistory();
        });
      }
    }

    _bindButtonEvents() {
      const btnNewItem = document.getElementById('btn-new-item');
      if (btnNewItem) {
        btnNewItem.addEventListener('click', () => {
          Components.showItemModal();
        });
      }

      const btnNewBorrow = document.getElementById('btn-new-borrow');
      if (btnNewBorrow) {
        btnNewBorrow.addEventListener('click', () => {
          const availableItems = State.items.filter(item => item.availableQuantity > 0);
          if (availableItems.length === 0) {
            Toast.warning('当前没有可借用的物料');
            return;
          }
          Components.showBorrowModal();
        });
      }

      const btnImport = document.getElementById('btn-import');
      const importCsv = document.getElementById('import-csv');
      if (btnImport && importCsv) {
        btnImport.addEventListener('click', () => {
          importCsv.click();
        });
      }

      const btnExport = document.getElementById('btn-export');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          this.exportBorrowRecords();
        });
      }

      const btnClearHistory = document.getElementById('btn-clear-history');
      if (btnClearHistory) {
        btnClearHistory.addEventListener('click', () => {
          if (confirm('确定要清空所有操作历史吗？此操作不可恢复。')) {
            const result = State.clearHistory();
            if (result.success) {
              Toast.success('历史记录已清空');
              Components.renderHistory();
            }
          }
        });
      }
    }

    _bindFileInputEvents() {
      const importCsv = document.getElementById('import-csv');
      if (importCsv) {
        importCsv.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const result = await CSV.importItemsFromFile(file);
            
            if (result.success) {
              if (result.imported > 0) {
                Toast.success(result.message);
                State.loadFromStorage();
                Components.renderItems();
                Components.renderDashboard();
              } else {
                if (result.skipped > 0) {
                  Toast.warning(result.message);
                } else {
                  Toast.warning('没有物料被导入');
                }
              }
              
              if (result.errors && result.errors.length > 0) {
                console.error('CSV导入错误:', result.errors);
              }
            } else {
              Toast.error(result.message);
            }
          } catch (error) {
            console.error('导入失败:', error);
            Toast.error('导入失败: ' + error.message);
          }

          e.target.value = '';
        });
      }
    }

    exportBorrowRecords() {
      const records = State.activeBorrowRecords;
      
      if (records.length === 0) {
        Toast.warning('当前没有可导出的借出记录');
        return;
      }

      const result = CSV.exportActiveBorrowRecords();
      
      if (result.success) {
        CSV.downloadCSV(result.csvContent, result.filename);
        Toast.success('导出成功');
      } else {
        Toast.error(result.message);
      }
    }
  }

  // 创建应用实例
  const AppInstance = new App();

  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AppInstance.init();
    });
  } else {
    AppInstance.init();
  }

  // 导出到全局
  global.App = AppInstance;
  global.AppClass = App;

})(window);
