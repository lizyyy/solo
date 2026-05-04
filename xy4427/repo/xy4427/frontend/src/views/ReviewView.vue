<template>
  <div class="review-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">复核处理</span>
          <div class="header-actions">
            <el-input
              v-model="teacherName"
              placeholder="请输入复核老师姓名"
              style="width: 200px; margin-right: 12px;"
              clearable
            />
            <el-button type="primary" @click="saveTeacherName">
              保存姓名
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="6">
          <el-statistic title="待处理风险" :value="pendingCount" class="pending-stat">
            <template #suffix>
              <span class="stat-suffix">项</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="已复核" :value="reviewedCount">
            <template #suffix>
              <span class="stat-suffix">项</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="改判放行" :value="overruledCount">
            <template #suffix>
              <span class="stat-suffix">项</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="已解决" :value="resolvedCount">
            <template #suffix>
              <span class="stat-suffix">项</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>

      <el-table
        :data="pendingRisks"
        border
        style="width: 100%"
        v-loading="loading"
        :default-sort="{ prop: 'detectedAt', order: 'descending' }"
        :row-key="row => row.id"
        :expand-row-keys="expandedRows"
        @expand-change="handleExpandChange"
      >
        <el-table-column type="expand">
          <template #default="props">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="风险类型">
                <el-tag :type="getRiskTypeTagType(props.row.riskType)">
                  {{ riskTypeNames[props.row.riskType] || props.row.riskType }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="严重程度">
                <el-tag :type="getSeverityTagType(props.row.severity)">
                  {{ severityNames[props.row.severity] || props.row.severity }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="页码">
                <span v-if="props.row.pageNumber">第 {{ props.row.pageNumber }} 页</span>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="段落ID">
                <span v-if="props.row.paragraphId">{{ props.row.paragraphId }}</span>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="检测时间">
                {{ formatTime(props.row.detectedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusTagType(props.row.status)">
                  {{ statusNames[props.row.status] || props.row.status }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="描述" :span="2">
                {{ props.row.description }}
              </el-descriptions-item>
            </el-descriptions>

            <el-divider>复核操作</el-divider>

            <el-form :model="getReviewForm(props.row.id)" label-width="100px">
              <el-form-item label="处理状态">
                <el-radio-group v-model="getReviewForm(props.row.id).newStatus">
                  <el-radio value="reviewed">
                    <el-tag type="primary">已复核</el-tag>
                  </el-radio>
                  <el-radio value="overruled">
                    <el-tag type="success">改判放行</el-tag>
                  </el-radio>
                  <el-radio value="resolved">
                    <el-tag type="success">已解决</el-tag>
                  </el-radio>
                  <el-radio value="ignored">
                    <el-tag type="info">忽略</el-tag>
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="复核备注">
                <el-input
                  v-model="getReviewForm(props.row.id).comment"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入复核备注（选填）"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  @click="submitReview(props.row)"
                  :loading="getReviewForm(props.row.id).loading"
                >
                  提交复核
                </el-button>
                <el-button @click="resetReviewForm(props.row.id)">
                  重置
                </el-button>
              </el-form-item>
            </el-form>
          </template>
        </el-table-column>

        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="riskType" label="风险类型" width="160">
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
        <el-table-column prop="description" label="描述" min-width="300" show-overflow-tooltip />
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="scope">
            <el-tag :type="getSeverityTagType(scope.row.severity)">
              {{ severityNames[scope.row.severity] || scope.row.severity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detectedAt" label="检测时间" width="180" sortable>
          <template #default="scope">
            {{ formatTime(scope.row.detectedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="快捷操作" width="200" fixed="right">
          <template #default="scope">
            <el-button
              type="success"
              link
              @click="quickReview(scope.row, 'reviewed')"
              :loading="getReviewForm(scope.row.id).loading"
            >
              复核通过
            </el-button>
            <el-button
              type="primary"
              link
              @click="quickReview(scope.row, 'overruled')"
              :loading="getReviewForm(scope.row.id).loading"
            >
              改判放行
            </el-button>
            <el-button
              type="warning"
              link
              @click="toggleExpand(scope.row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="pendingRisks.length === 0 && !loading" description="暂无待处理的风险项">
        <el-button type="primary" @click="goToRisks">
          前往风险检测页面
        </el-button>
      </el-empty>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span class="card-title">复核记录</span>
      </template>

      <el-table
        :data="reviewedRisks"
        border
        style="width: 100%"
        v-loading="loading"
        :default-sort="{ prop: 'reviewedAt', order: 'descending' }"
      >
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="riskType" label="风险类型" width="160">
          <template #default="scope">
            <el-tag :type="getRiskTypeTagType(scope.row.riskType)" size="small">
              {{ riskTypeNames[scope.row.riskType] || scope.row.riskType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pageNumber" label="页码" width="100">
          <template #default="scope">
            <span v-if="scope.row.pageNumber">第 {{ scope.row.pageNumber }} 页</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="处理结果" width="120">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)">
              {{ statusNames[scope.row.status] || scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewer" label="复核人" width="120" />
        <el-table-column prop="reviewComment" label="复核备注" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.reviewComment">{{ scope.row.reviewComment }}</span>
            <span v-else style="color: #909399;">无备注</span>
          </template>
        </el-table-column>
        <el-table-column prop="reviewedAt" label="复核时间" width="180" sortable>
          <template #default="scope">
            {{ formatTime(scope.row.reviewedAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useStore } from 'vuex'
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
  name: 'ReviewView',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const store = useStore()
    
    const loading = ref(false)
    const teacherName = ref(store.state.teacherName || '')
    
    const riskList = ref([])
    const expandedRows = ref([])
    const reviewForms = reactive({})

    const pendingRisks = computed(() => {
      return riskList.value.filter(r => r.status === 'pending')
    })

    const reviewedRisks = computed(() => {
      return riskList.value.filter(r => r.status !== 'pending')
    })

    const pendingCount = computed(() => pendingRisks.value.length)
    const reviewedCount = computed(() => riskList.value.filter(r => r.status === 'reviewed').length)
    const overruledCount = computed(() => riskList.value.filter(r => r.status === 'overruled').length)
    const resolvedCount = computed(() => riskList.value.filter(r => r.status === 'resolved').length)

    const getReviewForm = (riskId) => {
      if (!reviewForms[riskId]) {
        reviewForms[riskId] = {
          newStatus: 'reviewed',
          comment: '',
          loading: false,
        }
      }
      return reviewForms[riskId]
    }

    const resetReviewForm = (riskId) => {
      reviewForms[riskId] = {
        newStatus: 'reviewed',
        comment: '',
        loading: false,
      }
    }

    const loadRiskList = async () => {
      loading.value = true
      try {
        const response = await riskApi.getRiskList({})
        if (response.success) {
          riskList.value = response.data
        }
      } catch (error) {
        console.error('加载风险列表失败:', error)
      } finally {
        loading.value = false
      }
    }

    const saveTeacherName = () => {
      if (!teacherName.value.trim()) {
        ElMessage.warning('请输入复核老师姓名')
        return
      }
      store.dispatch('updateTeacherName', teacherName.value.trim())
      ElMessage.success('姓名已保存')
    }

    const submitReview = async (risk) => {
      const form = getReviewForm(risk.id)
      
      if (!teacherName.value.trim()) {
        ElMessage.warning('请先输入并保存复核老师姓名')
        return
      }

      form.loading = true
      try {
        const response = await riskApi.reviewRisk(risk.id, {
          newStatus: form.newStatus,
          reviewer: teacherName.value.trim(),
          comment: form.comment,
        })
        
        if (response.success) {
          ElMessage.success('复核提交成功')
          await loadRiskList()
          
          const index = expandedRows.value.indexOf(risk.id)
          if (index > -1) {
            expandedRows.value.splice(index, 1)
          }
        }
      } catch (error) {
        console.error('提交复核失败:', error)
      } finally {
        form.loading = false
      }
    }

    const quickReview = async (risk, newStatus) => {
      try {
        await ElMessageBox.confirm(
          `确定要将此风险项标记为「${statusNames[newStatus]}」吗？`,
          '快捷复核确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
      } catch {
        return
      }

      if (!teacherName.value.trim()) {
        ElMessage.warning('请先输入并保存复核老师姓名')
        return
      }

      const form = getReviewForm(risk.id)
      form.loading = true
      
      try {
        const response = await riskApi.reviewRisk(risk.id, {
          newStatus: newStatus,
          reviewer: teacherName.value.trim(),
          comment: '',
        })
        
        if (response.success) {
          ElMessage.success('复核提交成功')
          await loadRiskList()
        }
      } catch (error) {
        console.error('快捷复核失败:', error)
      } finally {
        form.loading = false
      }
    }

    const handleExpandChange = (row, expandedRows) => {
      expandedRows.value = expandedRows.map(r => r.id)
    }

    const toggleExpand = (row) => {
      const index = expandedRows.value.indexOf(row.id)
      if (index > -1) {
        expandedRows.value.splice(index, 1)
      } else {
        expandedRows.value.push(row.id)
      }
    }

    const goToRisks = () => {
      router.push('/risks')
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

    watch(
      () => route.query.riskId,
      (riskId) => {
        if (riskId) {
          const id = parseInt(riskId)
          const risk = riskList.value.find(r => r.id === id)
          if (risk && risk.status === 'pending') {
            expandedRows.value = [id]
          }
        }
      },
      { immediate: true }
    )

    onMounted(() => {
      loadRiskList()
    })

    return {
      loading,
      teacherName,
      riskList,
      expandedRows,
      pendingRisks,
      reviewedRisks,
      pendingCount,
      reviewedCount,
      overruledCount,
      resolvedCount,
      riskTypeNames,
      severityNames,
      statusNames,
      getReviewForm,
      resetReviewForm,
      saveTeacherName,
      submitReview,
      quickReview,
      handleExpandChange,
      toggleExpand,
      goToRisks,
      getRiskTypeTagType,
      getSeverityTagType,
      getStatusTagType,
      formatTime,
    }
  }
}
</script>

<style lang="scss" scoped>
.review-view {
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

.header-actions {
  display: flex;
  align-items: center;
}

.stat-suffix {
  font-size: 14px;
  color: #909399;
}

.pending-stat {
  :deep(.el-statistic__number) {
    color: #E6A23C;
  }
}

.mr-1 {
  margin-right: 4px;
}
</style>
