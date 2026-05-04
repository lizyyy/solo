<template>
  <div class="inventory">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>库存管理</h2>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + 录入到货批次
      </button>
    </div>

    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card border-primary">
          <div class="card-body">
            <h6 class="text-muted mb-1">总库存</h6>
            <h3 class="text-primary">{{ totalStats.total_quantity || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-danger">
          <div class="card-body">
            <h6 class="text-muted mb-1">临期商品</h6>
            <h3 class="text-danger">{{ totalStats.expiry_quantity || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-success">
          <div class="card-body">
            <h6 class="text-muted mb-1">可用库存</h6>
            <h3 class="text-success">{{ totalStats.available_quantity || 0 }}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card border-secondary">
          <div class="card-body">
            <h6 class="text-muted mb-1">已分配</h6>
            <h3 class="text-secondary">{{ totalStats.allocated_quantity || 0 }}</h3>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <form class="row g-3">
          <div class="col-md-3">
            <label class="form-label">商品名称</label>
            <input type="text" class="form-control" v-model="filters.product_name" @input="debouncedLoad">
          </div>
          <div class="col-md-3">
            <label class="form-label">状态</label>
            <select class="form-select" v-model="filters.status" @change="loadInventory">
              <option value="">全部</option>
              <option value="active">正常</option>
              <option value="expired">已过期</option>
              <option value="expiring_soon">即将过期</option>
              <option value="depleted">已耗尽</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">冰柜</label>
            <select class="form-select" v-model="filters.freezer_id" @change="loadInventory">
              <option value="">全部</option>
              <option v-for="freezer in freezers" :key="freezer.id" :value="freezer.id">
                {{ freezer.name }}
              </option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">&nbsp;</label>
            <button type="button" class="btn btn-outline-primary d-block" @click="loadInventory">
              刷新数据
            </button>
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
                <th>批次号</th>
                <th>商品名称</th>
                <th>SKU</th>
                <th>生产日期</th>
                <th>过期日期</th>
                <th>剩余天数</th>
                <th>数量</th>
                <th>已分配</th>
                <th>所在冰柜</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in inventory" :key="item.id">
                <td>{{ item.batch_no }}</td>
                <td>{{ item.Product?.name }}</td>
                <td>{{ item.Product?.sku }}</td>
                <td>{{ item.production_date }}</td>
                <td>{{ item.expiry_date }}</td>
                <td>
                  <span :class="getExpiryDaysClass(item.expiry_days)">
                    {{ item.expiry_days }}天
                  </span>
                </td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.allocated_quantity }}</td>
                <td>{{ item.Freezer?.name || '-' }}</td>
                <td>
                  <span :class="getStatusBadgeClass(item.status)">
                    {{ getStatusText(item.status) }}
                  </span>
                </td>
              </tr>
              <tr v-if="inventory.length === 0">
                <td colspan="10" class="text-center text-muted">暂无库存数据</td>
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
            <h5 class="modal-title">录入到货批次</h5>
            <button type="button" class="btn-close" @click="resetCreateForm"></button>
          </div>
          <div class="modal-body">
            <div v-if="createError" class="alert alert-danger">{{ createError }}</div>
            
            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">商品 *</label>
                <select class="form-select" v-model="newInventory.product_id" required>
                  <option value="">请选择商品</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.name }} ({{ product.sku }})
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">批次号 *</label>
                <input type="text" class="form-control" v-model="newInventory.batch_no" required placeholder="如: BATCH-20240101-001">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">生产日期</label>
                <input type="date" class="form-control" v-model="newInventory.production_date">
              </div>
              <div class="col-md-6">
                <label class="form-label">过期日期</label>
                <input type="date" class="form-control" v-model="newInventory.expiry_date">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">入库数量 *</label>
                <input type="number" class="form-control" v-model.number="newInventory.quantity" min="1" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">存放冰柜</label>
                <select class="form-select" v-model="newInventory.freezer_id">
                  <option value="">自动分配</option>
                  <option v-for="freezer in availableFreezers" :key="freezer.id" :value="freezer.id">
                    {{ freezer.name }} (剩余: {{ freezer.available_capacity }})
                  </option>
                </select>
                <small class="text-muted">选择冰柜将检查容量，自动分配则寻找可用冰柜</small>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">备注</label>
              <textarea class="form-control" rows="2" v-model="newInventory.note"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="resetCreateForm">取消</button>
            <button type="button" class="btn btn-primary" @click="createInventory" :disabled="creating">
              {{ creating ? '录入中...' : '确认录入' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { inventoryApi, productApi, freezerApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'Inventory',
  data() {
    return {
      inventory: [],
      freezers: [],
      products: [],
      totalStats: {},
      filters: {
        product_name: '',
        status: '',
        freezer_id: ''
      },
      showCreateModal: false,
      creating: false,
      createError: '',
      newInventory: {
        product_id: '',
        batch_no: '',
        production_date: '',
        expiry_date: '',
        quantity: 1,
        freezer_id: '',
        note: ''
      }
    }
  },
  computed: {
    availableFreezers() {
      return this.freezers.filter(f => f.available_capacity > 0)
    }
  },
  async mounted() {
    await Promise.all([
      this.loadInventory(),
      this.loadFreezers(),
      this.loadProducts(),
      this.loadStats()
    ])
  },
  methods: {
    async loadInventory() {
      try {
        const params = {}
        if (this.filters.status) params.status = this.filters.status
        if (this.filters.freezer_id) params.freezer_id = this.filters.freezer_id

        const response = await inventoryApi.getAll(params)
        if (response.data.success) {
          this.inventory = response.data.data.map(item => ({
            ...item,
            expiry_days: item.expiry_date ? dayjs(item.expiry_date).diff(dayjs(), 'day') : null
          }))
        }
      } catch (error) {
        console.error('加载库存失败:', error)
      }
    },
    debouncedLoad: (function() {
      let timeout
      return function() {
        clearTimeout(timeout)
        timeout = setTimeout(() => this.loadInventory(), 300)
      }
    })(),
    async loadFreezers() {
      try {
        const response = await freezerApi.getAll()
        if (response.data.success) {
          this.freezers = response.data.data
        }
      } catch (error) {
        console.error('加载冰柜失败:', error)
      }
    },
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
    async loadStats() {
      try {
        const response = await inventoryApi.getStats()
        if (response.data.success) {
          this.totalStats = response.data.data
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },
    async createInventory() {
      this.createError = ''
      this.creating = true

      try {
        if (!this.newInventory.product_id) {
          this.createError = '请选择商品'
          return
        }
        if (!this.newInventory.batch_no) {
          this.createError = '请输入批次号'
          return
        }
        if (!this.newInventory.quantity || this.newInventory.quantity < 1) {
          this.createError = '请输入有效的入库数量'
          return
        }

        const data = {
          product_id: parseInt(this.newInventory.product_id),
          batch_no: this.newInventory.batch_no,
          production_date: this.newInventory.production_date || null,
          expiry_date: this.newInventory.expiry_date || null,
          quantity: parseInt(this.newInventory.quantity),
          freezer_id: this.newInventory.freezer_id ? parseInt(this.newInventory.freezer_id) : null,
          note: this.newInventory.note || null
        }

        const response = await inventoryApi.create(data)
        if (response.data.success) {
          alert('入库成功！')
          this.resetCreateForm()
          await Promise.all([
            this.loadInventory(),
            this.loadStats(),
            this.loadFreezers()
          ])
        } else {
          this.createError = response.data.message || '入库失败'
        }
      } catch (error) {
        console.error('入库失败:', error)
        this.createError = error.response?.data?.message || '入库失败，请重试'
      } finally {
        this.creating = false
      }
    },
    resetCreateForm() {
      this.showCreateModal = false
      this.createError = ''
      this.newInventory = {
        product_id: '',
        batch_no: '',
        production_date: '',
        expiry_date: '',
        quantity: 1,
        freezer_id: '',
        note: ''
      }
    },
    getExpiryDaysClass(days) {
      if (days === null || days === undefined) return ''
      if (days <= 0) return 'text-danger fw-bold'
      if (days <= 3) return 'text-danger'
      if (days <= 7) return 'text-warning'
      return 'text-success'
    },
    getStatusBadgeClass(status) {
      const classes = {
        active: 'badge bg-success',
        expiring_soon: 'badge bg-warning text-dark',
        expired: 'badge bg-danger',
        depleted: 'badge bg-secondary'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getStatusText(status) {
      const texts = {
        active: '正常',
        expiring_soon: '即将过期',
        expired: '已过期',
        depleted: '已耗尽'
      }
      return texts[status] || status
    }
  }
}
</script>
