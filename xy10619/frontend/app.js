const { createApp } = Vue;

const API_BASE = 'http://localhost:3000';

createApp({
  data() {
    return {
      currentPage: 'dashboard',
      statistics: {},
      recentAnomalies: [],
      recentDebts: [],
      borrows: [],
      anomalies: [],
      debts: [],
      lostCompensations: [],
      replacementBooks: [],
      reductions: [],
      logs: [],
      readers: [],
      staff: [],
      damageLevels: [],
      reportSummary: {},
      compTab: 'lost',
      
      filters: {
        readerId: '',
        status: '',
        startDate: '',
        endDate: ''
      },
      anomalyFilters: {
        isResolved: '',
        severity: '',
        recordType: ''
      },
      debtFilters: {
        readerId: '',
        debtType: '',
        isPaid: ''
      },
      reportFilters: {
        reportType: 'debts',
        processedBy: '',
        startDate: '',
        endDate: '',
        includeOverdue: false,
        includeDamage: false,
        includeLost: false
      },
      logFilters: {
        tableName: '',
        recordId: ''
      },
      
      editForm: {
        id: null,
        is_overdue: 0,
        overdue_days: 0,
        overdue_fine: 0,
        damage_level_id: null,
        damage_compensation: 0,
        status: 'borrowed',
        processed_by: 1
      },
      reductionForm: {
        debtId: null,
        reductionAmount: 0,
        reductionReason: ''
      },
      replacementForm: {
        lostCompensationId: null,
        bookTitle: '',
        isbn: '',
        publisher: ''
      },
      
      borrowModal: null,
      reductionModal: null,
      replacementModal: null
    };
  },
  computed: {
    unpaidLostCompensations() {
      return this.lostCompensations.filter(lc => !lc.is_paid);
    }
  },
  mounted() {
    this.initModals();
    this.loadMasterData();
    this.loadDashboard();
  },
  watch: {
    compTab(newVal) {
      if (newVal === 'lost') this.loadLostCompensations();
      if (newVal === 'replacement') this.loadReplacementBooks();
      if (newVal === 'reduction') this.loadReductions();
    },
    showAddReplacement(newVal) {
      if (newVal) {
        this.replacementModal.show();
      } else {
        this.replacementModal.hide();
      }
    }
  },
  methods: {
    initModals() {
      this.borrowModal = new bootstrap.Modal(document.getElementById('borrowModal'));
      this.reductionModal = new bootstrap.Modal(document.getElementById('reductionModal'));
      this.replacementModal = new bootstrap.Modal(document.getElementById('replacementModal'));
    },
    
    async loadMasterData() {
      try {
        const [staffRes, damageRes, readersRes] = await Promise.all([
          fetch(`${API_BASE}/api/staff`),
          fetch(`${API_BASE}/api/damage-levels`),
          fetch(`${API_BASE}/api/readers`)
        ]);
        
        const staffData = await staffRes.json();
        const damageData = await damageRes.json();
        const readersData = await readersRes.json();
        
        this.staff = staffData.data || [];
        this.damageLevels = damageData.data || [];
        this.readers = readersData.data || [];
      } catch (e) {
        console.error('加载基础数据失败', e);
      }
    },
    
    async loadDashboard() {
      try {
        const res = await fetch(`${API_BASE}/api/statistics`);
        const data = await res.json();
        this.statistics = data.data || {};
        
        await this.loadAnomalies();
        await this.loadDebts();
        
        this.recentAnomalies = this.anomalies.slice(0, 5);
        this.recentDebts = this.debts.slice(0, 5);
      } catch (e) {
        console.error('加载数据概览失败', e);
      }
    },
    
    async loadBorrows() {
      try {
        const params = new URLSearchParams();
        if (this.filters.readerId) params.append('readerId', this.filters.readerId);
        if (this.filters.status) params.append('status', this.filters.status);
        if (this.filters.startDate) params.append('startDate', this.filters.startDate);
        if (this.filters.endDate) params.append('endDate', this.filters.endDate);
        
        const res = await fetch(`${API_BASE}/api/borrows?${params}`);
        const data = await res.json();
        this.borrows = data.data || [];
      } catch (e) {
        console.error('加载借阅记录失败', e);
      }
    },
    
    async loadAnomalies() {
      try {
        const params = new URLSearchParams();
        if (this.anomalyFilters.isResolved !== '') params.append('isResolved', this.anomalyFilters.isResolved);
        if (this.anomalyFilters.severity) params.append('severity', this.anomalyFilters.severity);
        if (this.anomalyFilters.recordType) params.append('recordType', this.anomalyFilters.recordType);
        
        const res = await fetch(`${API_BASE}/api/anomalies?${params}`);
        const data = await res.json();
        this.anomalies = data.data || [];
      } catch (e) {
        console.error('加载异常记录失败', e);
      }
    },
    
    async loadDebts() {
      try {
        const params = new URLSearchParams();
        if (this.debtFilters.readerId) params.append('readerId', this.debtFilters.readerId);
        if (this.debtFilters.debtType) params.append('debtType', this.debtFilters.debtType);
        if (this.debtFilters.isPaid !== '') params.append('isPaid', this.debtFilters.isPaid);
        
        const res = await fetch(`${API_BASE}/api/debts?${params}`);
        const data = await res.json();
        this.debts = data.data || [];
      } catch (e) {
        console.error('加载欠费记录失败', e);
      }
    },
    
    async loadLostCompensations() {
      try {
        const res = await fetch(`${API_BASE}/api/compensations/lost`);
        const data = await res.json();
        this.lostCompensations = data.data || [];
      } catch (e) {
        console.error('加载遗失赔偿失败', e);
      }
    },
    
    async loadReplacementBooks() {
      try {
        const res = await fetch(`${API_BASE}/api/compensations/replacement`);
        const data = await res.json();
        this.replacementBooks = data.data || [];
      } catch (e) {
        console.error('加载替代书失败', e);
      }
    },
    
    async loadReductions() {
      try {
        const res = await fetch(`${API_BASE}/api/compensations/reduction`);
        const data = await res.json();
        this.reductions = data.data || [];
      } catch (e) {
        console.error('加载减免申请失败', e);
      }
    },
    
    async loadLogs() {
      try {
        const params = new URLSearchParams();
        if (this.logFilters.tableName) params.append('tableName', this.logFilters.tableName);
        if (this.logFilters.recordId) params.append('recordId', this.logFilters.recordId);
        
        const res = await fetch(`${API_BASE}/api/logs?${params}`);
        const data = await res.json();
        this.logs = data.data || [];
      } catch (e) {
        console.error('加载修改日志失败', e);
      }
    },
    
    async loadReportSummary() {
      try {
        const res = await fetch(`${API_BASE}/api/reports/summary`);
        const data = await res.json();
        this.reportSummary = data.data || {};
      } catch (e) {
        console.error('加载报表汇总失败', e);
      }
    },
    
    editBorrow(item) {
      this.editForm = {
        id: item.id,
        is_overdue: item.is_overdue,
        overdue_days: item.overdue_days,
        overdue_fine: item.overdue_fine,
        damage_level_id: item.damage_level_id,
        damage_compensation: item.damage_compensation,
        status: item.status,
        processed_by: item.processed_by || 1
      };
      this.borrowModal.show();
    },
    
    async saveBorrow() {
      try {
        const res = await fetch(`${API_BASE}/api/borrows/${this.editForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.editForm)
        });
        const data = await res.json();
        if (data.success) {
          alert('保存成功！');
          this.borrowModal.hide();
          this.loadBorrows();
        } else {
          alert('保存失败：' + data.message);
        }
      } catch (e) {
        console.error('保存失败', e);
        alert('保存失败');
      }
    },
    
    async resolveAnomaly(item) {
      if (!confirm('确认标记为已解决？')) return;
      try {
        const res = await fetch(`${API_BASE}/api/anomalies/${item.id}/resolve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolvedBy: 1 })
        });
        const data = await res.json();
        if (data.success) {
          alert('操作成功！');
          this.loadAnomalies();
        } else {
          alert('操作失败');
        }
      } catch (e) {
        console.error('操作失败', e);
      }
    },
    
    async payDebt(item) {
      if (!confirm('确认缴费？')) return;
      try {
        const res = await fetch(`${API_BASE}/api/debts/${item.id}/pay`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paidDate: new Date().toISOString().split('T')[0], processedBy: 1 })
        });
        const data = await res.json();
        if (data.success) {
          alert('缴费成功！');
          this.loadDebts();
        } else {
          alert('操作失败');
        }
      } catch (e) {
        console.error('操作失败', e);
      }
    },
    
    applyReduction(item) {
      this.reductionForm.debtId = item.id;
      this.reductionForm.reductionAmount = Math.min(item.final_amount, 10);
      this.reductionForm.reductionReason = '';
      this.reductionModal.show();
    },
    
    async submitReduction() {
      try {
        const res = await fetch(`${API_BASE}/api/compensations/reduction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            debtId: this.reductionForm.debtId,
            reductionAmount: this.reductionForm.reductionAmount,
            reductionReason: this.reductionForm.reductionReason,
            remarks: '申请减免'
          })
        });
        const data = await res.json();
        if (data.success) {
          alert('申请提交成功！');
          this.reductionModal.hide();
        } else {
          alert('提交失败：' + data.message);
        }
      } catch (e) {
        console.error('提交失败', e);
      }
    },
    
    async approveReduction(item) {
      if (!confirm('确认批准该减免申请？')) return;
      try {
        const res = await fetch(`${API_BASE}/api/compensations/reduction/${item.id}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvedBy: 1, remarks: '已批准' })
        });
        const data = await res.json();
        if (data.success) {
          alert('审批成功！');
          this.loadReductions();
          this.loadDebts();
        } else {
          alert('操作失败');
        }
      } catch (e) {
        console.error('操作失败', e);
      }
    },
    
    async payLostCompensation(item) {
      if (!confirm('确认收到赔偿款？')) return;
      try {
        const res = await fetch(`${API_BASE}/api/compensations/lost/${item.id}/pay`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ processedBy: 1 })
        });
        const data = await res.json();
        if (data.success) {
          alert('操作成功！');
          this.loadLostCompensations();
        } else {
          alert('操作失败');
        }
      } catch (e) {
        console.error('操作失败', e);
      }
    },
    
    async submitReplacement() {
      try {
        const res = await fetch(`${API_BASE}/api/compensations/replacement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lostCompensationId: this.replacementForm.lostCompensationId,
            bookTitle: this.replacementForm.bookTitle,
            isbn: this.replacementForm.isbn,
            publisher: this.replacementForm.publisher,
            remarks: '提交替代书'
          })
        });
        const data = await res.json();
        if (data.success) {
          alert('提交成功！');
          this.replacementModal.hide();
          this.loadReplacementBooks();
        } else {
          alert('提交失败：' + data.message);
        }
      } catch (e) {
        console.error('提交失败', e);
      }
    },
    
    async acceptReplacement(item) {
      if (!confirm('确认验收通过？')) return;
      try {
        const res = await fetch(`${API_BASE}/api/compensations/replacement/${item.id}/accept`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acceptedBy: 1, remarks: '验收通过' })
        });
        const data = await res.json();
        if (data.success) {
          alert('验收成功！');
          this.loadReplacementBooks();
          this.loadLostCompensations();
        } else {
          alert('操作失败');
        }
      } catch (e) {
        console.error('操作失败', e);
      }
    },
    
    async exportReport() {
      try {
        const params = new URLSearchParams();
        params.append('reportType', this.reportFilters.reportType);
        if (this.reportFilters.processedBy) params.append('processedBy', this.reportFilters.processedBy);
        if (this.reportFilters.startDate) params.append('startDate', this.reportFilters.startDate);
        if (this.reportFilters.endDate) params.append('endDate', this.reportFilters.endDate);
        if (this.reportFilters.includeOverdue) params.append('includeOverdue', 'true');
        if (this.reportFilters.includeDamage) params.append('includeDamage', 'true');
        if (this.reportFilters.includeLost) params.append('includeLost', 'true');
        
        const res = await fetch(`${API_BASE}/api/reports/export?${params}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.reportFilters.reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error('导出失败', e);
        alert('导出失败');
      }
    },
    
    getDebtTypeName(type) {
      const map = {
        'overdue': '逾期费用',
        'damage': '破损赔偿',
        'lost': '遗失赔偿'
      };
      return map[type] || type;
    }
  }
}).mount('#app');
