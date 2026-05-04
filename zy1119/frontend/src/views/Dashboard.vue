<template>
  <div class="dashboard">
    <h2 class="mb-4">仪表盘</h2>
    
    <div class="row mb-4">
      <div class="col-md-3 mb-3">
        <div class="card bg-primary text-white">
          <div class="card-body">
            <h5 class="card-title">订单统计</h5>
            <p class="card-text">
              总订单: {{ stats.orders?.total || 0 }}<br>
              待自提: {{ stats.orders?.pending || 0 }}<br>
              已自提: {{ stats.orders?.picked || 0 }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="col-md-3 mb-3">
        <div class="card bg-warning text-dark">
          <div class="card-body">
            <h5 class="card-title">临期商品</h5>
            <p class="card-text">
              {{ stats.inventory?.expiring || 0 }} 个批次<br>
              7天内过期
            </p>
          </div>
        </div>
      </div>
      
      <div class="col-md-3 mb-3">
        <div class="card bg-danger text-white">
          <div class="card-body">
            <h5 class="card-title">待处理异常</h5>
            <p class="card-text">
              {{ stats.exceptions?.open || 0 }} 个<br>
              需要及时处理
            </p>
          </div>
        </div>
      </div>
      
      <div class="col-md-3 mb-3">
        <div class="card bg-info text-white">
          <div class="card-body">
            <h5 class="card-title">繁忙时段</h5>
            <p class="card-text">
              {{ stats.slots?.overloaded || 0 }} 个时段<br>
              已达容量80%
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-md-6">
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">最近订单</h5>
            <router-link to="/orders" class="btn btn-sm btn-primary">查看全部</router-link>
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>客户</th>
                    <th>金额</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in recentOrders" :key="order.id">
                    <td>
                      <router-link :to="`/orders/${order.id}`">
                        {{ order.order_no }}
                      </router-link>
                    </td>
                    <td>{{ order.customer_name }}</td>
                    <td>¥{{ order.total_amount }}</td>
                    <td>
                      <span :class="getStatusBadgeClass(order.status)">
                        {{ getStatusText(order.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="recentOrders.length === 0">
                    <td colspan="4" class="text-center text-muted">暂无订单数据</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">临期库存预警</h5>
            <router-link to="/inventory?expiring=true" class="btn btn-sm btn-warning">查看全部</router-link>
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>批次</th>
                    <th>可用数量</th>
                    <th>过期时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in expiringInventory" :key="item.id">
                    <td>{{ item.Product?.name }}</td>
                    <td>{{ item.batch_no }}</td>
                    <td>{{ item.available_quantity }}</td>
                    <td>
                      <span class="text-danger">
                        {{ item.expiry_date }} ({{ item.days_until_expiry }}天)
                      </span>
                    </td>
                  </tr>
                  <tr v-if="expiringInventory.length === 0">
                    <td colspan="4" class="text-center text-muted">暂无临期库存</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">今日自提时段</h5>
        <router-link to="/pickup-slots" class="btn btn-sm btn-primary">管理时段</router-link>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-3 mb-3" v-for="slot in todaySlots" :key="slot.id">
            <div :class="getSlotCardClass(slot)">
              <div class="card-body">
                <h6 class="card-title">{{ slot.start_time }} - {{ slot.end_time }}</h6>
                <p class="card-text">
                  订单: {{ slot.current_orders }}/{{ slot.max_orders }}<br>
                  <span :class="getSlotStatusClass(slot)">
                    {{ getSlotStatusText(slot) }}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div class="col-12" v-if="todaySlots.length === 0">
            <p class="text-center text-muted">今日暂无自提时段</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { dashboardApi, orderApi, inventoryApi, pickupSlotApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'Dashboard',
  data() {
    return {
      stats: {},
      recentOrders: [],
      expiringInventory: [],
      todaySlots: []
    }
  },
  async mounted() {
    await this.loadStats()
    await this.loadRecentOrders()
    await this.loadExpiringInventory()
    await this.loadTodaySlots()
  },
  methods: {
    async loadStats() {
      try {
        const response = await dashboardApi.getStats()
        if (response.data.success) {
          this.stats = response.data.data
        }
      } catch (error) {
        console.error('加载统计数据失败:', error)
      }
    },
    async loadRecentOrders() {
      try {
        const response = await orderApi.getAll()
        if (response.data.success) {
          this.recentOrders = response.data.data.slice(0, 5)
        }
      } catch (error) {
        console.error('加载最近订单失败:', error)
      }
    },
    async loadExpiringInventory() {
      try {
        const response = await inventoryApi.getExpiring(7)
        if (response.data.success) {
          this.expiringInventory = response.data.data.slice(0, 5)
        }
      } catch (error) {
        console.error('加载临期库存失败:', error)
      }
    },
    async loadTodaySlots() {
      try {
        const today = dayjs().format('YYYY-MM-DD')
        const response = await pickupSlotApi.getAll({ date: today })
        if (response.data.success) {
          this.todaySlots = response.data.data
        }
      } catch (error) {
        console.error('加载今日时段失败:', error)
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
    getSlotCardClass(slot) {
      if (slot.is_full) return 'card border-danger'
      if (slot.is_overloaded) return 'card border-warning'
      return 'card border-success'
    },
    getSlotStatusClass(slot) {
      if (slot.is_full) return 'text-danger'
      if (slot.is_overloaded) return 'text-warning'
      return 'text-success'
    },
    getSlotStatusText(slot) {
      if (slot.is_full) return '已满'
      if (slot.is_overloaded) return '繁忙'
      return '正常'
    }
  }
}
</script>

<style scoped>
.badge {
  padding: 0.35em 0.65em;
  font-size: 0.75em;
}
</style>
