const STATUS_MAP = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消'
};

const PRIORITY_MAP = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急'
};

function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}:${s}`;
}

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }
  
  getHeaders(operator) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (operator) {
      headers['X-Operator'] = encodeURIComponent(operator);
    }
    return headers;
  }
  
  async request(method, url, data = null, operator = 'system', idempotent = true) {
    const requestId = generateRequestId();
    const headers = this.getHeaders(operator);
    if (idempotent) {
      headers['X-Request-ID'] = requestId;
    }
    
    const options = {
      method,
      headers,
      credentials: 'same-origin'
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(this.baseUrl + url, options);
      const result = await response.json();
      
      if (result.code !== 0) {
        throw new Error(result.message || '请求失败');
      }
      
      return result.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }
  
  async get(url, params = {}, operator) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return this.request('GET', fullUrl, null, operator, false);
  }
  
  async post(url, data, operator) {
    return this.request('POST', url, data, operator, true);
  }
  
  async put(url, data, operator) {
    return this.request('PUT', url, data, operator, true);
  }
  
  async delete(url, operator) {
    return this.request('DELETE', url, null, operator, true);
  }
}

const api = new ApiClient();

new Vue({
  el: '#app',
  
  data() {
    return {
      activeTab: 'tasks',
      currentOperator: '客服小王',
      users: [],
      stats: {},
      
      tasks: [],
      loadingTasks: false,
      pagination: { page: 1, pageSize: 20, total: 0 },
      
      filters: {
        keyword: '',
        status: '',
        problem_type: '',
        assignee: ''
      },
      dateRange: null,
      
      auditLogs: [],
      loadingAudit: false,
      auditPagination: { page: 1, pageSize: 20, total: 0 },
      auditFilters: { module: '', operator: '' },
      
      taskDialogVisible: false,
      dialogTitle: '新建任务',
      isEditing: false,
      savingTask: false,
      taskForm: {
        id: null,
        customer_name: '',
        customer_phone: '',
        customer_account: '',
        problem_type: '补发商品',
        description: '',
        promised_action: '',
        priority: 'normal',
        assignee: '',
        due_at: null,
        version: null
      },
      taskFormRules: {
        customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
        problem_type: [{ required: true, message: '请选择问题类型', trigger: 'change' }],
        promised_action: [{ required: true, message: '请输入承诺动作', trigger: 'blur' }]
      },
      
      detailDialogVisible: false,
      selectedTask: null,
      taskTransitions: [],
      
      completeDialogVisible: false,
      completingTask: false,
      completeRemark: '',
      completingTaskId: null
    };
  },
  
  created() {
    this.init();
  },
  
  methods: {
    async init() {
      try {
        await this.loadUsers();
        if (this.users.length > 0) {
          this.currentOperator = this.users[0].display_name;
        }
        await this.loadStats();
        await this.loadTasks();
      } catch (err) {
        this.$message.error('初始化失败: ' + err.message);
      }
    },
    
    getStatusText(status) {
      return STATUS_MAP[status] || status;
    },
    
    getPriorityText(priority) {
      return PRIORITY_MAP[priority] || priority;
    },
    
    formatTime,
    
    async loadUsers() {
      this.users = await api.get('/users', {}, this.currentOperator);
    },
    
    async loadStats() {
      this.stats = await api.get('/tasks/stats', {}, this.currentOperator);
    },
    
    async loadTasks() {
      this.loadingTasks = true;
      try {
        const params = {
          page: this.pagination.page,
          pageSize: this.pagination.pageSize
        };
        
        if (this.filters.keyword) params.keyword = this.filters.keyword;
        if (this.filters.status) params.status = this.filters.status;
        if (this.filters.problem_type) params.problem_type = this.filters.problem_type;
        if (this.filters.assignee) params.assignee = this.filters.assignee;
        
        if (this.dateRange && this.dateRange.length === 2) {
          params.startTime = this.dateRange[0];
          params.endTime = this.dateRange[1];
        }
        
        const result = await api.get('/tasks', params, this.currentOperator);
        this.tasks = result.items;
        this.pagination.total = result.total;
        this.pagination.pageSize = result.pageSize;
      } catch (err) {
        this.$message.error('加载任务失败: ' + err.message);
      } finally {
        this.loadingTasks = false;
      }
    },
    
    resetFilters() {
      this.filters = { keyword: '', status: '', problem_type: '', assignee: '' };
      this.dateRange = null;
      this.pagination.page = 1;
      this.loadTasks();
    },
    
    onPageChange(page) {
      this.pagination.page = page;
      this.loadTasks();
    },
    
    onTabChange(tab) {
      if (tab.name === 'audit' && this.auditLogs.length === 0) {
        this.loadAuditLogs();
      }
    },
    
    async loadAuditLogs() {
      this.loadingAudit = true;
      try {
        const params = {
          page: this.auditPagination.page,
          pageSize: this.auditPagination.pageSize
        };
        
        if (this.auditFilters.module) params.module = this.auditFilters.module;
        if (this.auditFilters.operator) params.operator = this.auditFilters.operator;
        
        const result = await api.get('/reports/audit', params, this.currentOperator);
        this.auditLogs = result.items;
        this.auditPagination.total = result.total;
      } catch (err) {
        this.$message.error('加载审计日志失败: ' + err.message);
      } finally {
        this.loadingAudit = false;
      }
    },
    
    onAuditPageChange(page) {
      this.auditPagination.page = page;
      this.loadAuditLogs();
    },
    
    openCreateDialog() {
      this.dialogTitle = '新建任务';
      this.isEditing = false;
      this.taskForm = {
        id: null,
        customer_name: '',
        customer_phone: '',
        customer_account: '',
        problem_type: '补发商品',
        description: '',
        promised_action: '',
        priority: 'normal',
        assignee: '',
        due_at: null,
        version: null
      };
      this.taskDialogVisible = true;
    },
    
    closeTaskDialog() {
      this.taskDialogVisible = false;
      if (this.$refs.taskForm) {
        this.$refs.taskForm.resetFields();
      }
    },
    
    async openTaskDetail(task) {
      try {
        this.selectedTask = await api.get(`/tasks/${task.id}`, {}, this.currentOperator);
        this.taskTransitions = this.selectedTask.transitions || [];
        this.detailDialogVisible = true;
      } catch (err) {
        this.$message.error('加载任务详情失败: ' + err.message);
      }
    },
    
    canEdit(task) {
      if (!task) return false;
      return task.status === 'pending' || task.status === 'in_progress';
    },
    
    openEditDialog() {
      if (!this.selectedTask) return;
      
      this.dialogTitle = '编辑任务';
      this.isEditing = true;
      this.taskForm = {
        id: this.selectedTask.id,
        customer_name: this.selectedTask.customer_name,
        customer_phone: this.selectedTask.customer_phone || '',
        customer_account: this.selectedTask.customer_account || '',
        problem_type: this.selectedTask.problem_type,
        description: this.selectedTask.description || '',
        promised_action: this.selectedTask.promised_action,
        priority: this.selectedTask.priority,
        assignee: this.selectedTask.assignee || '',
        due_at: this.selectedTask.due_at,
        version: this.selectedTask.version
      };
      this.detailDialogVisible = false;
      this.taskDialogVisible = true;
    },
    
    async saveTask() {
      if (!this.$refs.taskForm) return;
      
      try {
        await this.$refs.taskForm.validate();
      } catch (err) {
        return;
      }
      
      this.savingTask = true;
      try {
        if (this.isEditing) {
          await api.put(`/tasks/${this.taskForm.id}`, this.taskForm, this.currentOperator);
          this.$message.success('任务更新成功');
        } else {
          await api.post('/tasks', this.taskForm, this.currentOperator);
          this.$message.success('任务创建成功');
        }
        
        this.taskDialogVisible = false;
        await this.loadStats();
        await this.loadTasks();
      } catch (err) {
        this.$message.error('保存失败: ' + err.message);
      } finally {
        this.savingTask = false;
      }
    },
    
    async startTask(task) {
      try {
        await api.post(`/tasks/${task.id}/start`, { version: task.version }, this.currentOperator);
        this.$message.success('已开始处理');
        await this.loadStats();
        await this.loadTasks();
      } catch (err) {
        this.$message.error('操作失败: ' + err.message);
      }
    },
    
    openCompleteDialog(task) {
      this.completingTaskId = task.id;
      this.completeRemark = '';
      this.completeDialogVisible = true;
    },
    
    async confirmComplete() {
      this.completingTask = true;
      try {
        await api.post(`/tasks/${this.completingTaskId}/complete`, {
          remark: this.completeRemark,
          version: this.selectedTask ? this.selectedTask.version : null
        }, this.currentOperator);
        this.$message.success('任务已完成');
        this.completeDialogVisible = false;
        await this.loadStats();
        await this.loadTasks();
      } catch (err) {
        this.$message.error('操作失败: ' + err.message);
      } finally {
        this.completingTask = false;
      }
    },
    
    async retryTask(task) {
      try {
        await api.post(`/tasks/${task.id}/retry`, { version: task.version }, this.currentOperator);
        this.$message.success('任务已重试');
        await this.loadStats();
        await this.loadTasks();
      } catch (err) {
        this.$message.error('重试失败: ' + err.message);
      }
    },
    
    async cancelTask(task) {
      try {
        const reason = await this.$prompt('请输入取消原因', '取消任务', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          inputPlaceholder: '可选输入取消原因'
        }).catch(() => null);
        
        if (reason !== null) {
          await api.post(`/tasks/${task.id}/cancel`, {
            reason: reason.value || '取消任务',
            version: task.version
          }, this.currentOperator);
          this.$message.success('任务已取消');
          await this.loadStats();
          await this.loadTasks();
        }
      } catch (err) {
        this.$message.error('取消失败: ' + err.message);
      }
    },
    
    exportCSV() {
      let url = '/api/reports/export?';
      const params = [];
      
      if (this.filters.status) params.push('status=' + encodeURIComponent(this.filters.status));
      if (this.filters.assignee) params.push('assignee=' + encodeURIComponent(this.filters.assignee));
      if (this.filters.problem_type) params.push('problem_type=' + encodeURIComponent(this.filters.problem_type));
      if (this.filters.keyword) params.push('keyword=' + encodeURIComponent(this.filters.keyword));
      
      if (this.dateRange && this.dateRange.length === 2) {
        params.push('startTime=' + this.dateRange[0]);
        params.push('endTime=' + this.dateRange[1]);
      }
      
      url += params.join('&');
      window.open(url, '_blank');
    },
    
    onOperatorChange() {
      this.refreshAll();
    },
    
    async refreshAll() {
      await this.loadStats();
      await this.loadTasks();
      if (this.activeTab === 'audit') {
        await this.loadAuditLogs();
      }
    }
  }
});
