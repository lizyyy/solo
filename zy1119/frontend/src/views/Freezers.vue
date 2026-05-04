<template>
  <div class="freezers">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>冰柜管理</h2>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + 添加冰柜
      </button>
    </div>

    <div class="row mb-4">
      <div class="col-md-3">
        <div class="card border-primary">
          <div class="card-body text-center">
            <h6 class="text-muted mb-1">冰柜总数</h6>
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

    <div class="row g-4">
      <div v-for="freezer in freezers" :key="freezer.id" class="col-md-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">{{ freezer.name }}</h5>
            <span :class="getStatusBadgeClass(freezer.status)">
              {{ getStatusText(freezer.status) }}
            </span>
          </div>
          <div class="card-body">
            <table class="table table-borderless table-sm">
              <tbody>
                <tr>
                  <td class="text-muted">冰柜编号</td>
                  <td>{{ freezer.code || '-' }}</td>
                </tr>
                <tr>
                  <td class="text-muted">类型</td>
                  <td>{{ getTypeText(freezer.type) }}</td>
                </tr>
                <tr>
                  <td class="text-muted">存储温度</td>
                  <td>{{ freezer.temperature_min }}~{{ freezer.temperature_max }}°C</td>
                </tr>
                <tr>
                  <td class="text-muted">位置</td>
                  <td>{{ freezer.location || '-' }}</td>
                </tr>
              </tbody>
            </table>

            <div class="mb-2">
              <div class="d-flex justify-content-between small text-muted mb-1">
                <span>容量使用</span>
                <span>{{ freezer.used_capacity }}/{{ freezer.capacity }}</span>
              </div>
              <div class="progress" style="height: 20px;">
                <div 
                  class="progress-bar" 
                  :class="getCapacityBarClass(freezer)"
                  role="progressbar" 
                  :style="{ width: getCapacityPercent(freezer) + '%' }"
                  :aria-valuenow="getCapacityPercent(freezer)"
                  aria-valuemin="0" 
                  aria-valuemax="100"
                >
                  {{ getCapacityPercent(freezer) }}%
                </div>
              </div>
            </div>

            <div class="d-grid gap-2">
              <button class="btn btn-sm btn-outline-primary" @click="viewInventory(freezer)">
                查看库存 ({{ freezer.inventory_count || 0 }})
              </button>
              <button class="btn btn-sm btn-outline-secondary" @click="editFreezer(freezer)">
                编辑
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="freezers.length === 0" class="col-12">
        <div class="card">
          <div class="card-body text-center text-muted py-5">
            暂无冰柜数据
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditing ? '编辑冰柜' : '添加冰柜' }}</h5>
            <button type="button" class="btn-close" @click="resetModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="modalError" class="alert alert-danger">{{ modalError }}</div>
            
            <div class="mb-3">
              <label class="form-label">冰柜名称 *</label>
              <input type="text" class="form-control" v-model="freezerForm.name" required>
            </div>

            <div class="mb-3">
              <label class="form-label">冰柜编号</label>
              <input type="text" class="form-control" v-model="freezerForm.code">
            </div>

            <div class="mb-3">
              <label class="form-label">类型</label>
              <select class="form-select" v-model="freezerForm.type">
                <option value="refrigerator">冷藏柜 (0~10°C)</option>
                <option value="freezer">冷冻柜 (-18~-10°C)</option>
                <option value="combined">冷藏冷冻组合</option>
                <option value="showcase">冷藏展示柜</option>
              </select>
            </div>

            <div class="row mb-3">
              <div class="col-md-4">
                <label class="form-label">总容量</label>
                <div class="input-group">
                  <input type="number" class="form-control" v-model.number="freezerForm.capacity" min="1">
                  <span class="input-group-text">单位</span>
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">最低温度</label>
                <div class="input-group">
                  <input type="number" class="form-control" v-model.number="freezerForm.temperature_min">
                  <span class="input-group-text">°C</span>
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">最高温度</label>
                <div class="input-group">
                  <input type="number" class="form-control" v-model.number="freezerForm.temperature_max">
                  <span class="input-group-text">°C</span>
                </div>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">位置</label>
              <input type="text" class="form-control" v-model="freezerForm.location" placeholder="如: 正门左侧、厨房内">
            </div>

            <div class="mb-3">
              <label class="form-label">备注</label>
              <textarea class="form-control" rows="2" v-model="freezerForm.note"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="resetModal">取消</button>
            <button type="button" class="btn btn-primary" @click="saveFreezer" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { freezerApi, inventoryApi } from '../api'

export default {
  name: 'Freezers',
  data() {
    return {
      freezers: [],
      stats: {},
      showCreateModal: false,
      isEditing: false,
      saving: false,
      modalError: '',
      freezerForm: {
        id: null,
        name: '',
        code: '',
        type: 'refrigerator',
        capacity: 50,
        used_capacity: 0,
        temperature_min: 0,
        temperature_max: 10,
        location: '',
        note: '',
        status: 'available'
      }
    }
  },
  async mounted() {
    await Promise.all([
      this.loadFreezers(),
      this.loadStats()
    ])
  },
  methods: {
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
    async loadStats() {
      try {
        const response = await freezerApi.getStats()
        if (response.data.success) {
          this.stats = response.data.data
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },
    getCapacityPercent(freezer) {
      if (freezer.capacity === 0) return 0
      return Math.round((freezer.used_capacity / freezer.capacity) * 100)
    },
    getCapacityBarClass(freezer) {
      const percent = this.getCapacityPercent(freezer)
      if (percent >= 100) return 'bg-danger'
      if (percent >= 80) return 'bg-warning'
      return 'bg-success'
    },
    getStatusBadgeClass(status) {
      const classes = {
        available: 'badge bg-success',
        busy: 'badge bg-warning text-dark',
        full: 'badge bg-danger',
        maintenance: 'badge bg-secondary'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getStatusText(status) {
      const texts = {
        available: '可用',
        busy: '繁忙',
        full: '已满',
        maintenance: '维护中'
      }
      return texts[status] || status
    },
    getTypeText(type) {
      const texts = {
        refrigerator: '冷藏柜',
        freezer: '冷冻柜',
        combined: '冷藏冷冻组合',
        showcase: '冷藏展示柜'
      }
      return texts[type] || type
    },
    viewInventory(freezer) {
      this.$router.push({
        path: '/inventory',
        query: { freezer_id: freezer.id }
      })
    },
    editFreezer(freezer) {
      this.isEditing = true
      this.freezerForm = { ...freezer }
      this.showCreateModal = true
    },
    async saveFreezer() {
      this.modalError = ''
      this.saving = true

      try {
        if (!this.freezerForm.name) {
          this.modalError = '请输入冰柜名称'
          return
        }

        let response
        if (this.isEditing) {
          response = await freezerApi.update(this.freezerForm.id, this.freezerForm)
        } else {
          response = await freezerApi.create(this.freezerForm)
        }

        if (response.data.success) {
          alert(this.isEditing ? '更新成功！' : '添加成功！')
          this.resetModal()
          await Promise.all([
            this.loadFreezers(),
            this.loadStats()
          ])
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
      this.freezerForm = {
        id: null,
        name: '',
        code: '',
        type: 'refrigerator',
        capacity: 50,
        used_capacity: 0,
        temperature_min: 0,
        temperature_max: 10,
        location: '',
        note: '',
        status: 'available'
      }
    }
  }
}
</script>
