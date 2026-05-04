<template>
  <div class="order-detail">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <router-link to="/orders" class="btn btn-sm btn-outline-secondary me-2">
          ← 返回列表
        </router-link>
        <h2 class="d-inline-block align-middle mb-0">订单详情</h2>
      </div>
      <button 
        class="btn btn-success" 
        @click="handlePickup"
        :disabled="order?.status === 'picked'"
        v-if="order"
      >
        自提核销
      </button>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">加载中...</span>
      </div>
    </div>

    <div v-else-if="order">
      <div class="row">
        <div class="col-md-6">
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">订单基本信息</h5>
            </div>
            <div class="card-body">
              <table class="table table-borderless">
                <tbody>
                  <tr>
                    <td class="text-muted" style="width: 120px;">订单号</td>
                    <td><strong>{{ order.order_no }}</strong></td>
                  </tr>
                  <tr>
                    <td class="text-muted">客户姓名</td>
                    <td>{{ order.customer_name }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">联系电话</td>
                    <td>{{ order.customer_phone || '-' }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">地址备注</td>
                    <td>{{ order.customer_address || '-' }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">自提码</td>
                    <td><span class="badge bg-dark fs-6">{{ order.pickup_code || '-' }}</span></td>
                  </tr>
                  <tr>
                    <td class="text-muted">订单状态</td>
                    <td>
                      <span :class="getStatusBadgeClass(order.status)">
                        {{ getStatusText(order.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="text-muted">总金额</td>
                    <td><strong class="text-primary fs-5">¥{{ order.total_amount }}</strong></td>
                  </tr>
                  <tr>
                    <td class="text-muted">自提时间</td>
                    <td>
                      <span v-if="order.pickup_time">{{ order.pickup_time }}</span>
                      <span v-else class="text-muted">未自提</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="text-muted">创建时间</td>
                    <td>{{ order.created_at }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">自提时段</h5>
              <button class="btn btn-sm btn-outline-primary" @click="showSlotModal = true">
                更改时段
              </button>
            </div>
            <div class="card-body" v-if="order.PickupSlot">
              <div class="p-3 bg-light rounded">
                <h6 class="mb-2">{{ order.PickupSlot.date }}</h6>
                <p class="mb-1">
                  <strong>{{ order.PickupSlot.start_time }} - {{ order.PickupSlot.end_time }}</strong>
                </p>
                <p class="mb-0 text-muted">
                  容量: {{ order.PickupSlot.current_orders }}/{{ order.PickupSlot.max_orders }}
                </p>
              </div>
            </div>
            <div class="card-body text-center text-muted" v-else>
              暂未分配自提时段
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">订单备注</h5>
            </div>
            <div class="card-body">
              <p class="mb-0">{{ order.note || '暂无备注' }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <h5 class="mb-0">订单商品</h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>商品名称</th>
                  <th>SKU</th>
                  <th>单价</th>
                  <th>订购数量</th>
                  <th>已分配</th>
                  <th>已自提</th>
                  <th>小计</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in order.OrderItems" :key="item.id">
                  <td>{{ item.Product?.name }}</td>
                  <td>{{ item.Product?.sku }}</td>
                  <td>¥{{ item.unit_price }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>
                    <span :class="item.allocated_quantity < item.quantity ? 'text-warning' : ''">
                      {{ item.allocated_quantity }}
                    </span>
                  </td>
                  <td>{{ item.picked_quantity }}</td>
                  <td>¥{{ (item.unit_price * item.quantity).toFixed(2) }}</td>
                  <td>
                    <span :class="getItemStatusBadgeClass(item.status)">
                      {{ getItemStatusText(item.status) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card mb-4" v-if="order.Exceptions && order.Exceptions.length > 0">
        <div class="card-header bg-warning text-dark">
          <h5 class="mb-0">⚠️ 异常记录</h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>异常类型</th>
                  <th>影响数量</th>
                  <th>描述</th>
                  <th>处理方式</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ex in order.Exceptions" :key="ex.id">
                  <td>
                    <span :class="getExceptionTypeBadgeClass(ex.type)">
                      {{ getExceptionTypeText(ex.type) }}
                    </span>
                  </td>
                  <td>{{ ex.affected_quantity }}</td>
                  <td>{{ ex.description }}</td>
                  <td>{{ getActionText(ex.action) }}</td>
                  <td>
                    <span :class="getExceptionStatusBadgeClass(ex.status)">
                      {{ getExceptionStatusText(ex.status) }}
                    </span>
                  </td>
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

    <div v-if="showSlotModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">选择自提时段</h5>
            <button type="button" class="btn-close" @click="showSlotModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="slotLoading" class="text-center py-3">
              <div class="spinner-border spinner-border-sm" role="status"></div>
            </div>
            <div v-else class="list-group">
              <button 
                v-for="slot in availableSlots" 
                :key="slot.id"
                class="list-group-item list-group-item-action"
                :class="{ active: slot.id === order.pickup_slot_id }"
                :disabled="!slot.available"
                @click="selectSlot(slot)"
              >
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{{ slot.date }} {{ slot.startTime }} - {{ slot.endTime }}</strong>
                    <br>
                    <small class="text-muted">
                      {{ slot.remaining }}/{{ slot.maxOrders }} 个名额
                    </small>
                  </div>
                  <span v-if="slot.is_full" class="badge bg-danger">已满</span>
                  <span v-else-if="slot.is_overloaded" class="badge bg-warning text-dark">繁忙</span>
                  <span v-else class="badge bg-success">可用</span>
                </div>
              </button>
              <p v-if="availableSlots.length === 0" class="text-center text-muted py-3">
                暂无可选时段
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showSlotModal = false">取消</button>
            <button 
              type="button" 
              class="btn btn-primary" 
              @click="updateSlot"
              :disabled="!selectedSlotId"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { orderApi, pickupSlotApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'OrderDetail',
  props: ['id'],
  data() {
    return {
      loading: true,
      order: null,
      showSlotModal: false,
      slotLoading: false,
      availableSlots: [],
      selectedSlotId: null
    }
  },
  async mounted() {
    await this.loadOrder()
  },
  watch: {
    id() {
      this.loadOrder()
    }
  },
  methods: {
    async loadOrder() {
      this.loading = true
      try {
        const response = await orderApi.getById(this.id)
        if (response.data.success) {
          this.order = response.data.data
        }
      } catch (error) {
        console.error('加载订单失败:', error)
      } finally {
        this.loading = false
      }
    },
    async handlePickup() {
      if (!confirm(`确认订单 "${this.order.order_no}" 已自提？`)) {
        return
      }

      try {
        const response = await orderApi.pickup(this.id)
        if (response.data.success) {
          alert('自提核销成功！')
          await this.loadOrder()
        } else {
          alert('核销失败: ' + (response.data.message || '未知错误'))
        }
      } catch (error) {
        console.error('核销失败:', error)
        alert('核销失败: ' + (error.response?.data?.message || '未知错误'))
      }
    },
    async loadAvailableSlots() {
      this.slotLoading = true
      try {
        const today = dayjs().format('YYYY-MM-DD')
        const response = await pickupSlotApi.getAvailable(today)
        if (response.data.success) {
          this.availableSlots = response.data.data
        }
      } catch (error) {
        console.error('加载时段失败:', error)
      } finally {
        this.slotLoading = false
      }
    },
    selectSlot(slot) {
      if (slot.available) {
        this.selectedSlotId = slot.id
      }
    },
    async updateSlot() {
      if (!this.selectedSlotId) return

      try {
        const response = await orderApi.updatePickupSlot(this.id, this.selectedSlotId)
        if (response.data.success) {
          alert('自提时段更新成功！')
          this.showSlotModal = false
          await this.loadOrder()
        } else {
          alert('更新失败: ' + (response.data.message || '未知错误'))
        }
      } catch (error) {
        console.error('更新时段失败:', error)
        alert('更新失败: ' + (error.response?.data?.message || '未知错误'))
      }
    },
    getStatusBadgeClass(status) {
      const classes = {
        pending: 'badge bg-secondary',
        paid: 'badge bg-info',
        allocated: 'badge bg-primary',
        picked: 'badge bg-success',
        cancelled: 'badge bg-secondary',
        refunded: 'badge bg-warning',
        partial_refunded: 'badge bg-warning'
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
        refunded: '已退款',
        partial_refunded: '部分退款'
      }
      return texts[status] || status
    },
    getItemStatusBadgeClass(status) {
      const classes = {
        pending: 'badge bg-secondary',
        allocated: 'badge bg-primary',
        partial_allocated: 'badge bg-warning',
        picked: 'badge bg-success',
        partial_picked: 'badge bg-info',
        refunded: 'badge bg-danger',
        partial_refunded: 'badge bg-warning'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getItemStatusText(status) {
      const texts = {
        pending: '待分配',
        allocated: '已分配',
        partial_allocated: '部分分配',
        picked: '已自提',
        partial_picked: '部分自提',
        refunded: '已退款',
        partial_refunded: '部分退款'
      }
      return texts[status] || status
    },
    getExceptionTypeBadgeClass(type) {
      const classes = {
        shortage: 'badge bg-danger',
        expiry: 'badge bg-warning text-dark',
        quality: 'badge bg-secondary',
        other: 'badge bg-light text-dark'
      }
      return classes[type] || 'badge bg-secondary'
    },
    getExceptionTypeText(type) {
      const texts = {
        shortage: '缺货',
        expiry: '临期/过期',
        quality: '质量问题',
        other: '其他'
      }
      return texts[type] || type
    },
    getExceptionStatusBadgeClass(status) {
      const classes = {
        open: 'badge bg-danger',
        processing: 'badge bg-warning text-dark',
        resolved: 'badge bg-success',
        closed: 'badge bg-secondary'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getExceptionStatusText(status) {
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
