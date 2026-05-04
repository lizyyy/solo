<template>
  <div class="risks-view">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span class="card-title">风险检测</span>
              <el-button type="primary" @click="runDetection" :loading="detecting">
                <el-icon class="mr-1"><Search /></el-icon>
                执行风险检测
              </el-button>
            </div>
          </template>

          <el-row :gutter="20" style="margin-bottom: 20px;">
            <el-col :span="4">
              <el-statistic title="总风险数" :value="riskStats.total">
                <template #suffix>
                  <span class="stat-suffix">项</span>
                </template>
              </el-statistic>
            </el-col>
            <el-col :span="4">
              <el-statistic title="待处理" :value="riskStats.byStatus.pending">
                <template #suffix>
                  <span class="stat-suffix">项</span>
                </template>
                <template #value>
                  <span class="text-warning">{{ riskStats.byStatus.pending }}</span>
                </template>
              </el-statistic>
            </el-col>
            <el-col :span="4">
              <el-statistic title="高风险" :value="highRiskCount">
                <template #suffix>
                  <span class="stat-suffix">项</span>
                </template>
                <template #value>
                  <span class="text-danger">{{ highRiskCount }}</span>
                </template>
              </el-statistic>
            </el-col>
            <el-col :span="12">
              <div class="filter-section">
                <el-form :inline="true" :model="filters" class="filter-form">
                  <el-form-item label="风险类型">
                    <el-select v-model="filters.riskType" placeholder="全部类型" clearable style="width: 180px;">
                      <el-option
                        v-for="(name, type) in riskTypeNames"
                        :key="type"
                        :label="name"
                        :value="type"
                      />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="状态">
                    <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px;">
                      <el-option label="待处理" value="pending" />
                      <el-option label="已复核" value="reviewed" />
                      <el-option label="改判放行" value="overruled" />
                      <el-option label="已解决" value="resolved" />
                      <el-option label="忽略" value="ignored" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="严重程度">
                    <el-select v-model="filters.severity" placeholder="全部程度" clearable style="width: 140px;">
                      <el-option label="高" value="high" />
                      <el-option label="中" value="medium" />
                      <el-option label="低" value="low" />
                    </el-select>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="applyFilters">
                      <el-icon class="mr-1"><Filter /></el-icon>
                      筛选
                    </el-button>
                    <el-button @click="resetFilters">重置</el-button>
                  </el-form-item>
                </el-form>
              </div>
            </el-col>
          </el-row>

          <el-table
            :data="riskList"
            border
            style="width: 100%"
            v-loading="loading"
            :default-sort="{ prop: 'detectedAt', order: 'descending' }"
          >
            <el-table-column prop="id" label="ID" width="80" sortable />
            <el-table-column prop="riskType" label="风险类型" width="180">
              <template #default="scope">
                <el-tag :type="getRiskTypeTagType(scope.row.riskType)">
                  {{ riskTypeNames[scope.row.riskType] || scope.row.riskType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="pageNumber" label="页码" width="100" sortable>
              <template #default="scope">
                <span v-if="scope.row.pageNumber">第 {{ scope.row.pageNumber }} 页</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="paragraphId" label="段落ID" width="120">
              <template #default="scope">
                <span v-if="scope.row.paragraphId">{{ scope.row.paragraphId }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="300" show-overflow-tooltip />
            <el-table-column prop="severity" label="严重程度" width="100">
              <template #default="scope">
                <el-tag :type="getSeverityTagType(scope.row.severity)">
                  {{ severityNames[scope.row.severity] || scope.row.severity }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="120">
              <template #default="scope">
                <el-tag :type="getStatusTagType(scope.row.status)">
                  {{ statusNames[scope.row.status] || scope.row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="detectedAt" label="检测时间" width="180" sortable>
              <template #default="scope">
                {{ formatTime(scope.row.detectedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="scope">
                <el-button
                  type="primary"
                  link
                  @click="viewDetail(scope.row)"
                >
                  详情
                </el-button>
                <el-button
                  type="warning"
                  link
                  @click="goToReview(scope.row)"
                  v-if="scope.row.status === 'pending'"
                >
                  复核
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="detailVisible" title="风险详情" width="700px">
      <el-descriptions :column="2" border v-if="currentRisk">
        <el-descriptions-item label="风险类型">
          <el-tag :type="getRiskTypeTagType(currentRisk.riskType)">
            {{ riskTypeNames[currentRisk.riskType] || currentRisk.riskType }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="严重程度">
          <el-tag :type="getSeverityTagType(currentRisk.severity)">
            {{ severityNames[currentRisk.severity] || currentRisk.severity }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="页码">
          <span v-if="currentRisk.pageNumber">第 {{ currentRisk.pageNumber }} 页</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="段落ID">
          <span v-if="currentRisk.paragraphId">{{ currentRisk.paragraphId }}</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(currentRisk.status)">
            {{ statusNames[currentRisk.status] || currentRisk.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="检测时间">
          {{ formatTime(currentRisk.detectedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">
          {{ currentRisk.description }}
        </el-descriptions-item>
        <el-descriptions-item label="复核人" v-if="currentRisk.reviewer">
          {{ currentRisk.reviewer }}
        </el-descriptions-item>
        <el-descriptions-item label="复核时间" v-if="currentRisk.reviewedAt">
          {{ formatTime(currentRisk.reviewedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="复核备注" :span="2" v-if="currentRisk.reviewComment">
          {{ currentRisk.reviewComment }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button 
          type="warning" 
          @click="goToReview(currentRisk)"
          v-if="currentRisk && currentRisk.status === 'pending'"
        >
          去复核
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { riskApi } from '../api'
import dayjs from 'dayjs'

const riskTypeNames = {
  missing_translation: '漏译风险',
  point_conflict: '点位冲突风险',
  temperature_drift: '热压温度漂移风险',
  duplicate_rework: '同一页重复返工风险',
  other: '其他风险',
}

const severityNames = {
  high: '高',
  medium: '中',
  low: '低',
}

const statusNames = {
  pending: '待处理',
  reviewed: '已复核',
  overruled: '改判放行',
  resolved: '已解决',
  ignored: '忽略',
}

export default {
  name: 'RisksView',
  setup() {
    const router = useRouter()
    
    const detecting = ref(false)
    const loading = ref(false)
    
    const riskStats = ref({
      total: 0,
      byStatus: {
        pending: 0,
        reviewed: 0,
        overruled: 0,
        resolved: 0,
        ignored: 0,
      },
      byType: {},
    })

    const riskList = ref([])
    
    const filters = reactive({
      riskType: '',
      status: '',
      severity: '',
    })

    const detailVisible = ref(false)
    const currentRisk = ref(null)

    const highRiskCount = computed(() => {
      return riskList.value.filter(r => r.severity === 'high').length
    })

    const loadRiskStats = async () => {
      try {
        const response = await riskApi.getRiskStats()
        if (response.success) {
          riskStats.value = response.data
        }
      } catch (error) {
        console.error('加载风险统计失败:', error)
      }
    }

    const loadRiskList = async () => {
      loading.value = true
      try {
        const params = {}
        if (filters.riskType) params.riskType = filters.riskType
        if (filters.status) params.status = filters.status
        
        const response = await riskApi.getRiskList(params)
        if (response.success) {
          let data = response.data
          
          if (filters.severity) {
            data = data.filter(r => r.severity === filters.severity)
          }
          
          riskList.value = data
        }
      } catch (error) {
        console.error('加载风险列表失败:', error)
      } finally {
        loading.value = false
      }
    }

    const runDetection = async () => {
      detecting.value = true
      try {
        const response = await riskApi.runDetection()
        if (response.success) {
          ElMessage.success(response.message)
          await loadRiskStats()
          await loadRiskList()
        }
      } catch (error) {
        console.error('风险检测失败:', error)
      } finally {
        detecting.value = false
      }
    }

    const applyFilters = () => {
      loadRiskList()
    }

    const resetFilters = () => {
      filters.riskType = ''
      filters.status = ''
      filters.severity = ''
      loadRiskList()
    }

    const viewDetail = (risk) => {
      currentRisk.value = risk
      detailVisible.value = true
    }

    const goToReview = (risk) => {
      detailVisible.value = false
      router.push({
        path: '/review',
        query: { riskId: risk.id }
      })
    }

    const getRiskTypeTagType = (type) => {
      const map = {
        missing_translation: 'danger',
        point_conflict: 'warning',
        temperature_drift: 'primary',
        duplicate_rework: 'info',
        other: 'success',
      }
      return map[type] || 'info'
    }

    const getSeverityTagType = (severity) => {
      const map = {
        high: 'danger',
        medium: 'warning',
        low: 'info',
      }
      return map[severity] || 'info'
    }

    const getStatusTagType = (status) => {
      const map = {
        pending: 'warning',
        reviewed: 'primary',
        overruled: 'success',
        resolved: 'success',
        ignored: 'info',
      }
      return map[status] || 'info'
    }

    const formatTime = (time) => {
      if (!time) return '-'
      return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }

    onMounted(() => {
      loadRiskStats()
      loadRiskList()
    })

    return {
      detecting,
      loading,
      riskStats,
      riskList,
      filters,
      detailVisible,
      currentRisk,
      highRiskCount,
      riskTypeNames,
      severityNames,
      statusNames,
      runDetection,
      applyFilters,
      resetFilters,
      viewDetail,
      goToReview,
      getRiskTypeTagType,
      getSeverityTagType,
      getStatusTagType,
      formatTime,
    }
  }
}
</script>

<style lang="scss" scoped>
.risks-view {
  min-height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.stat-suffix {
  font-size: 14px;
  color: #909399;
}

.text-warning {
  color: #E6A23C;
}

.text-danger {
  color: #F56C6C;
}

.filter-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.filter-form {
  margin: 0;
}

.mr-1 {
  margin-right: 4px;
}
</style>
