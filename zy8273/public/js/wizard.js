const TOTAL_STEPS = 5;
const STEP_NAMES = ['申请信息', '供应商比价', '预算科目', '附件清单', '审批预览'];

class Wizard {
  constructor() {
    this.currentStep = 0;
    this.suppliers = [];
    this.budgets = [];
    this.attachments = [];
    this.autoSaveManager = null;
    this.elements = {};
    this.conflictData = null;
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.updateStepUI();
  }

  cacheElements() {
    this.elements = {
      stepPanels: document.querySelectorAll('.step-panel'),
      stepIndicators: document.querySelectorAll('.step-indicator'),
      stepConnectors: document.querySelectorAll('.step-connector'),
      prevBtn: document.getElementById('prev-step-btn'),
      nextBtn: document.getElementById('next-step-btn'),
      submitBtn: document.getElementById('submit-btn'),
      saveStatus: document.getElementById('save-status'),
      manualSaveBtn: document.getElementById('manual-save-btn'),
      schemaWarning: document.getElementById('schema-warning'),
      conflictModal: document.getElementById('conflict-modal'),
      keepLocalBtn: document.getElementById('keep-local-btn'),
      loadServerBtn: document.getElementById('load-server-btn'),
      
      suppliersContainer: document.getElementById('suppliers-container'),
      addSupplierBtn: document.getElementById('add-supplier-btn'),
      budgetContainer: document.getElementById('budget-container'),
      addBudgetBtn: document.getElementById('add-budget-btn'),
      attachmentsContainer: document.getElementById('attachments-container'),
      uploadArea: document.getElementById('upload-area'),
      fileInput: document.getElementById('file-input'),
    };
  }

  bindEvents() {
    this.elements.prevBtn.addEventListener('click', () => this.prevStep());
    this.elements.nextBtn.addEventListener('click', () => this.nextStep());
    this.elements.submitBtn.addEventListener('click', () => this.submit());
    
    if (this.elements.manualSaveBtn) {
      this.elements.manualSaveBtn.addEventListener('click', () => {
        if (this.autoSaveManager) {
          this.autoSaveManager.manualSave();
        }
      });
    }

    this.elements.addSupplierBtn.addEventListener('click', () => this.addSupplier());
    this.elements.addBudgetBtn.addEventListener('click', () => this.addBudget());

    this.elements.uploadArea.addEventListener('click', () => {
      this.elements.fileInput.click();
    });
    this.elements.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    this.elements.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.uploadArea.classList.add('dragover');
    });
    this.elements.uploadArea.addEventListener('dragleave', () => {
      this.elements.uploadArea.classList.remove('dragover');
    });
    this.elements.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.uploadArea.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    this.elements.keepLocalBtn.addEventListener('click', () => this.keepLocalVersion());
    this.elements.loadServerBtn.addEventListener('click', () => this.loadServerVersion());

    this.bindFormChangeEvents();
  }

  bindFormChangeEvents() {
    const formInputs = document.querySelectorAll('.form-input, .form-textarea, .form-select');
    formInputs.forEach(input => {
      input.addEventListener('input', () => this.onFormChange());
      input.addEventListener('change', () => this.onFormChange());
    });
  }

  onFormChange() {
    if (this.autoSaveManager) {
      this.autoSaveManager.markAsChanged();
    }
    this.updateSaveStatus('changed');
    
    if (this.currentStep === 4) {
      this.updatePreview();
    }
  }

  setAutoSaveManager(manager) {
    this.autoSaveManager = manager;
  }

  getCurrentStep() {
    return this.currentStep;
  }

  nextStep() {
    if (this.currentStep < TOTAL_STEPS - 1) {
      if (this.validateCurrentStep()) {
        this.currentStep++;
        this.updateStepUI();
        this.onStepChange();
      }
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateStepUI();
      this.onStepChange();
    }
  }

  goToStep(step) {
    if (step >= 0 && step < TOTAL_STEPS) {
      this.currentStep = step;
      this.updateStepUI();
      this.onStepChange();
    }
  }

  onStepChange() {
    storage.setCurrentStep(this.currentStep);
    if (this.autoSaveManager) {
      this.autoSaveManager.markAsChanged();
    }
    
    if (this.currentStep === 1) {
      this.renderSuppliers();
    } else if (this.currentStep === 2) {
      this.renderBudgets();
    } else if (this.currentStep === 3) {
      this.renderAttachments();
    } else if (this.currentStep === 4) {
      this.updatePreview();
    }
  }

  validateCurrentStep() {
    if (this.currentStep === 0) {
      const applicant = document.getElementById('applicant').value.trim();
      const department = document.getElementById('department').value.trim();
      const projectName = document.getElementById('project-name').value.trim();
      
      if (!applicant || !department || !projectName) {
        alert('请填写必填项：申请人、申请部门、项目名称');
        return false;
      }
    }
    return true;
  }

  updateStepUI() {
    this.elements.stepPanels.forEach((panel, index) => {
      panel.style.display = index === this.currentStep ? 'block' : 'none';
    });

    this.elements.stepIndicators.forEach((indicator, index) => {
      indicator.classList.remove('active', 'completed');
      if (index === this.currentStep) {
        indicator.classList.add('active');
      } else if (index < this.currentStep) {
        indicator.classList.add('completed');
      }
    });

    this.elements.stepConnectors.forEach((connector, index) => {
      if (index < this.currentStep) {
        connector.classList.add('completed');
      } else {
        connector.classList.remove('completed');
      }
    });

    this.elements.prevBtn.style.display = this.currentStep > 0 ? 'inline-flex' : 'none';
    this.elements.nextBtn.style.display = this.currentStep < TOTAL_STEPS - 1 ? 'inline-flex' : 'none';
    this.elements.submitBtn.style.display = this.currentStep === TOTAL_STEPS - 1 ? 'inline-flex' : 'none';
  }

  updateSaveStatus(status) {
    const statusEl = this.elements.saveStatus;
    statusEl.className = 'save-status';
    
    switch (status) {
      case 'saving':
        statusEl.textContent = '⏳ 保存中...';
        statusEl.classList.add('saving');
        break;
      case 'saved':
        statusEl.textContent = '✓ 已保存';
        statusEl.classList.add('saved');
        break;
      case 'error':
        statusEl.textContent = '✗ 保存失败';
        statusEl.classList.add('error');
        break;
      case 'changed':
        statusEl.textContent = '● 有未保存的更改';
        break;
      default:
        statusEl.textContent = '';
    }
  }

  showSchemaWarning(show, text) {
    if (show) {
      this.elements.schemaWarning.style.display = 'block';
      if (text) {
        document.getElementById('schema-warning-text').textContent = text;
      }
    } else {
      this.elements.schemaWarning.style.display = 'none';
    }
  }

  collectFormData() {
    const data = {
      applicationInfo: {
        applicant: document.getElementById('applicant').value.trim(),
        department: document.getElementById('department').value.trim(),
        applicationDate: document.getElementById('application-date').value,
        projectName: document.getElementById('project-name').value.trim(),
        projectDescription: document.getElementById('project-description').value.trim(),
        totalAmount: parseFloat(document.getElementById('total-amount').value) || 0,
      },
      supplierComparison: this.suppliers.map(s => ({
        supplierName: s.supplierName || '',
        contactPerson: s.contactPerson || '',
        contactPhone: s.contactPhone || '',
        productName: s.productName || '',
        unitPrice: s.unitPrice || 0,
        quantity: s.quantity || 0,
        totalPrice: s.totalPrice || 0,
        deliveryDays: s.deliveryDays || 0,
        warranty: s.warranty || '',
      })),
      budgetItems: this.budgets.map(b => ({
        subjectCode: b.subjectCode || '',
        subjectName: b.subjectName || '',
        amount: b.amount || 0,
        remark: b.remark || '',
      })),
      attachments: this.attachments.map(a => ({
        name: a.name || '',
        size: a.size || 0,
        type: a.type || '',
      })),
    };
    return data;
  }

  populateFormData(data) {
    if (!data) return;

    const appInfo = data.applicationInfo || {};
    document.getElementById('applicant').value = appInfo.applicant || '';
    document.getElementById('department').value = appInfo.department || '';
    document.getElementById('application-date').value = appInfo.applicationDate || '';
    document.getElementById('project-name').value = appInfo.projectName || '';
    document.getElementById('project-description').value = appInfo.projectDescription || '';
    document.getElementById('total-amount').value = appInfo.totalAmount || 0;

    this.suppliers = (data.supplierComparison || []).slice();
    this.budgets = (data.budgetItems || []).slice();
    this.attachments = (data.attachments || []).slice();
  }

  addSupplier() {
    this.suppliers.push({
      supplierName: '',
      contactPerson: '',
      contactPhone: '',
      productName: '',
      unitPrice: 0,
      quantity: 0,
      totalPrice: 0,
      deliveryDays: 0,
      warranty: '',
    });
    this.renderSuppliers();
    this.onFormChange();
  }

  removeSupplier(index) {
    this.suppliers.splice(index, 1);
    this.renderSuppliers();
    this.onFormChange();
  }

  renderSuppliers() {
    const container = this.elements.suppliersContainer;
    container.innerHTML = '';

    const template = document.getElementById('supplier-template');

    this.suppliers.forEach((supplier, index) => {
      const clone = document.importNode(template.content, true);
      
      const card = clone.querySelector('.supplier-card');
      card.dataset.index = index;
      
      clone.querySelector('h4').textContent = `供应商 #${index + 1}`;
      const removeBtn = clone.querySelector('.btn-remove');
      removeBtn.dataset.supplierIndex = index;
      
      clone.querySelector('.supplier-name').value = supplier.supplierName || '';
      clone.querySelector('.supplier-contact').value = supplier.contactPerson || '';
      clone.querySelector('.supplier-phone').value = supplier.contactPhone || '';
      clone.querySelector('.supplier-product').value = supplier.productName || '';
      clone.querySelector('.supplier-price').value = supplier.unitPrice || '';
      clone.querySelector('.supplier-quantity').value = supplier.quantity || '';
      clone.querySelector('.supplier-delivery').value = supplier.deliveryDays || '';
      clone.querySelector('.supplier-warranty').value = supplier.warranty || '';

      container.appendChild(clone);
    });

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.supplierIndex);
        this.removeSupplier(index);
      });
    });

    container.querySelectorAll('.form-input').forEach((input, idx) => {
      const supplierIndex = Math.floor(idx / 8);
      const fieldIndex = idx % 8;
      const fields = [
        'supplierName', 'contactPerson', 'contactPhone', 'productName',
        'unitPrice', 'quantity', 'deliveryDays', 'warranty'
      ];
      
      input.addEventListener('input', (e) => {
        if (fieldIndex === 4 || fieldIndex === 5) {
          this.suppliers[supplierIndex][fields[fieldIndex]] = parseFloat(e.target.value) || 0;
          const price = this.suppliers[supplierIndex].unitPrice;
          const qty = this.suppliers[supplierIndex].quantity;
          this.suppliers[supplierIndex].totalPrice = price * qty;
        } else {
          this.suppliers[supplierIndex][fields[fieldIndex]] = e.target.value;
        }
        this.onFormChange();
      });
    });
  }

  addBudget() {
    this.budgets.push({
      subjectCode: '',
      subjectName: '',
      amount: 0,
      remark: '',
    });
    this.renderBudgets();
    this.onFormChange();
  }

  removeBudget(index) {
    this.budgets.splice(index, 1);
    this.renderBudgets();
    this.onFormChange();
  }

  renderBudgets() {
    const container = this.elements.budgetContainer;
    container.innerHTML = '';

    const template = document.getElementById('budget-template');

    this.budgets.forEach((budget, index) => {
      const clone = document.importNode(template.content, true);
      
      const item = clone.querySelector('.budget-item');
      item.dataset.index = index;
      
      clone.querySelector('h4').textContent = `预算科目 #${index + 1}`;
      const removeBtn = clone.querySelector('.btn-remove');
      removeBtn.dataset.budgetIndex = index;
      
      clone.querySelector('.budget-code').value = budget.subjectCode || '';
      clone.querySelector('.budget-name').value = budget.subjectName || '';
      clone.querySelector('.budget-amount').value = budget.amount || '';
      clone.querySelector('.budget-remark').value = budget.remark || '';

      container.appendChild(clone);
    });

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.budgetIndex);
        this.removeBudget(index);
      });
    });

    container.querySelectorAll('.form-input').forEach((input, idx) => {
      const budgetIndex = Math.floor(idx / 4);
      const fieldIndex = idx % 4;
      const fields = ['subjectCode', 'subjectName', 'amount', 'remark'];
      
      input.addEventListener('input', (e) => {
        if (fieldIndex === 2) {
          this.budgets[budgetIndex][fields[fieldIndex]] = parseFloat(e.target.value) || 0;
        } else {
          this.budgets[budgetIndex][fields[fieldIndex]] = e.target.value;
        }
        this.onFormChange();
      });
    });
  }

  handleFiles(files) {
    Array.from(files).forEach(file => {
      this.attachments.push({
        name: file.name,
        size: file.size,
        type: file.type,
      });
    });
    this.renderAttachments();
    this.onFormChange();
  }

  removeAttachment(index) {
    this.attachments.splice(index, 1);
    this.renderAttachments();
    this.onFormChange();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  renderAttachments() {
    const container = this.elements.attachmentsContainer;
    container.innerHTML = '';

    const template = document.getElementById('attachment-template');

    this.attachments.forEach((attachment, index) => {
      const clone = document.importNode(template.content, true);
      
      const item = clone.querySelector('.attachment-item');
      item.dataset.index = index;
      
      clone.querySelector('.attachment-name').textContent = attachment.name;
      clone.querySelector('.attachment-size').textContent = this.formatFileSize(attachment.size);
      
      const removeBtn = clone.querySelector('.btn-remove');
      removeBtn.dataset.attachmentIndex = index;

      container.appendChild(clone);
    });

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.attachmentIndex);
        this.removeAttachment(index);
      });
    });
  }

  updatePreview() {
    const data = this.collectFormData();

    const appInfo = data.applicationInfo;
    document.getElementById('preview-application').innerHTML = `
      <div class="preview-row">
        <span class="preview-label">申请人</span>
        <span class="preview-value">${appInfo.applicant || '<span class="no-data">未填写</span>'}</span>
      </div>
      <div class="preview-row">
        <span class="preview-label">申请部门</span>
        <span class="preview-value">${appInfo.department || '<span class="no-data">未填写</span>'}</span>
      </div>
      <div class="preview-row">
        <span class="preview-label">申请日期</span>
        <span class="preview-value">${appInfo.applicationDate || '<span class="no-data">未填写</span>'}</span>
      </div>
      <div class="preview-row">
        <span class="preview-label">项目名称</span>
        <span class="preview-value">${appInfo.projectName || '<span class="no-data">未填写</span>'}</span>
      </div>
      <div class="preview-row">
        <span class="preview-label">项目描述</span>
        <span class="preview-value">${appInfo.projectDescription || '<span class="no-data">未填写</span>'}</span>
      </div>
      <div class="preview-row">
        <span class="preview-label">预计总金额</span>
        <span class="preview-value">¥${appInfo.totalAmount?.toLocaleString() || '0'}</span>
      </div>
    `;

    if (data.supplierComparison.length === 0) {
      document.getElementById('preview-suppliers').innerHTML = '<p class="no-data">暂无供应商信息</p>';
    } else {
      document.getElementById('preview-suppliers').innerHTML = `
        <table class="supplier-table">
          <thead>
            <tr>
              <th>供应商</th>
              <th>产品</th>
              <th>单价</th>
              <th>数量</th>
              <th>总价</th>
              <th>交货期</th>
              <th>质保</th>
            </tr>
          </thead>
          <tbody>
            ${data.supplierComparison.map(s => `
              <tr>
                <td>${s.supplierName || '-'}</td>
                <td>${s.productName || '-'}</td>
                <td>¥${s.unitPrice?.toLocaleString() || 0}</td>
                <td>${s.quantity || 0}</td>
                <td>¥${s.totalPrice?.toLocaleString() || 0}</td>
                <td>${s.deliveryDays || '-'}天</td>
                <td>${s.warranty || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (data.budgetItems.length === 0) {
      document.getElementById('preview-budget').innerHTML = '<p class="no-data">暂无预算科目</p>';
    } else {
      document.getElementById('preview-budget').innerHTML = data.budgetItems.map(b => `
        <div class="preview-row">
          <span class="preview-label">${b.subjectCode || '-'} - ${b.subjectName || '未命名'}</span>
          <span class="preview-value">¥${b.amount?.toLocaleString() || 0}${b.remark ? ` (${b.remark})` : ''}</span>
        </div>
      `).join('');
    }

    if (data.attachments.length === 0) {
      document.getElementById('preview-attachments').innerHTML = '<p class="no-data">暂无附件</p>';
    } else {
      document.getElementById('preview-attachments').innerHTML = data.attachments.map(a => `
        <div class="preview-row">
          <span class="preview-label">📄 ${a.name}</span>
          <span class="preview-value">${this.formatFileSize(a.size)}</span>
        </div>
      `).join('');
    }
  }

  async handleConflict(error) {
    this.conflictData = error.getConflictData();
    console.log('Conflict detected:', this.conflictData);
    
    if (this.autoSaveManager) {
      this.autoSaveManager.stop();
    }

    this.elements.conflictModal.style.display = 'flex';
  }

  async keepLocalVersion() {
    if (!this.conflictData) return;

    const draftId = storage.getCurrentDraftId();
    if (!draftId) return;

    try {
      const data = this.collectFormData();
      const currentStep = this.currentStep;
      
      const result = await api.updateDraft(draftId, data, {
        current_step: currentStep,
        version: undefined,
        isAutoSave: false,
      });

      if (result.success) {
        storage.setDraftVersion(result.data.version);
        if (this.autoSaveManager) {
          this.autoSaveManager.start();
        }
        this.elements.conflictModal.style.display = 'none';
        this.conflictData = null;
        this.updateSaveStatus('saved');
      }
    } catch (error) {
      console.error('Keep local version failed:', error);
      alert('保存失败，请重试');
    }
  }

  async loadServerVersion() {
    if (!this.conflictData) return;

    const serverVersion = this.conflictData.serverVersion;
    
    this.populateFormData(serverVersion.data);
    storage.setDraftVersion(serverVersion.version);
    
    this.showSchemaWarning(serverVersion.isSchemaOutdated);
    this.goToStep(serverVersion.current_step);

    if (this.autoSaveManager) {
      this.autoSaveManager.start();
    }
    
    this.elements.conflictModal.style.display = 'none';
    this.conflictData = null;
    this.updateSaveStatus('saved');
  }

  async submit() {
    const draftId = storage.getCurrentDraftId();
    if (!draftId) {
      alert('无法提交：草稿ID不存在');
      return;
    }

    if (confirm('确认提交此申请？提交后将无法修改。')) {
      try {
        this.elements.submitBtn.disabled = true;
        
        await this.autoSaveManager?.manualSave();
        
        const result = await api.submitDraft(draftId, '当前用户');
        
        if (result.success) {
          app.showSubmittedView(result.data);
        }
      } catch (error) {
        console.error('Submit failed:', error);
        alert('提交失败：' + (error.message || '未知错误'));
      } finally {
        this.elements.submitBtn.disabled = false;
      }
    }
  }
}
