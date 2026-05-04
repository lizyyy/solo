<template>
  <div class="export-view">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span class="card-title">导出放行单和审计包</span>
              <div class="header-actions">
                <el-input
                  v-model="teacherName"
                  placeholder="请输入复核老师姓名"
                  style="width: 200px; margin-right: 12px;"
                  clearable
                />
              </div>
            </div>
          </template>

          <el-steps :active="currentStep" finish-status="success" style="margin-bottom: 30px;">
            <el-step title="确认数据" description="确认所有数据已导入" />
            <el-step title="风险检测" description="所有风险已处理" />
            <el-step title="复核完成" description="所有复核已完成" />
            <el-step title="导出文件" description="生成放行单和审计包" />
          </el-steps>

          <el-row :gutter="20" style="margin-bottom: 20px;">
            <el-col :span="8">
              <el-statistic title="总风险数" :value="riskStats.total">
                <template #suffix>
                  <span class="stat-suffix">项</span>
                </template>
              </el-statistic>
            </el-col>
            <el-col :span="8">
              <el-statistic title="待处理" :value="riskStats.byStatus.pending">
                <template #suffix>
                  <span class="stat-suffix">项</span>
                </template>
                <template #value>
                  <span :class="riskStats.byStatus.pending > 0 ? 'text-danger' : 'text-success'">
                    {{ riskStats.byStatus.pending }}
                  </span>
                </template>
              </el-statistic>
            </el-col>
            <el-col :span="8">
              <el-statistic title="放行状态">
                <template #value>
                  <el-tag :type="canRelease ? 'success' : 'danger'" size="large">
                    {{ canRelease ? '可以放行' : '暂不可放行' }}
                  </el-tag>
                </template>
              </el-statistic>
            </el-col>
          </el-row>

          <el-alert
            :title="canRelease ? '所有风险项已处理，可以进行放行操作' : '尚有风险待处理风险项，请先完成复核'"
            :type="canRelease ? 'success' : 'warning'"
            show-icon
            style="margin-bottom: 20px;"
          >
            <template #default>
              <p v-if="!canRelease">
                还有 <strong>{{ riskStats.byStatus.pending }}</strong> 个风险项待处理，请前往复核页面完成处理。
              </p>
            </template>
          </el-alert>

          <el-divider>导出选项</el-divider>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-card shadow="hover" class="export-card">
                <div class="export-icon markdown-icon">
                  <el-icon size="48"><Document /></el-icon>
                </div>
                <h3>Markdown 放行单</h3>
                <p>生成一份完整的 Markdown 格式放行单，包含所有数据概览、风险检测结果、复核记录和放行结论。</p>
                <div class="export-actions">
                  <el-button
                    type="primary"
                    @click="previewReleaseMarkdown"
                    :loading="loading.preview"
                  >
                    <el-icon class="mr-1"><View /></el-icon>
                    预览
                  </el-button>
                  <el-button
                    type="success"
                    @click="downloadReleaseMarkdown"
                    :disabled="!canRelease"
                  >
                    <el-icon class="mr-1"><Download /></el-icon>
                    下载
                  </el-button>
                </div>
              </el-card>
            </el-col>

            <el-col :span="12">
              <el-card shadow="hover" class="export-card">
                <div class="export-icon json-icon">
                  <el-icon size="48"><DataLine /></el-icon>
                </div>
                <h3>JSON 审计包</h3>
                <p>生成一个完整的 JSON 格式审计数据包，包含所有原始数据、风险检测结果和复核记录，用于审计追溯。</p>
                <div class="export-actions">
                  <el-button
                    type="primary"
                    @click="previewAuditPackage"
                    :loading="loading.audit"
                  >
                    <el-icon class="mr-1"><View /></el-icon>
                    预览
                  </el-button>
                  <el-button
                    type="success"
                    @click="downloadAuditPackage"
                    :disabled="!canRelease"
                  >
                    <el-icon class="mr-1"><Download /></el-icon>
                    下载
                  </el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span class="card-title">风险类型统计</span>
          </template>
          <div class="stat-list">
            <div
              v-for="(count, type) in riskStats.byType" :key="type" class="stat-item">
              <div class="stat-item-header">
                <span class="stat-item-name">{{ riskTypeNames[type] || type }}</span>
                <span class="stat-item-count">{{ count }} 项</span>
              </div>
              <el-progress
                :percentage="calculatePercentage(count)"
                :color="getTypeColor(type)"
                :stroke-width="10"
              />
            </div>
            <el-empty v-if="Object.keys(riskStats.byType).length === 0" description="暂无风险数据" />
          </div>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span class="card-title">快捷操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" size="large" @click="goToImport" style="width: 100%; margin-bottom: 10px;">
              <el-icon class="mr-1"><UploadFilled /></el-icon>
              导入数据
            </el-button>
            <el-button type="warning" size="large" @click="goToRisks" style="width: 100%; margin-bottom: 10px;">
              <el-icon class="mr-1"><Search /></el-icon>
              检测风险
            </el-button>
            <el-button type="info" size="large" @click="goToReview" style="width: 100%;">
              <el-icon class="mr-1"><EditPen /></el-icon>
              复核处理
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="markdownDialogVisible"
      title="放行单预览"
      width="70%"
      :close-on-click-modal="false"
    >
      <div class="markdown-preview" v-if="previewData.markdown">
        <pre>{{ previewData.markdown }}</pre>
      </div>
      <el-empty v-else description="暂无数据" />
      <template #footer>
        <el-button @click="markdownDialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          @click="copyMarkdown"
          :disabled="!previewData.markdown"
        >
          <el-icon class="mr-1"><CopyDocument /></el-icon>
          复制内容
        </el-button>
        <el-button
          type="success"
          @click="downloadReleaseMarkdown"
          :disabled="!canRelease"
        >
          <el-icon class="mr-1"><Download /></el-icon>
          下载文件
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="auditDialogVisible"
      title="审计包预览"
      width="70%"
      :close-on-click-modal="false"
    >
      <div class="json-preview" v-if="previewData.audit">
        <pre>{{ previewData.audit }}</pre>
      </div>
      <el-empty v-else description="暂无数据" />
      <template #footer>
        <el-button @click="auditDialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          @click="copyAudit"
          :disabled="!previewData.audit"
        >
          <el-icon class="mr-1"><CopyDocument /></el-icon>
          复制内容
        </el-button>
        <el-button
          type="success"
          @click="downloadAuditPackage"
          :disabled="!canRelease"
        >
          <el-icon class="mr-1"><Download /></el-icon>
          下载文件
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useStore } from 'vuex'
import { riskApi, exportApi } from '../api'

const riskTypeNames = {
  missing_translation: '漏译风险',
  point_conflict: '点位冲突风险',
  temperature_drift: '热压温度漂移风险',
  duplicate_rework: '同一页重复返工风险',
  other: '其他风险',
}

const typeColors = {
  missing_translation: '#F56C6C',
  point_conflict: '#E6A23C',
  temperature_drift: '#409EFF',
  duplicate_rework: '#909399',
  other: '#67C23A',
}

export default {
  name: 'ExportView',
  setup() {
    const router = useRouter()
    const store = useStore()
    
    const teacherName = ref(store.state.teacherName || '')
    
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

    const loading = ref({
      preview: false,
      audit: false,
    })

    const previewData = ref({
      markdown: '',
      audit: '',
    })

    const markdownDialogVisible = ref(false)
    const auditDialogVisible = ref(false)

    const currentStep = computed(() => {
      if (riskStats.value.total === 0) return 0
      if (riskStats.value.byStatus.pending > 0) return 1
      return 3
    })

    const canRelease = computed(() => {
      return riskStats.value.byStatus.pending === 0
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

    const calculatePercentage = (count) => {
      if (riskStats.value.total === 0) return 0
      return Math.round((count / riskStats.value.total) * 100)
    }

    const getTypeColor = (type) => {
      return typeColors[type] || '#409EFF'
    }

    const previewReleaseMarkdown = async () => {
      loading.value.preview = true
      try {
        const response = await exportApi.getReleaseMarkdown(teacherName.value.trim())
        if (response.success) {
          previewData.value.markdown = response.data.markdown
          markdownDialogVisible.value = true
        }
      } catch (error) {
        console.error('预览放行单失败:', error)
      } finally {
        loading.value.preview = false
      }
    }

    const previewAuditPackage = async () => {
      loading.value.audit = true
      try {
        const response = await exportApi.getAuditPackage(teacherName.value.trim())
        if (response.success) {
          previewData.value.audit = response.data.auditPackage
          auditDialogVisible.value = true
        }
      } catch (error) {
        console.error('预览审计包失败:', error)
      } finally {
        loading.value.audit = false
      }
    }

    const downloadReleaseMarkdown = () => {
      if (!teacherName.value.trim()) {
        ElMessage.warning('请输入复核老师姓名')
        return
      }
      exportApi.downloadReleaseMarkdown(teacherName.value.trim())
    }

    const downloadAuditPackage = () => {
      if (!teacherName.value.trim()) {
        ElMessage.warning('请输入复核老师姓名')
        return
      }
      exportApi.downloadAuditPackage(teacherName.value.trim())
    }

    const copyMarkdown = () => {
      navigator.clipboard.writeText(previewData.value.markdown)
        .then(() => {
          ElMessage.success('内容已复制到剪贴板')
        })
        .catch(() => {
          ElMessage.error('复制失败，请手动复制')
        })
    }

    const copyAudit = () => {
      navigator.clipboard.writeText(previewData.value.audit)
        .then(() => {
          ElMessage.success('内容已复制到剪贴板')
        })
        .catch(() => {
          ElMessage.error('复制失败，请手动复制')
        })
    }

    const goToImport = () => {
      router.push('/import')
    }

    const goToRisks = () => {
      router.push('/risks')
    }

    const goToReview = () => {
      router.push('/review')
    }

    onMounted(() => {
      loadRiskStats()
    })

    return {
      teacherName,
      riskStats,
      loading,
      previewData,
      markdownDialogVisible,
      auditDialogVisible,
      currentStep,
      canRelease,
      riskTypeNames,
      calculatePercentage,
      getTypeColor,
      previewReleaseMarkdown,
      previewAuditPackage,
      downloadReleaseMarkdown,
      downloadAuditPackage,
      copyMarkdown,
      copyAudit,
      goToImport,
      goToRisks,
      goToReview,
    }
  }
}
</script>

<style lang="scss" scoped>
.export-view {
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

.text-danger {
  color: #F56C6C;
}

.text-success {
  color: #67C23A;
}

.export-card {
  text-align: center;
  
  .export-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 15px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &.markdown-icon {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    &.json-icon {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
    }
  }
  
  h3 {
    margin: 0 0 10px;
    color: #303133;
    font-size: 18px;
  }
  
  p {
    color: #909399;
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 15px;
  }
  
  .export-actions {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
}

.stat-list {
  .stat-item {
    margin-bottom: 20px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .stat-item-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .stat-item-name {
      font-size: 14px;
      color: #303133;
      font-weight: 500;
    }
    
    .stat-item-count {
      font-size: 14px;
      color: #909399;
    }
  }
}

.quick-actions {
  padding: 10px 0;
}

.markdown-preview,
.json-preview {
  max-height: 500px;
  overflow-y: auto;
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  
  pre {
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
    color: #303133;
  }
}

.mr-1 {
  margin-right: 4px;
}
</style>
