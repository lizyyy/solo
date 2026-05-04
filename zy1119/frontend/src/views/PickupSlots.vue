<template>
  <div class="pickup-slots">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>自提时段管理</h2>
      <div>
        <button class="btn btn-outline-secondary me-2" @click="prevDate">
          ← 前一天
        </button>
        <input 
          type="date" 
          class="form-control d-inline-block" 
          style="width: 150px;"
          v-model="selectedDate"
          @change="loadSlots"
        >
        <button class="btn btn-outline-secondary ms-2" @click="nextDate">
          后一天 →
        </button>
        <button class="btn btn-primary ms-3" @click="showCreateModal = true">
          + 新建时段
        </button>
      </div>
    </div>

    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card border-primary">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">总时段</h6>
            <h3 class="text-primary">{{ stats.total || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-success">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">可用</h6>
            <h3 class="text-success">{{ stats.available || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-warning">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">繁忙</h6>
            <h3 class="text-warning">{{ stats.busy || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-danger">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">已满</h6>
            <h3 class="text-danger">{{ stats.full || 0 }}</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="slots.length === 0" class="text-center text-muted py-5">
          该日期暂无自提时段
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>日期</th>
                <th>时段</th>
                <th>容量</th>
                <th>已预约</th>
                <th>剩余</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in slots" :key="slot.id">
                <td>{{ slot.date }}</td>
                <td>
                  <strong>{{ slot.start_time }} - {{ slot.end_time }}</strong>
                </td>
                <td>{{ slot.max_orders }}</td>
                <td>{{ slot.current_orders }}</td>
                <td>
                  <span :class="slot.remaining === 0 ? 'text-danger' : slot.remaining <= 2 ? 'text-warning' : 'text-success'">
                    {{ slot.remaining }}
                  </span>
                </td>
                <td>
                  <span :class="getSlotStatusBadgeClass(slot)">
                    {{ getSlotStatusText(slot) }}
                  </span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" @click="viewOrders(slot)">
                      查看订单 ({{ slot.Orders?.length || 0 }})
                    </button>
                    <button class="btn btn-outline-primary" @click="editSlot(slot)">
                      编辑
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
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditing ? '编辑时段' : '新建时段' }}</h5>
            <button type="button" class="btn-close" @click="resetModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="modalError" class="alert alert-danger">{{ modalError }}</div>
            
            <div class="mb-3">
              <label class="form-label">日期 *</label>
              <input type="date" class="form-control" v-model="slotForm.date" required>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">开始时间 *</label>
                <input type="time" class="form-control" v-model="slotForm.start_time" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">结束时间 *</label>
                <input type="time" class="form-control" v-model="slotForm.end_time" required>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">最大预约数 *</label>
              <input type="number" class="form-control" v-model.number="slotForm.max_orders" min="1" required>
              <small class="text-muted">该时段最多可容纳的订单数量</small>
            </div>

            <div class="mb-3">
              <label class="form-label">时段状态</label>
              <select class="form-select" v-model="slotForm.status">
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label">备注</label>
              <textarea class="form-control" rows="2" v-model="slotForm.note"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="resetModal">取消</button>
            <button type="button" class="btn btn-primary" @click="saveSlot" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showOrdersModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">时段订单列表</h5>
            <button type="button" class="btn-close" @click="showOrdersModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="selectedSlotOrders.length === 0" class="text-center text-muted py-3">
              该时段暂无订单
            </div>
            <div v-else class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>客户姓名</th>
                    <th>商品</th>
                    <th>总金额</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in selectedSlotOrders" :key="order.id">
                    <td>{{ order.order_no }}</td>
                    <td>{{ order.customer_name }}</td>
                    <td>{{ order.OrderItems?.length || 0 }} 件</td>
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
import { pickupSlotApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'PickupSlots',
  data() {
    return {
      selectedDate: dayjs().format('YYYY-MM-DD'),
      slots: [],
      stats: {},
      showCreateModal: false,
      isEditing: false,
      saving: false,
      modalError: '',
      showOrdersModal: false,
      selectedSlotOrders: [],
      slotForm: {
        id: null,
        date: '',
        start_time: '09:00',
        end_time: '10:00',
        max_orders: 5,
        current_orders: 0,
        status: 'active',
        note: ''
      }
    }
  },
  async mounted() {
    await this.loadSlots()
  },
  methods: {
    async loadSlots() {
      try {
        const response = await pickupSlotApi.getByDate(this.selectedDate)
        if (response.data.success) {
          this.slots = response.data.data
          this.calculateStats()
        }
      } catch (error) {
        console.error('加载时段失败:', error)
      }
    },
    calculateStats() {
      this.stats = {
        total: this.slots.length,
        available: this.slots.filter(s => s.status === 'active' && s.remaining > 0).length,
        busy: this.slots.filter(s => s.status === 'active' && s.remaining > 0 && s.remaining <= 2).length,
        full: this.slots.filter(s => s.status === 'active' && s.remaining === 0).length
      }
    },
    prevDate() {
      this.selectedDate = dayjs(this.selectedDate).subtract(1, 'day').format('YYYY-MM-DD')
      this.loadSlots()
    },
    nextDate() {
      this.selectedDate = dayjs(this.selectedDate).add(1, 'day').format('YYYY-MM-DD')
      this.loadSlots()
    },
    getSlotStatusBadgeClass(slot) {
      if (slot.status !== 'active') return 'badge bg-secondary'
      if (slot.remaining === 0) return 'badge bg-danger'
      if (slot.remaining <= 2) return 'badge bg-warning text-dark'
      return 'badge bg-success'
    },
    getSlotStatusText(slot) {
      if (slot.status !== 'active') return '已禁用'
      if (slot.remaining === 0) return '已满'
      if (slot.remaining <= 2) return '繁忙'
      return '可用'
    },
    getStatusBadgeClass(status) {
      const classes = {
        pending: 'badge bg-secondary',
        paid: 'badge bg-info',
        allocated: 'badge bg-primary',
        picked: 'badge bg-success',
        cancelled: 'badge bg-secondary',
        refunded: 'badge bg-warning'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getStatusText(status) {
      const texts = {
        pending: '待支付',
        paid: '已支付',
        allocated: '已分配库存',
        picked: '已自提',
        cancelled: '已取消',
        refunded: '已退款'
      }
      return texts[status] || status
    },
    viewOrders(slot) {
      this.selectedSlotOrders = slot.Orders || []
      this.showOrdersModal = true
    },
    editSlot(slot) {
      this.isEditing = true
      this.slotForm = { ...slot }
      this.showCreateModal = true
    },
    async saveSlot() {
      this.modalError = ''
      this.saving = true

      try {
        if (!this.slotForm.date) {
          this.modalError = '请选择日期'
          return
        }
        if (!this.slotForm.start_time || !this.slotForm.end_time) {
          this.modalError = '请选择开始和结束时间'
          return
        }
        if (!this.slotForm.max_orders || this.slotForm.max_orders < 1) {
          this.modalError = '请输入有效的最大预约数'
          return
        }

        let response
        if (this.isEditing) {
          response = await pickupSlotApi.update(this.slotForm.id, this.slotForm)
        } else {
          response = await pickupSlotApi.create(this.slotForm)
        }

        if (response.data.success) {
          alert(this.isEditing ? '更新成功！' : '创建成功！')
          this.resetModal()
          await this.loadSlots()
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
      this.slotForm = {
        id: null,
        date: this.selectedDate,
        start_time: '09:00',
        end_time: '10:00',
        max_orders: 5,
        current_orders: 0,
        status: 'active',
        note: ''
      }
    }
  }
}
</script>
