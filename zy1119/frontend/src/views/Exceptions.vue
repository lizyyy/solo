<template>
  <div class="exceptions">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>异常管理</h2>
    </div>

    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card border-primary">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">总异常</h6>
            <h3 class="text-primary">{{ stats.total || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-danger">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">待处理</h6>
            <h3 class="text-danger">{{ stats.open || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-warning">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">处理中</h6>
            <h3 class="text-warning">{{ stats.processing || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-success">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">已解决</h6>
            <h3 class="text-success">{{ stats.resolved || 0 }}</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <form class="row g-3">
          <div class="col-md-3">
            <label class="form-label">异常类型</label>
            <select class="form-select" v-model="filters.type" @change="loadExceptions">
              <option value="">全部</option>
              <option value="shortage">缺货</option>
              <option value="expiry">临期/过期</option>
              <option value="quality">质量问题</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">状态</label>
            <select class="form-select" v-model="filters.status" @change="loadExceptions">
              <option value="">全部</option>
              <option value="open">待处理</option>
              <option value="processing">处理中</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">处理方式</label>
            <select class="form-select" v-model="filters.action" @change="loadExceptions">
              <option value="">全部</option>
              <option value="pending">待处理</option>
              <option value="transfer">调拨</option>
              <option value="refund">退款</option>
              <option value="exchange">换货</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">&nbsp;</label>
            <button type="button" class="btn btn-outline-primary d-block" @click="loadExceptions">
              刷新数据
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="exceptions.length === 0" class="text-center text-muted py-5">
          暂无异常记录
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>异常编号</th>
                <th>关联订单</th>
                <th>类型</th>
                <th>影响数量</th>
                <th>描述</th>
                <th>处理方式</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ex in exceptions" :key="ex.id">
                <td>{{ ex.exception_no }}</td>
                <td>
                  <router-link v-if="ex.Order" :to="`/orders/${ex.order_id}`">
                    {{ ex.Order.order_no }}
                  </router-link>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span :class="getTypeBadgeClass(ex.type)">
                    {{ getTypeText(ex.type) }}
                  </span>
                </td>
                <td>{{ ex.affected_quantity }}</td>
                <td class="text-truncate" style="max-width: 200px;" :title="ex.description">
                  {{ ex.description }}
                </td>
                <td>{{ getActionText(ex.action) }}</td>
                <td>
                  <span :class="getStatusBadgeClass(ex.status)">
                    {{ getStatusText(ex.status) }}
                  </span>
                </td>
                <td>{{ ex.created_at }}</td>
                <td>
                  <router-link 
                    :to="`/exceptions/${ex.id}`" 
                    class="btn btn-sm btn-outline-primary"
                  >
                    详情
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { exceptionApi } from '../api'

export default {
  name: 'Exceptions',
  data() {
    return {
      exceptions: [],
      stats: {},
      filters: {
        type: '',
        status: '',
        action: ''
      }
    }
  },
  async mounted() {
    await Promise.all([
      this.loadExceptions(),
      this.loadStats()
    ])
  },
  methods: {
    async loadExceptions() {
      try {
        const params = {}
        if (this.filters.type) params.type = this.filters.type
        if (this.filters.status) params.status = this.filters.status
        if (this.filters.action) params.action = this.filters.action

        const response = await exceptionApi.getAll(params)
        if (response.data.success) {
          this.exceptions = response.data.data
        }
      } catch (error) {
        console.error('加载异常失败:', error)
      }
    },
    async loadStats() {
      try {
        const response = await exceptionApi.getStats()
        if (response.data.success) {
          this.stats = response.data.data
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },
    getTypeBadgeClass(type) {
      const classes = {
        shortage: 'badge bg-danger',
        expiry: 'badge bg-warning text-dark',
        quality: 'badge bg-secondary',
        other: 'badge bg-light text-dark'
      }
      return classes[type] || 'badge bg-secondary'
    },
    getTypeText(type) {
      const texts = {
        shortage: '缺货',
        expiry: '临期/过期',
        quality: '质量问题',
        other: '其他'
      }
      return texts[type] || type
    },
    getStatusBadgeClass(status) {
      const classes = {
        open: 'badge bg-danger',
        processing: 'badge bg-warning text-dark',
        resolved: 'badge bg-success',
        closed: 'badge bg-secondary'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getStatusText(status) {
      const texts = {
        open: '待处理',
        processing: '处理中',
        resolved: '已解决',
        closed: '已关闭'
      }
      return texts[status] || status
    },
    getActionText(action) {
      const texts = {
        pending: '待处理',
        transfer: '调拨',
        refund: '退款',
        exchange: '换货',
        resolved: '已解决'
      }
      return texts[action] || action
    }
  }
}
</script>
