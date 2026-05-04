<template>
  <div class="orders">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>订单管理</h2>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + 新建订单
      </button>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <form class="row g-3">
          <div class="col-md-3">
            <label class="form-label">状态筛选</label>
            <select class="form-select" v-model="filters.status" @change="loadOrders">
              <option value="">全部</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="allocated">已分配库存</option>
              <option value="picked">已自提</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">客户姓名</label>
            <input type="text" class="form-control" v-model="filters.customer_name" @input="debouncedLoadOrders">
          </div>
          <div class="col-md-3">
            <label class="form-label">开始日期</label>
            <input type="date" class="form-control" v-model="filters.date_from" @change="loadOrders">
          </div>
          <div class="col-md-3">
            <label class="form-label">结束日期</label>
            <input type="date" class="form-control" v-model="filters.date_to" @change="loadOrders">
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户姓名</th>
                <th>联系电话</th>
                <th>总金额</th>
                <th>自提时段</th>
                <th>自提码</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td>
                  <router-link :to="`/orders/${order.id}`">
                    {{ order.order_no }}
                  </router-link>
                </td>
                <td>{{ order.customer_name }}</td>
                <td>{{ order.customer_phone || '-' }}</td>
                <td>¥{{ order.total_amount }}</td>
                <td>
                  <span v-if="order.PickupSlot">
                    {{ order.PickupSlot.date }} {{ order.PickupSlot.start_time }}
                  </span>
                  <span v-else class="text-muted">未分配</span>
                </td>
                <td>
                  <span class="badge bg-dark">{{ order.pickup_code || '-' }}</span>
                </td>
                <td>
                  <span :class="getStatusBadgeClass(order.status)">
                    {{ getStatusText(order.status) }}
                  </span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <router-link :to="`/orders/${order.id}`" class="btn btn-outline-primary">
                      详情
                    </router-link>
                    <button 
                      class="btn btn-outline-success" 
                      @click="handlePickup(order)"
                      :disabled="order.status === 'picked'"
                    >
                      自提
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="orders.length === 0">
                <td colspan="8" class="text-center text-muted">暂无订单数据</td>
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
            <h5 class="modal-title">新建订单</h5>
            <button type="button" class="btn-close" @click="resetCreateForm"></button>
          </div>
          <div class="modal-body">
            <div v-if="createError" class="alert alert-danger">{{ createError }}</div>
            
            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">客户姓名 *</label>
                <input type="text" class="form-control" v-model="newOrder.customer_name" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">联系电话</label>
                <input type="text" class="form-control" v-model="newOrder.customer_phone">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">地址备注</label>
                <input type="text" class="form-control" v-model="newOrder.customer_address">
              </div>
              <div class="col-md-6">
                <label class="form-label">自提时段</label>
                <select class="form-select" v-model="newOrder.pickup_slot_id">
                  <option value="">请选择</option>
                  <option v-for="slot in availableSlots" :key="slot.id" :value="slot.id">
                    {{ slot.date }} {{ slot.startTime }}-{{ slot.endTime }} ({{ slot.remaining }}/{{ slot.maxOrders }})
                  </option>
                </select>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">订单商品 *</label>
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>单价</th>
                    <th>数量</th>
                    <th>小计</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in newOrder.items" :key="index">
                    <td style="width: 40%;">
                      <select class="form-select form-select-sm" v-model="item.product_id" @change="updateItemPrice(item)">
                        <option value="">请选择商品</option>
                        <option v-for="product in products" :key="product.id" :value="product.id">
                          {{ product.name }} ({{ product.sku }})
                        </option>
                      </select>
                    </td>
                    <td>¥{{ item.unit_price || 0 }}</td>
                    <td style="width: 15%;">
                      <input type="number" class="form-control form-control-sm" v-model.number="item.quantity" min="1">
                    </td>
                    <td>¥{{ (item.unit_price * item.quantity) || 0 }}</td>
                    <td>
                      <button class="btn btn-sm btn-danger" @click="removeItem(index)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button class="btn btn-sm btn-outline-secondary" @click="addItem">+ 添加商品</button>
            </div>

            <div class="mb-3">
              <label class="form-label">订单备注</label>
              <textarea class="form-control" rows="2" v-model="newOrder.note"></textarea>
            </div>

            <div class="alert alert-info">
              订单总金额: ¥{{ calculateTotalAmount }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="resetCreateForm">取消</button>
            <button type="button" class="btn btn-primary" @click="createOrder" :disabled="creating">
              {{ creating ? '创建中...' : '创建订单' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { orderApi, productApi, pickupSlotApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'Orders',
  data() {
    return {
      orders: [],
      filters: {
        status: '',
        customer_name: '',
        date_from: '',
        date_to: ''
      },
      showCreateModal: false,
      creating: false,
      createError: '',
      products: [],
      availableSlots: [],
      newOrder: {
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        pickup_slot_id: '',
        items: [{ product_id: '', quantity: 1, unit_price: 0 }],
        note: ''
      }
    }
  },
  computed: {
    calculateTotalAmount() {
      return this.newOrder.items.reduce((sum, item) => {
        return sum + (item.unit_price * item.quantity)
      }, 0).toFixed(2)
    }
  },
  async mounted() {
    await this.loadOrders()
    await this.loadProducts()
    await this.loadAvailableSlots()
  },
  methods: {
    async loadOrders() {
      try {
        const params = {}
        if (this.filters.status) params.status = this.filters.status
        if (this.filters.customer_name) params.customer_name = this.filters.customer_name
        if (this.filters.date_from) params.date_from = this.filters.date_from
        if (this.filters.date_to) params.date_to = this.filters.date_to

        const response = await orderApi.getAll(params)
        if (response.data.success) {
          this.orders = response.data.data
        }
      } catch (error) {
        console.error('加载订单失败:', error)
      }
    },
    debouncedLoadOrders: (function() {
      let timeout
      return function() {
        clearTimeout(timeout)
        timeout = setTimeout(() => this.loadOrders(), 300)
      }
    })(),
    async loadProducts() {
      try {
        const response = await productApi.getAll({ is_active: true })
        if (response.data.success) {
          this.products = response.data.data
        }
      } catch (error) {
        console.error('加载商品失败:', error)
      }
    },
    async loadAvailableSlots() {
      try {
        const today = dayjs().format('YYYY-MM-DD')
        const response = await pickupSlotApi.getAvailable(today)
        if (response.data.success) {
          this.availableSlots = response.data.data.filter(s => s.available)
        }
      } catch (error) {
        console.error('加载可用时段失败:', error)
      }
    },
    updateItemPrice(item) {
      const product = this.products.find(p => p.id === parseInt(item.product_id))
      if (product) {
        item.unit_price = parseFloat(product.price)
      }
    },
    addItem() {
      this.newOrder.items.push({ product_id: '', quantity: 1, unit_price: 0 })
    },
    removeItem(index) {
      if (this.newOrder.items.length > 1) {
        this.newOrder.items.splice(index, 1)
      }
    },
    async createOrder() {
      this.createError = ''
      this.creating = true

      try {
        const validItems = this.newOrder.items.filter(item => item.product_id && item.quantity > 0)
        if (validItems.length === 0) {
          this.createError = '请至少选择一个商品'
          return
        }

        if (!this.newOrder.customer_name) {
          this.createError = '请输入客户姓名'
          return
        }

        const orderData = {
          customer_name: this.newOrder.customer_name,
          customer_phone: this.newOrder.customer_phone || null,
          customer_address: this.newOrder.customer_address || null,
          pickup_slot_id: this.newOrder.pickup_slot_id || null,
          items: validItems.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity)
          })),
          note: this.newOrder.note || null
        }

        const response = await orderApi.create(orderData)
        if (response.data.success) {
          alert('订单创建成功！')
          this.resetCreateForm()
          await this.loadOrders()
        } else {
          this.createError = response.data.message || '创建订单失败'
        }
      } catch (error) {
        console.error('创建订单失败:', error)
        this.createError = error.response?.data?.message || '创建订单失败，请重试'
      } finally {
        this.creating = false
      }
    },
    async handlePickup(order) {
      if (!confirm(`确认订单 "${order.order_no}" 已自提？`)) {
        return
      }

      try {
        const response = await orderApi.pickup(order.id)
        if (response.data.success) {
          alert('自提核销成功！')
          await this.loadOrders()
        } else {
          alert('核销失败: ' + (response.data.message || '未知错误'))
        }
      } catch (error) {
        console.error('核销失败:', error)
        alert('核销失败: ' + (error.response?.data?.message || '未知错误'))
      }
    },
    resetCreateForm() {
      this.showCreateModal = false
      this.createError = ''
      this.newOrder = {
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        pickup_slot_id: '',
        items: [{ product_id: '', quantity: 1, unit_price: 0 }],
        note: ''
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
    }
  }
}
</script>
