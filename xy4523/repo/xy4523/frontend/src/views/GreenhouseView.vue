<template>
  <div class="greenhouse-view">
    <div class="page-header flex-between mb-4">
      <div>
        <h1 class="page-title">🏠 温室管理</h1>
        <p class="page-subtitle text-muted">
          按温室和苗床查看植物批次及评估状态
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary" @click="refreshData">
          🔄 刷新
        </button>
        <button class="btn btn-success" @click="exportMarkdown">
          📄 导出工作单
        </button>
      </div>
    </div>

    <div class="card mb-4" v-if="store.greenhouses.length === 0">
      <div class="card-body text-center p-4">
        <div class="text-muted mb-3">
          暂无温室配置，请先在"数据导入"页面添加温室和苗床
        </div>
        <button class="btn btn-primary" @click="$router.push('/import')">
          去配置 →
        </button>
      </div>
    </div>

    <div 
      v-for="gh in store.greenhouses" 
      :key="gh.id"
      class="card mb-4"
    >
      <div class="card-header flex-between">
        <div class="flex gap-2 align-center">
          <span class="text-lg">🏠</span>
          <span class="text-bold">{{ gh.name }}</span>
          <span class="badge badge-info">{{ getGreenhouseBatchCount(gh.id) }} 批次</span>
          <span class="badge" :class="getGreenhouseSuitableCount(gh.id) === getGreenhouseBatchCount(gh.id) && getGreenhouseBatchCount(gh.id) > 0 ? 'badge-success' : 'badge-warning'">
            {{ getGreenhouseSuitableCount(gh.id) }} 适合
          </span>
        </div>
        <button 
          class="btn btn-sm btn-outline" 
          @click="toggleGreenhouse(gh.id)"
        >
          {{ expandedGreenhouses.includes(gh.id) ? '收起' : '展开' }}
        </button>
      </div>
      
      <div v-if="expandedGreenhouses.includes(gh.id)" class="card-body">
        <div 
          v-for="sb in getSeedbedsForGreenhouse(gh.id)" 
          :key="sb.id"
          class="mb-4 p-3 bg-light rounded"
        >
          <div class="flex-between mb-3">
            <div class="flex gap-2 align-center">
              <span>🌱 苗床 {{ sb.code }}</span>
              <span v-if="sb.name" class="text-muted">({{ sb.name }})</span>
              <span class="badge badge-info">{{ getSeedbedBatchCount(sb.id) }} 批次</span>
            </div>
            <button 
              class="btn btn-sm btn-outline" 
              @click="toggleSeedbed(sb.id)"
            >
              {{ expandedSeedbeds.includes(sb.id) ? '收起' : '展开详情' }}
            </button>
          </div>

          <div class="grid grid-4">
            <div 
              v-for="batch in getBatchesForSeedbed(sb.id)" 
              :key="batch.id"
              class="seedbed-batch-card cursor-pointer"
              @click="viewBatchDetail(batch)"
            >
              <div class="flex-between mb-2">
                <span class="text-bold">{{ batch.plant_name }}</span>
                <span 
                  class="badge" 
                  :class="getAssessment(batch.id)?.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
                >
                  {{ getAssessment(batch.id)?.is_suitable_pollination ? '✅' : '⚠️' }}
                </span>
              </div>
              
              <div v-if="batch.variety" class="text-muted text-sm mb-1">
                {{ batch.variety }}
              </div>
              
              <div class="text-sm mb-2">
                <span class="text-muted">花期:</span> 
                {{ batch.expected_flowering_start }} ~ {{ batch.expected_flowering_end }}
              </div>
              
              <div v-if="getAssessment(batch.id)" class="mt-2 pt-2 border-top">
                <div class="text-xs text-muted">
                  {{ getAssessment(batch.id)?.flowering_stage }}
                </div>
                <div 
                  v-if="getAssessment(batch.id)?.risk_type !== 'suitable'"
                  class="text-xs text-warning mt-1"
                >
                  {{ getAssessment(batch.id)?.risk_reason }}
                </div>
              </div>
            </div>
            
            <div 
              v-if="getBatchesForSeedbed(sb.id).length === 0"
              class="text-center text-muted p-3"
            >
              暂无植物批次
            </div>
          </div>

          <div v-if="expandedSeedbeds.includes(sb.id)" class="mt-4">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>植物</th>
                    <th>品种</th>
                    <th>批次号</th>
                    <th>种植日期</th>
                    <th>花期</th>
                    <th>评估状态</th>
                    <th>风险原因</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="batch in getBatchesForSeedbed(sb.id)" :key="batch.id">
                    <td class="text-bold">{{ batch.plant_name }}</td>
                    <td>{{ batch.variety || '-' }}</td>
                    <td>{{ batch.batch_number || '-' }}</td>
                    <td>{{ batch.planting_date || '-' }}</td>
                    <td>
                      {{ batch.expected_flowering_start || '-' }} 
                      ~ 
                      {{ batch.expected_flowering_end || '-' }}
                    </td>
                    <td>
                      <span 
                        class="badge" 
                        :class="getAssessment(batch.id)?.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
                      >
                        {{ getAssessment(batch.id)?.is_suitable_pollination ? '适合授粉' : '存在风险' }}
                      </span>
                      <span v-if="getAssessment(batch.id)?.manual_override" class="ml-1 text-xs text-info">
                        (人工改判)
                      </span>
                    </td>
                    <td style="max-width: 250px;">
                      <span class="text-sm">
                        {{ getAssessment(batch.id)?.risk_reason || '无风险' }}
                      </span>
                    </td>
                    <td>
                      <button 
                        class="btn btn-sm btn-outline" 
                        @click="viewBatchDetail(batch)"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="getSeedbedsForGreenhouse(gh.id).length === 0" class="text-center text-muted p-3">
          该温室暂无苗床配置
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import { exportApi } from '@/utils/api'

const store = useAppStore()
const router = useRouter()

const expandedGreenhouses = ref([])
const expandedSeedbeds = ref([])
const allBatches = ref([])

const getSeedbedsForGreenhouse = (greenhouseId) => {
  return store.seedbeds.filter(s => s.greenhouse_id === greenhouseId)
}

const getSeedbedBatchCount = (seedbedId) => {
  return allBatches.value.filter(b => b.seedbed_id === seedbedId).length
}

const getGreenhouseBatchCount = (greenhouseId) => {
  const seedbedIds = getSeedbedsForGreenhouse(greenhouseId).map(s => s.id)
  return allBatches.value.filter(b => seedbedIds.includes(b.seedbed_id)).length
}

const getGreenhouseSuitableCount = (greenhouseId) => {
  const seedbedIds = getSeedbedsForGreenhouse(greenhouseId).map(s => s.id)
  const batchIds = allBatches.value.filter(b => seedbedIds.includes(b.seedbed_id)).map(b => b.id)
  return store.assessments.filter(a => batchIds.includes(a.plant_batch_id) && a.is_suitable_pollination).length
}

const getBatchesForSeedbed = (seedbedId) => {
  return allBatches.value.filter(b => b.seedbed_id === seedbedId)
}

const getAssessment = (plantBatchId) => {
  return store.assessments.find(a => a.plant_batch_id === plantBatchId)
}

const toggleGreenhouse = (greenhouseId) => {
  const index = expandedGreenhouses.value.indexOf(greenhouseId)
  if (index > -1) {
    expandedGreenhouses.value.splice(index, 1)
  } else {
    expandedGreenhouses.value.push(greenhouseId)
  }
}

const toggleSeedbed = (seedbedId) => {
  const index = expandedSeedbeds.value.indexOf(seedbedId)
  if (index > -1) {
    expandedSeedbeds.value.splice(index, 1)
  } else {
    expandedSeedbeds.value.push(seedbedId)
  }
}

const viewBatchDetail = (batch) => {
  router.push(`/detail/${batch.id}`)
}

const refreshData = async () => {
  await Promise.all([
    store.fetchAssessments(),
    loadBatches()
  ])
}

const exportMarkdown = () => {
  exportApi.markdown(store.currentDate)
}

const loadBatches = async () => {
  try {
    allBatches.value = await store.fetchPlantBatches()
  } catch (e) {
    console.error('加载批次失败:', e)
  }
}

onMounted(() => {
  loadBatches()
  store.fetchAssessments()
  
  if (store.greenhouses.length > 0) {
    expandedGreenhouses.value = [store.greenhouses[0].id]
  }
})

watch(() => store.currentDate, () => {
  store.fetchAssessments()
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
}

.text-lg {
  font-size: 18px;
}

.text-sm {
  font-size: 12px;
}

.text-xs {
  font-size: 11px;
}

.bg-light {
  background-color: #f8f9fa;
}

.rounded {
  border-radius: var(--radius);
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.cursor-pointer {
  cursor: pointer;
}

.align-center {
  align-items: center;
}

.ml-1 {
  margin-left: 4px;
}

.mt-2 {
  margin-top: 8px;
}

.pt-2 {
  padding-top: 8px;
}

.text-warning {
  color: var(--warning-color);
}

.text-info {
  color: var(--info-color);
}

.seedbed-batch-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 12px;
  transition: var(--transition);
}

.seedbed-batch-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(45, 90, 39, 0.1);
}

.table-responsive {
  overflow-x: auto;
}
</style>
