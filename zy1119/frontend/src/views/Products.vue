<template>
  <div class="products">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>商品管理</h2>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + 添加商品
      </button>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <form class="row g-3">
          <div class="col-md-4">
            <label class="form-label">商品名称/SKU</label>
            <input type="text" class="form-control" v-model="filters.keyword" @input="debouncedLoad">
          </div>
          <div class="col-md-4">
            <label class="form-label">分类</label>
            <select class="form-select" v-model="filters.category" @change="loadProducts">
              <option value="">全部</option>
              <option value="dairy">乳制品</option>
              <option value="meat">肉类</option>
              <option value="frozen">冷冻食品</option>
              <option value="fresh">生鲜果蔬</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">状态</label>
            <select class="form-select" v-model="filters.status" @change="loadProducts">
              <option value="">全部</option>
              <option value="active">在售</option>
              <option value="inactive">下架</option>
            </select>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="products.length === 0" class="text-center text-muted py-5">
          暂无商品数据
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>SKU</th>
                <th>商品名称</th>
                <th>分类</th>
                <th>单位</th>
                <th>单价</th>
                <th>存储温度</th>
                <th>保质期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in products" :key="product.id">
                <td><strong>{{ product.sku }}</strong></td>
                <td>{{ product.name }}</td>
                <td>
                  <span :class="getCategoryBadgeClass(product.category)">
                    {{ getCategoryText(product.category) }}
                  </span>
                </td>
                <td>{{ product.unit }}</td>
                <td class="text-primary fw-bold">¥{{ product.price }}</td>
                <td>{{ product.storage_temp_min }}~{{ product.storage_temp_max }}°C</td>
                <td>{{ product.expiry_days }}天</td>
                <td>
                  <span :class="product.is_active ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ product.is_active ? '在售' : '下架' }}
                  </span>
                </td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" @click="editProduct(product)">
                      编辑
                    </button>
                    <button 
                      class="btn" 
                      :class="product.is_active ? 'btn-outline-danger' : 'btn-outline-success'"
                      @click="toggleStatus(product)"
                    >
                      {{ product.is_active ? '下架' : '上架' }}
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
            <h5 class="modal-title">{{ isEditing ? '编辑商品' : '添加商品' }}</h5>
            <button type="button" class="btn-close" @click="resetModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="modalError" class="alert alert-danger">{{ modalError }}</div>
            
            <div class="row mb-3">
              <div class="col-md-6">
                <label class="form-label">商品名称 *</label>
                <input type="text" class="form-control" v-model="productForm.name" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">SKU *</label>
                <input type="text" class="form-control" v-model="productForm.sku" required placeholder="如: YOGURT-001">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-4">
                <label class="form-label">分类</label>
                <select class="form-select" v-model="productForm.category">
                  <option value="dairy">乳制品</option>
                  <option value="meat">肉类</option>
                  <option value="frozen">冷冻食品</option>
                  <option value="fresh">生鲜果蔬</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">单位</label>
                <input type="text" class="form-control" v-model="productForm.unit" placeholder="如: 盒、份、斤">
              </div>
              <div class="col-md-4">
                <label class="form-label">单价(元) *</label>
                <input type="number" class="form-control" v-model.number="productForm.price" min="0" step="0.01" required>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-4">
                <label class="form-label">最低存储温度(°C)</label>
                <input type="number" class="form-control" v-model.number="productForm.storage_temp_min">
              </div>
              <div class="col-md-4">
                <label class="form-label">最高存储温度(°C)</label>
                <input type="number" class="form-control" v-model.number="productForm.storage_temp_max">
              </div>
              <div class="col-md-4">
                <label class="form-label">保质期(天)</label>
                <input type="number" class="form-control" v-model.number="productForm.expiry_days" min="1">
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">商品描述</label>
              <textarea class="form-control" rows="2" v-model="productForm.description"></textarea>
            </div>

            <div class="mb-3 form-check">
              <input type="checkbox" class="form-check-input" id="is_active" v-model="productForm.is_active">
              <label class="form-check-label" for="is_active">
                立即上架
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="resetModal">取消</button>
            <button type="button" class="btn btn-primary" @click="saveProduct" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { productApi } from '../api'

export default {
  name: 'Products',
  data() {
    return {
      products: [],
      filters: {
        keyword: '',
        category: '',
        status: ''
      },
      showCreateModal: false,
      isEditing: false,
      saving: false,
      modalError: '',
      productForm: {
        id: null,
        name: '',
        sku: '',
        category: 'other',
        unit: '件',
        price: 0,
        storage_temp_min: -18,
        storage_temp_max: 4,
        expiry_days: 30,
        description: '',
        is_active: true
      }
    }
  },
  async mounted() {
    await this.loadProducts()
  },
  methods: {
    async loadProducts() {
      try {
        const params = {}
        if (this.filters.category) params.category = this.filters.category
        if (this.filters.status !== '') {
          params.is_active = this.filters.status === 'active'
        }

        const response = await productApi.getAll(params)
        if (response.data.success) {
          let products = response.data.data
          
          if (this.filters.keyword) {
            const keyword = this.filters.keyword.toLowerCase()
            products = products.filter(p => 
              p.name.toLowerCase().includes(keyword) ||
              p.sku.toLowerCase().includes(keyword)
            )
          }
          
          this.products = products
        }
      } catch (error) {
        console.error('加载商品失败:', error)
      }
    },
    debouncedLoad: (function() {
      let timeout
      return function() {
        clearTimeout(timeout)
        timeout = setTimeout(() => this.loadProducts(), 300)
      }
    })(),
    editProduct(product) {
      this.isEditing = true
      this.productForm = { ...product }
      this.showCreateModal = true
    },
    async toggleStatus(product) {
      const action = product.is_active ? '下架' : '上架'
      if (!confirm(`确认${action}商品 "${product.name}"？`)) {
        return
      }

      try {
        const response = await productApi.update(product.id, { is_active: !product.is_active })
        if (response.data.success) {
          alert(`${action}成功！`)
          await this.loadProducts()
        } else {
          alert(`${action}失败: ` + (response.data.message || '未知错误'))
        }
      } catch (error) {
        console.error('更新状态失败:', error)
        alert(`${action}失败: ` + (error.response?.data?.message || '未知错误'))
      }
    },
    async saveProduct() {
      this.modalError = ''
      this.saving = true

      try {
        if (!this.productForm.name || !this.productForm.sku) {
          this.modalError = '商品名称和SKU为必填项'
          return
        }

        if (this.productForm.price < 0) {
          this.modalError = '单价不能为负数'
          return
        }

        let response
        if (this.isEditing) {
          response = await productApi.update(this.productForm.id, this.productForm)
        } else {
          response = await productApi.create(this.productForm)
        }

        if (response.data.success) {
          alert(this.isEditing ? '更新成功！' : '添加成功！')
          this.resetModal()
          await this.loadProducts()
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
      this.productForm = {
        id: null,
        name: '',
        sku: '',
        category: 'other',
        unit: '件',
        price: 0,
        storage_temp_min: -18,
        storage_temp_max: 4,
        expiry_days: 30,
        description: '',
        is_active: true
      }
    },
    getCategoryBadgeClass(category) {
      const classes = {
        dairy: 'badge bg-info',
        meat: 'badge bg-danger',
        frozen: 'badge bg-primary',
        fresh: 'badge bg-success',
        other: 'badge bg-secondary'
      }
      return classes[category] || 'badge bg-secondary'
    },
    getCategoryText(category) {
      const texts = {
        dairy: '乳制品',
        meat: '肉类',
        frozen: '冷冻食品',
        fresh: '生鲜果蔬',
        other: '其他'
      }
      return texts[category] || category
    }
  }
}
</script>
