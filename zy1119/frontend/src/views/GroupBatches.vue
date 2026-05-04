<template>
  <div class="group-batches">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>团购批次管理</h2>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + 新建批次
      </button>
    </div>

    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card border-primary">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">总批次</h6>
            <h3 class="text-primary">{{ stats.total || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-info">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">进行中</h6>
            <h3 class="text-info">{{ stats.active || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-success">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">已完成</h6>
            <h3 class="text-success">{{ stats.completed || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-secondary">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">已取消</h6>
            <h3 class="text-secondary">{{ stats.cancelled || 0 }}</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <form class="row g-3">
          <div class="col-md-4">
            <label class="form-label">批次名称</label>
            <input type="text" class="form-control" v-model="filters.name" @input="debouncedLoad">
          </div>
          <div class="col-md-4">
            <label class="form-label">状态</label>
            <select class="form-select" v-model="filters.status" @change="loadBatches">
              <option value="">全部</option>
              <option value="draft">草稿</option>
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">&nbsp;</label>
            <button type="button" class="btn btn-outline-primary d-block" @click="loadBatches">
              刷新数据
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="batches.length === 0" class="text-center text-muted py-5">
          暂无团购批次数据
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>批次号</th>
                <th>批次名称</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>预计到货</th>
                <th>订单数</th>
                <th>销售额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="batch in batches" :key="batch.id">
                <td><strong>{{ batch.batch_no }}</strong></td>
                <td>{{ batch.name }}</td>
                <td>{{ batch.start_time || '-' }}</td>
                <td>{{ batch.end_time || '-' }}</td>
                <td>{{ batch.expected_arrival || '-' }}</td>
                <td>{{ batch.order_count || 0 }}</td>
                <td class="text-primary fw-bold">
                  ¥{{ (batch.total_amount || 0).toFixed(2) }}
                </td>
                <td>
                  <span :class="getStatusBadgeClass(batch.status)">
                    {{ getStatusText(batch.status) }}
                  </span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" @click="viewOrders(batch)">
                      订单
                    </button>
                    <button class="btn btn-outline-secondary" @click="editBatch(batch)">
                      编辑
                    </button>
                    <button 
                      v-if="batch.status === 'draft' || batch.status === 'active'"
                      class="btn" 
                      :class="batch.status === 'draft' ? 'btn-outline-success' : 'btn-outline-warning'"
                      @click="changeStatus(batch)"
                    >
                      {{ batch.status === 'draft' ? '启动' : '完成' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditing ? '编辑批次' : '新建批次' }}</h5>
            <button type="button" class="btn-close" @click="resetModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="modalError" class="alert alert-danger">{{ modalError }}</div>
            
            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">批次名称 *</label>
                <input type="text" class="form-control" v-model="batchForm.name" required placeholder="如: 周末特惠团购">
              </div>
              <div class="col-md-6">
                <label class="form-label">批次号</label>
                <input type="text" class="form-control" v-model="batchForm.batch_no" placeholder="留空自动生成">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">开始时间</label>
                <input type="datetime-local" class="form-control" v-model="batchForm.start_time">
              </div>
              <div class="col-md-6">
                <label class="form-label">结束时间</label>
                <input type="datetime-local" class="form-control" v-model="batchForm.end_time">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">预计到货日期</label>
                <input type="date" class="form-control" v-model="batchForm.expected_arrival">
              </div>
              <div class="col-md-6">
                <label class="form-label">状态</label>
                <select class="form-select" v-model="batchForm.status">
                  <option value="draft">草稿</option>
                  <option value="active">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">批次描述</label>
              <textarea class="form-control" rows="3" v-model="batchForm.description" placeholder="描述本批次团购的商品和活动详情"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="resetModal">取消</button>
            <button type="button" class="btn btn-primary" @click="saveBatch" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showOrdersModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ currentBatch?.name }} - 订单列表</h5>
            <button type="button" class="btn-close" @click="showOrdersModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="currentBatchOrders.length === 0" class="text-center text-muted py-3">
              该批次暂无订单
            </div>
            <div v-else class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>客户姓名</th>
                    <th>联系电话</th>
                    <th>自提时段</th>
                    <th>商品数</th>
                    <th>总金额</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in currentBatchOrders" :key="order.id">
                    <td>
                      <router-link :to="`/orders/${order.id}`" target="_blank">
                        {{ order.order_no }}
                      </router-link>
                    </td>
                    <td>{{ order.customer_name }}</td>
                    <td>{{ order.customer_phone || '-' }}</td>
                    <td>
                      <span v-if="order.PickupSlot">
                        {{ order.PickupSlot.date }} {{ order.PickupSlot.start_time }}
                      </span>
                      <span v-else class="text-muted">-</span>
                    </td>
                    <td>{{ order.OrderItems?.length || 0 }}</td>
                    <td>¥{{ order.total_amount }}</td>
                    <td>
                      <span :class="getStatusBadgeClass(order.status)">
                        {{ getStatusText(order.status) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showOrdersModal = false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { groupBatchApi, orderApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'GroupBatches',
  data() {
    return {
      batches: [],
      stats: {},
      filters: {
        name: '',
        status: ''
      },
      showCreateModal: false,
      isEditing: false,
      saving: false,
      modalError: '',
      showOrdersModal: false,
      currentBatch: null,
      currentBatchOrders: [],
      batchForm: {
        id: null,
        batch_no: '',
        name: '',
        start_time: '',
        end_time: '',
        expected_arrival: '',
        description: '',
        status: 'draft',
        total_amount: 0,
        order_count: 0
      }
    }
  },
  async mounted() {
    await this.loadBatches()
  },
  methods: {
    async loadBatches() {
      try {
        const params = {}
        if (this.filters.status) params.status = this.filters.status

        const response = await groupBatchApi.getAll(params)
        if (response.data.success) {
          let batches = response.data.data
          
          if (this.filters.name) {
            const keyword = this.filters.name.toLowerCase()
            batches = batches.filter(b => 
              b.name.toLowerCase().includes(keyword) ||
              (b.batch_no && b.batch_no.toLowerCase().includes(keyword))
            )
          }
          
          this.batches = batches
          this.calculateStats(batches)
        }
      } catch (error) {
        console.error('加载批次失败:', error)
      }
    },
    calculateStats(batches) {
      this.stats = {
        total: batches.length,
        active: batches.filter(b => b.status === 'active').length,
        completed: batches.filter(b => b.status === 'completed').length,
        cancelled: batches.filter(b => b.status === 'cancelled').length,
        draft: batches.filter(b => b.status === 'draft').length
      }
    },
    debouncedLoad: (function() {
      let timeout
      return function() {
        clearTimeout(timeout)
        timeout = setTimeout(() => this.loadBatches(), 300)
      }
    })(),
    editBatch(batch) {
      this.isEditing = true
      this.batchForm = { ...batch }
      this.showCreateModal = true
    },
    viewOrders(batch) {
      this.currentBatch = batch
      this.currentBatchOrders = batch.Orders || []
      this.showOrdersModal = true
    },
    async changeStatus(batch) {
      let newStatus
      let action
      
      if (batch.status === 'draft') {
        newStatus = 'active'
        action = '启动'
      } else if (batch.status === 'active') {
        newStatus = 'completed'
        action = '完成'
      } else {
        return
      }

      if (!confirm(`确认${action}批次 "${batch.name}"？`)) {
        return
      }

      try {
        const response = await groupBatchApi.updateStatus(batch.id, newStatus)
        if (response.data.success) {
          alert(`${action}成功！`)
          await this.loadBatches()
        } else {
          alert(`${action}失败: ` + (response.data.message || '未知错误'))
        }
      } catch (error) {
        console.error('更新状态失败:', error)
        alert(`${action}失败: ` + (error.response?.data?.message || '未知错误'))
      }
    },
    async saveBatch() {
      this.modalError = ''
      this.saving = true

      try {
        if (!this.batchForm.name) {
          this.modalError = '批次名称为必填项'
          return
        }

        let response
        if (this.isEditing) {
          response = await groupBatchApi.update(this.batchForm.id, this.batchForm)
        } else {
          response = await groupBatchApi.create(this.batchForm)
        }

        if (response.data.success) {
          alert(this.isEditing ? '更新成功！' : '创建成功！')
          this.resetModal()
          await this.loadBatches()
        } else {
          this.modalError = response.data.message || '保存失败'
        }
      } catch (error) {
        console.error('保存失败:', error)
        this.modalError = error.response?.data?.message || '保存失败，请重试'
      } finally {
        this.saving = false
      }
    },
    resetModal() {
      this.showCreateModal = false
      this.isEditing = false
      this.modalError = ''
      this.batchForm = {
        id: null,
        batch_no: '',
        name: '',
        start_time: '',
        end_time: '',
        expected_arrival: '',
        description: '',
        status: 'draft',
        total_amount: 0,
        order_count: 0
      }
    },
    getStatusBadgeClass(status) {
      const classes = {
        draft: 'badge bg-secondary',
        active: 'badge bg-primary',
        completed: 'badge bg-success',
        cancelled: 'badge bg-danger',
        pending: 'badge bg-secondary',
        paid: 'badge bg-info',
        allocated: 'badge bg-primary',
        picked: 'badge bg-success',
        refunded: 'badge bg-warning'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getStatusText(status) {
      const texts = {
        draft: '草稿',
        active: '进行中',
        completed: '已完成',
        cancelled: '已取消',
        pending: '待支付',
        paid: '已支付',
        allocated: '已分配',
        picked: '已自提',
        refunded: '已退款'
      }
      return texts[status] || status
    }
  }
}
</script>
