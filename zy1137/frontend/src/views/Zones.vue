<template>
  <div>
    <div class="filter-bar">
      <div class="search-input">
        <span v-html="IconSearch"></span>
        <input 
          type="text" 
          class="form-control" 
          placeholder="搜索区域名称..."
          v-model="searchQuery"
          @keyup.enter="loadZones"
        />
      </div>
      <button class="btn btn-secondary" @click="loadZones">
        <span v-html="IconRefresh"></span> 刷新
      </button>
      <button class="btn btn-primary" @click="showCreateModal = true">
        <span v-html="IconAdd"></span> 新建区域
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else-if="zones.length > 0">
      <div class="zones-grid">
        <div v-for="zone in zones" :key="zone.id" class="zone-card" @click="goToZone(zone)">
          <div class="zone-card-header">
            <h3 class="zone-card-title">{{ zone.zoneName }}</h3>
            <span class="badge" :class="getZoneStatusBadgeClass(zone)">
              {{ zone.isActive ? '活跃' : '停用' }}
            </span>
          </div>
          <div class="zone-card-body">
            <div class="zone-stats">
              <div class="zone-stat">
                <span class="zone-stat-value">{{ zone.deviceCount || 0 }}</span>
                <span class="zone-stat-label">设备</span>
              </div>
              <div class="zone-stat">
                <span class="zone-stat-value" :style="{ color: getAnomalyCountColor(zone) }">
                  {{ zone.anomalyCount || 0 }}
                </span>
                <span class="zone-stat-label">异常</span>
              </div>
              <div class="zone-stat">
                <span class="zone-stat-value">{{ zone.scanCount || 0 }}</span>
                <span class="zone-stat-label">扫描</span>
              </div>
            </div>
            <div v-if="zone.allowedDeviceTypes && zone.allowedDeviceTypes.length > 0" class="zone-types">
              <span class="zone-types-label">允许设备:</span>
              <div class="zone-types-list">
                <span 
                  v-for="type in zone.allowedDeviceTypes.slice(0, 3)" 
                  :key="type"
                  class="badge badge-primary"
                  style="font-size: 11px;"
                >
                  {{ getDeviceTypeLabel(type) }}
                </span>
                <span 
                  v-if="zone.allowedDeviceTypes.length > 3"
                  class="badge badge-secondary"
                  style="font-size: 11px;"
                >
                  +{{ zone.allowedDeviceTypes.length - 3 }}
                </span>
              </div>
            </div>
            <div v-if="zone.description" class="zone-description">
              {{ zone.description }}
            </div>
          </div>
          <div class="zone-card-footer">
            <span class="zone-footer-info">
              RSSI阈值: {{ zone.rssiThreshold || -80 }} dBm
            </span>
            <span class="zone-footer-info">
              失联阈值: {{ zone.disconnectTimeoutMinutes || 120 }} 分钟
            </span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state-title">暂无区域数据</p>
      <p class="empty-state-desc">请先导入区域数据或创建新区域</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <router-link to="/import" class="btn btn-secondary">导入数据</router-link>
        <button class="btn btn-primary" @click="showCreateModal = true">创建区域</button>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">新建区域</h3>
          <button class="modal-close" @click="showCreateModal = false" v-html="IconClose"></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">区域名称 *</label>
            <input 
              type="text" 
              class="form-control" 
              v-model="newZone.zoneName"
              placeholder="请输入区域名称"
            />
          </div>
          <div class="form-group">
            <label class="form-label">区域代码</label>
            <input 
              type="text" 
              class="form-control" 
              v-model="newZone.zoneCode"
              placeholder="请输入区域代码（可选）"
            />
          </div>
          <div class="form-group">
            <label class="form-label">区域类型</label>
            <select class="form-control form-select" v-model="newZone.zoneType">
              <option value="store">门店</option>
              <option value="warehouse">仓库</option>
              <option value="office">办公区</option>
              <option value="parking">停车场</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">描述</label>
            <textarea 
              class="form-control" 
              rows="3"
              v-model="newZone.description"
              placeholder="请输入区域描述（可选）"
            ></textarea>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">RSSI 阈值 (dBm)</label>
              <input 
                type="number" 
                class="form-control" 
                v-model.number="newZone.rssiThreshold"
                placeholder="-80"
              />
              <div class="form-help">信号强度低于此值视为弱信号</div>
            </div>
            <div class="form-group">
              <label class="form-label">失联阈值 (分钟)</label>
              <input 
                type="number" 
                class="form-control" 
                v-model.number="newZone.disconnectTimeoutMinutes"
                placeholder="120"
              />
              <div class="form-help">超过此时间未扫描视为失联</div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">允许的设备类型</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <label v-for="type in deviceTypes" :key="type.value" class="checkbox-label">
                <input 
                  type="checkbox" 
                  :value="type.value"
                  v-model="newZone.allowedDeviceTypes"
                />
                <span>{{ type.label }}</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" v-model="newZone.isActive" style="margin-right: 8px;" />
              启用区域
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" @click="createZone" :disabled="creating">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi, getDeviceTypeLabel } from '@/utils/api'
import { 
  RefreshIcon,
  SearchIcon,
  CloseIcon
} from '@/components/icons'

export default {
  name: 'Zones',
  setup() {
    const router = useRouter()
    const api = useApi()

    const loading = ref(false)
    const zones = ref([])
    const searchQuery = ref('')
    const showCreateModal = ref(false)
    const creating = ref(false)

    const newZone = ref({
      zoneName: '',
      zoneCode: '',
      zoneType: 'store',
      description: '',
      rssiThreshold: -80,
      disconnectTimeoutMinutes: 120,
      allowedDeviceTypes: [],
      isActive: true
    })

    const deviceTypes = [
      { value: 'esl', label: '电子价签' },
      { value: 'printer', label: '小票打印机' },
      { value: 'beacon', label: 'Beacon信标' },
      { value: 'scanner', label: '扫码枪' },
      { value: 'headset', label: '员工耳机' },
      { value: 'other', label: '其他设备' }
    ]

    const IconRefresh = RefreshIcon()
    const IconSearch = SearchIcon()
    const IconClose = CloseIcon()
    const IconAdd = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`

    const loadZones = async () => {
      loading.value = true
      try {
        const params = {}
        if (searchQuery.value) {
          params.search = searchQuery.value
        }
        const result = await api.zones.list(params)
        zones.value = result.items || []
      } catch (error) {
        console.error('Failed to load zones:', error)
        showNotification('error', '加载失败', error.message)
      } finally {
        loading.value = false
      }
    }

    const goToZone = (zone) => {
      router.push(`/zones/${zone.id}`)
    }

    const createZone = async () => {
      if (!newZone.value.zoneName.trim()) {
        showNotification('warning', '请填写区域名称', '区域名称不能为空')
        return
      }

      creating.value = true
      try {
        await api.zones.create(newZone.value)
        showNotification('success', '创建成功', '区域已创建')
        showCreateModal.value = false
        newZone.value = {
          zoneName: '',
          zoneCode: '',
          zoneType: 'store',
          description: '',
          rssiThreshold: -80,
          disconnectTimeoutMinutes: 120,
          allowedDeviceTypes: [],
          isActive: true
        }
        loadZones()
      } catch (error) {
        showNotification('error', '创建失败', error.message)
      } finally {
        creating.value = false
      }
    }

    const getZoneStatusBadgeClass = (zone) => {
      return zone.isActive ? 'badge-success' : 'badge-secondary'
    }

    const getAnomalyCountColor = (zone) => {
      const count = zone.anomalyCount || 0
      if (count > 5) return '#dc2626'
      if (count > 0) return '#f59e0b'
      return '#10b981'
    }

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    onMounted(() => {
      loadZones()
    })

    return {
      loading,
      zones,
      searchQuery,
      showCreateModal,
      creating,
      newZone,
      deviceTypes,
      IconRefresh,
      IconSearch,
      IconClose,
      IconAdd,
      loadZones,
      goToZone,
      createZone,
      getZoneStatusBadgeClass,
      getAnomalyCountColor,
      getDeviceTypeLabel
    }
  }
}
</script>

<style scoped>
.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

.zone-card {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-gray-200);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.zone-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.zone-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-gray-200);
}

.zone-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0;
}

.zone-card-body {
  padding: 16px 20px;
}

.zone-stats {
  display: flex;
  gap: 32px;
  margin-bottom: 16px;
}

.zone-stat {
  text-align: center;
}

.zone-stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1;
}

.zone-stat-label {
  display: block;
  font-size: 12px;
  color: var(--color-gray-500);
  margin-top: 4px;
}

.zone-types {
  margin-bottom: 12px;
}

.zone-types-label {
  font-size: 12px;
  color: var(--color-gray-500);
  display: block;
  margin-bottom: 6px;
}

.zone-types-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.zone-description {
  font-size: 13px;
  color: var(--color-gray-600);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.zone-card-footer {
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--color-gray-50);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  border-top: 1px solid var(--color-gray-200);
}

.zone-footer-info {
  font-size: 12px;
  color: var(--color-gray-500);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.checkbox-label:hover {
  background: var(--color-gray-100);
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
}
</style>
