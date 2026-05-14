<template>
  <div class="dashboard">
    <el-card shadow="hover">
      <div slot="header" class="clearfix">
        <span style="font-size: 18px; font-weight: bold;">压测计划列表</span>
        <el-button style="float: right; padding: 3px 0" type="primary" @click="showCreateDialog">
          <i class="el-icon-plus"></i> 新建压测计划
        </el-button>
      </div>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="版本">
          <el-input v-model="filters.version" placeholder="请输入版本" clearable @keyup.enter.native="fetchPlans"></el-input>
        </el-form-item>
        <el-form-item label="API名称">
          <el-input v-model="filters.api_name" placeholder="请输入API名称" clearable @keyup.enter.native="fetchPlans"></el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable @change="fetchPlans">
            <el-option label="成功" value="success"></el-option>
            <el-option label="待复核" value="pending_review"></el-option>
            <el-option label="已拦截" value="intercepted"></el-option>
            <el-option label="可重试" value="retryable"></el-option>
            <el-option label="已审批" value="approved"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="filters.created_by" placeholder="请输入创建人" clearable @keyup.enter.native="fetchPlans"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchPlans">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="name" label="计划名称" min-width="150"></el-table-column>
        <el-table-column prop="version" label="版本" width="120"></el-table-column>
        <el-table-column prop="api_name" label="API名称" min-width="150"></el-table-column>
        <el-table-column prop="method" label="请求方法" width="100">
          <template slot-scope="scope">
            <el-tag :type="getMethodTagType(scope.row.method)" size="small">{{ scope.row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template slot-scope="scope">
            <el-tag :type="getStatusTagType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by" label="创建人" width="100"></el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template slot-scope="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="350" fixed="right">
          <template slot-scope="scope">
            <el-button size="mini" type="primary" @click="viewDetail(scope.row.id)">查看</el-button>
            <el-button size="mini" type="success" @click="approvePlan(scope.row.id)" :disabled="scope.row.status === 'approved'">审批</el-button>
            <el-button size="mini" type="warning" @click="rollbackPlan(scope.row.id)" :disabled="scope.row.status === 'draft'">回滚</el-button>
            <el-button size="mini" type="info" @click="retryPlan(scope.row.id)">重试</el-button>
            <el-button size="mini" @click="exportPlan(scope.row.id)">导出</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="pagination.page"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pagination.limit"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.total">
      </el-pagination>
    </el-card>

    <el-dialog title="新建压测计划" :visible.sync="createDialogVisible" width="700px">
      <el-form :model="planForm" label-width="100px">
        <el-form-item label="计划名称">
          <el-input v-model="planForm.name"></el-input>
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="planForm.version"></el-input>
        </el-form-item>
        <el-form-item label="API名称">
          <el-input v-model="planForm.api_name"></el-input>
        </el-form-item>
        <el-form-item label="API地址">
          <el-input v-model="planForm.api_url"></el-input>
        </el-form-item>
        <el-form-item label="请求方法">
          <el-select v-model="planForm.method">
            <el-option label="GET" value="GET"></el-option>
            <el-option label="POST" value="POST"></el-option>
            <el-option label="PUT" value="PUT"></el-option>
            <el-option label="DELETE" value="DELETE"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="planForm.created_by"></el-input>
        </el-form-item>
        <el-form-item label="并发阶梯">
          <el-button type="text" @click="addConcurrencyStep">添加阶梯</el-button>
          <div v-for="(step, index) in planForm.concurrency_steps" :key="index" class="step-item">
            <el-input v-model="step.step_order" placeholder="顺序" style="width: 80px;"></el-input>
            <el-input v-model="step.concurrent_users" placeholder="并发数" style="width: 100px;"></el-input>
            <el-input v-model="step.duration_seconds" placeholder="持续时间(秒)" style="width: 120px;"></el-input>
            <el-input v-model="step.ramp_up_seconds" placeholder="爬升时间(秒)" style="width: 120px;"></el-input>
            <el-button type="danger" icon="el-icon-delete" circle @click="removeConcurrencyStep(index)"></el-button>
          </div>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPlan">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'Dashboard',
  data() {
    return {
      loading: false,
      filters: {
        version: '',
        api_name: '',
        status: '',
        created_by: ''
      },
      pagination: {
        page: 1,
        limit: 10,
        total: 0
      },
      tableData: [],
      createDialogVisible: false,
      planForm: {
        name: '',
        version: '',
        api_name: '',
        api_url: '',
        method: 'GET',
        created_by: '',
        concurrency_steps: []
      }
    }
  },
  mounted() {
    this.fetchPlans()
  },
  methods: {
    async fetchPlans() {
      this.loading = true
      try {
        const params = {
          skip: (this.pagination.page - 1) * this.pagination.limit,
          limit: this.pagination.limit,
          ...this.filters
        }
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null) {
            delete params[key]
          }
        })
        const response = await this.$http.get('/plans', { params })
        if (response.data.code === 200) {
          this.tableData = response.data.data.items
          this.pagination.total = response.data.data.total
        }
      } catch (error) {
        this.$message.error('获取数据失败')
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = {
        version: '',
        api_name: '',
        status: '',
        created_by: ''
      }
      this.pagination.page = 1
      this.fetchPlans()
    },
    handleSizeChange(val) {
      this.pagination.limit = val
      this.fetchPlans()
    },
    handleCurrentChange(val) {
      this.pagination.page = val
      this.fetchPlans()
    },
    showCreateDialog() {
      this.planForm = {
        name: '',
        version: '',
        api_name: '',
        api_url: '',
        method: 'GET',
        created_by: '',
        concurrency_steps: []
      }
      this.createDialogVisible = true
    },
    addConcurrencyStep() {
      this.planForm.concurrency_steps.push({
        step_order: this.planForm.concurrency_steps.length + 1,
        concurrent_users: 10,
        duration_seconds: 60,
        ramp_up_seconds: 10
      })
    },
    removeConcurrencyStep(index) {
      this.planForm.concurrency_steps.splice(index, 1)
    },
    async submitPlan() {
      try {
        const response = await this.$http.post('/plans', this.planForm)
        if (response.data.code === 200) {
          this.$message.success('创建成功')
          this.createDialogVisible = false
          this.fetchPlans()
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        this.$message.error('创建失败')
      }
    },
    viewDetail(id) {
      this.$router.push(`/plan/${id}`)
    },
    async approvePlan(id) {
      try {
        const { value: approvedBy } = await this.$prompt('请输入审批人', '审批', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          inputPattern: /.+/,
          inputErrorMessage: '审批人不能为空'
        })
        const response = await this.$http.post(`/plans/${id}/approve`, null, {
          params: { approved_by: approvedBy }
        })
        if (response.data.code === 200) {
          this.$message.success('审批成功')
          this.fetchPlans()
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        if (error !== 'cancel') {
          this.$message.error('操作失败')
        }
      }
    },
    async rollbackPlan(id) {
      try {
        const { value: remark } = await this.$prompt('请输入回滚原因(可选)', '回滚', {
          confirmButtonText: '确定',
          cancelButtonText: '取消'
        })
        const response = await this.$http.post(`/plans/${id}/rollback`, null, {
          params: { remark }
        })
        if (response.data.code === 200) {
          this.$message.success('回滚成功')
          this.fetchPlans()
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        if (error !== 'cancel') {
          this.$message.error('操作失败')
        }
      }
    },
    async retryPlan(id) {
      try {
        this.$confirm('确定要创建该计划的重试版本吗?', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(async () => {
          const response = await this.$http.post(`/plans/${id}/retry`)
          if (response.data.code === 200) {
            this.$message.success('重试计划创建成功')
            this.fetchPlans()
          } else {
            this.$message.error(response.data.message)
          }
        })
      } catch (error) {
        this.$message.error('操作失败')
      }
    },
    async exportPlan(id) {
      try {
        const response = await this.$http.get(`/plans/${id}/export`)
        if (response.data.code === 200) {
          const dataStr = JSON.stringify(response.data.data, null, 2)
          const blob = new Blob([dataStr], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `plan_${id}_export.json`
          link.click()
          URL.revokeObjectURL(url)
          this.$message.success('导出成功')
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        this.$message.error('导出失败')
      }
    },
    getMethodTagType(method) {
      const map = { 'GET': 'success', 'POST': 'primary', 'PUT': 'warning', 'DELETE': 'danger' }
      return map[method] || ''
    },
    getStatusTagType(status) {
      const map = {
        'success': 'success',
        'pending_review': 'warning',
        'intercepted': 'danger',
        'retryable': 'info',
        'approved': 'primary',
        'draft': 'info',
        'rejected': 'danger'
      }
      return map[status] || ''
    },
    getStatusText(status) {
      const map = {
        'success': '成功',
        'pending_review': '待复核',
        'intercepted': '已拦截',
        'retryable': '可重试',
        'approved': '已审批',
        'draft': '草稿',
        'rejected': '已拒绝'
      }
      return map[status] || status
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', { hour12: false })
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 0;
}
.filter-form {
  margin-bottom: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}
.step-item {
  display: flex;
  gap: 10px;
  margin: 10px 0;
  align-items: center;
}
.el-pagination {
  margin-top: 20px;
  text-align: right;
}
</style>