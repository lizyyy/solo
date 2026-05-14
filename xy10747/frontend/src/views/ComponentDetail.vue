<template>
  <div class="container">
    <div class="page-header">
      <div style="display: flex; align-items: center; gap: 16px;">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h1 class="page-title">{{ component?.name }}</h1>
        <el-tag v-if="component?.type">{{ component.type }}</el-tag>
      </div>
      <div style="display: flex; gap: 12px;">
        <el-button @click="showExportDialog = true">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="处理链" name="chain">
        <div class="card">
          <div class="detail-section">
            <div class="detail-section-title">处理链可视化</div>
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
              <el-button type="primary" @click="createChain" :disabled="creatingChain">
                创建处理链
              </el-button>
              <el-button @click="replayChain" :disabled="!currentChain || replaying">
                <el-icon v-if="replaying"><Loading /></el-icon>
                回放处理链
              </el-button>
              <el-button @click="loadChainTrace" :disabled="!currentChain">
                追溯详情
              </el-button>
            </div>

            <div v-if="currentChain" class="chain-visualization">
              <div class="chain-steps">
                <div class="chain-line">
                  <div class="chain-line-progress" :style="{ width: chainProgress + '%' }"></div>
                </div>
                <div v-for="(step, index) in chainSteps" :key="index" class="chain-step">
                  <div class="step-icon" :class="getStepClass(step.status)">
                    {{ getStepIcon(step.status) }}
                  </div>
                  <div class="step-name">{{ step.name }}</div>
                  <div class="step-time" v-if="step.completed_at">
                    {{ formatTime(step.completed_at) }}
                  </div>
                </div>
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <span class="status-tag" :class="getStatusClass(currentChain.status)">
                  状态: {{ currentChain.status }}
                </span>
                <span style="margin-left: 16px; color: #909399;">
                  当前步骤: {{ currentChain.current_step || '-' }}
                </span>
              </div>
            </div>

            <el-empty v-else description="暂无处理链，请先创建" />
          </div>

          <div v-if="chainTrace" class="detail-section">
            <div class="detail-section-title">追溯详情</div>
            <div class="trace-timeline">
              <div v-if="chainTrace.schema" class="trace-item">
                <div class="trace-dot step-completed">📋</div>
                <div class="trace-content">
                  <div class="trace-title">Schema 验证</div>
                  <div class="trace-meta">
                    <span>版本: {{ chainTrace.schema.version }}</span>
                    <span>创建时间: {{ formatDate(chainTrace.schema.created_at) }}</span>
                  </div>
                  <div class="json-preview">{{ formatJson(chainTrace.schema.schema_content) }}</div>
                </div>
              </div>

              <div v-if="chainTrace.property_panel" class="trace-item">
                <div class="trace-dot step-completed">⚙️</div>
                <div class="trace-content">
                  <div class="trace-title">属性面板处理</div>
                  <div class="trace-meta">
                    <span>版本: {{ chainTrace.property_panel.version }}</span>
                    <span>更新时间: {{ formatDate(chainTrace.property_panel.updated_at) }}</span>
                  </div>
                  <el-button type="primary" link size="small" @click="editPropertyPanel(chainTrace.property_panel)">
                    编辑属性面板（修改后将重新计算）
                  </el-button>
                  <div class="json-preview" style="margin-top: 12px;">{{ formatJson(chainTrace.property_panel.panel_config) }}</div>
                </div>
              </div>

              <div v-if="chainTrace.dependency_check" class="trace-item">
                <div class="trace-dot" :class="getStepClass(chainTrace.dependency_check.status)">🔍</div>
                <div class="trace-content">
                  <div class="trace-title">
                    依赖检查
                    <span class="status-tag" :class="getStatusClass(chainTrace.dependency_check.status)">
                      {{ chainTrace.dependency_check.status }}
                    </span>
                  </div>
                  <div class="trace-meta">
                    <span>检查ID: {{ chainTrace.dependency_check.check_id }}</span>
                    <span>重试次数: {{ chainTrace.dependency_check.retry_count }}</span>
                  </div>
                  <div v-if="chainTrace.dependency_check.dependencies" class="json-preview">
                    {{ formatJson(chainTrace.dependency_check.dependencies) }}
                  </div>
                  <div v-if="chainTrace.dependency_check.errors" style="color: #f56c6c; margin-top: 12px;">
                    错误: {{ formatJson(chainTrace.dependency_check.errors) }}
                  </div>
                  <div v-if="chainTrace.dependency_check.warnings" style="color: #e6a23c; margin-top: 12px;">
                    警告: {{ formatJson(chainTrace.dependency_check.warnings) }}
                  </div>
                </div>
              </div>

              <div v-if="chainTrace.example_preview" class="trace-item">
                <div class="trace-dot" :class="getStepClass(chainTrace.example_preview.status)">🖼️</div>
                <div class="trace-content">
                  <div class="trace-title">
                    示例预览
                    <span class="status-tag" :class="getStatusClass(chainTrace.example_preview.status)">
                      {{ chainTrace.example_preview.status }}
                    </span>
                  </div>
                  <div class="trace-meta">
                    <span>预览ID: {{ chainTrace.example_preview.preview_id }}</span>
                    <span>重试次数: {{ chainTrace.example_preview.retry_count }}</span>
                  </div>
                  <div v-if="chainTrace.example_preview.preview_data" class="json-preview">
                    {{ formatJson(chainTrace.example_preview.preview_data) }}
                  </div>
                  <div v-if="chainTrace.example_preview.errors" style="color: #f56c6c; margin-top: 12px;">
                    错误: {{ formatJson(chainTrace.example_preview.errors) }}
                  </div>
                </div>
              </div>

              <div v-if="chainTrace.compatibility_report" class="trace-item">
                <div class="trace-dot" :class="getStepClass(chainTrace.compatibility_report.status)">✅</div>
                <div class="trace-content">
                  <div class="trace-title">
                    兼容报告
                    <span class="status-tag" :class="getStatusClass(chainTrace.compatibility_report.status)">
                      {{ chainTrace.compatibility_report.status }}
                    </span>
                    <span v-if="chainTrace.compatibility_report.manual_override" class="manual-badge">人工修正</span>
                  </div>
                  <div class="trace-meta" v-if="chainTrace.compatibility_report.manual_override">
                    <span>操作人: {{ chainTrace.compatibility_report.override_by }}</span>
                    <span>备注: {{ chainTrace.compatibility_report.override_notes }}</span>
                  </div>
                  <el-button type="warning" link size="small" @click="manualEditReport(chainTrace.compatibility_report)">
                    人工修正报告
                  </el-button>
                  <div v-if="chainTrace.compatibility_report.report_content" class="json-preview" style="margin-top: 12px;">
                    {{ formatJson(chainTrace.compatibility_report.report_content) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="属性面板" name="property">
        <div class="card">
          <div class="detail-section">
            <div class="detail-section-title">
              属性面板列表
              <el-button type="primary" size="small" style="margin-left: 16px;" @click="showCreatePanelDialog = true">
                新增属性面板
              </el-button>
            </div>
            <el-table :data="propertyPanels" stripe style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="schema_version" label="Schema版本" width="120" />
              <el-table-column prop="version" label="面板版本" width="100" />
              <el-table-column prop="created_at" label="创建时间" width="180">
                <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="editPropertyPanel(row)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="版本发布" name="version">
        <div class="card">
          <div class="detail-section">
            <div class="detail-section-title">
              版本列表
              <el-button type="primary" size="small" style="margin-left: 16px;" @click="showCreateVersionDialog = true">
                发布新版本
              </el-button>
            </div>
            <el-table :data="versions" stripe style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="version" label="版本号" width="120" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'released' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="release_notes" label="发布说明" show-overflow-tooltip />
              <el-table-column prop="created_at" label="创建时间" width="180">
                <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="历史记录" name="history">
        <div class="card">
          <div class="detail-section">
            <div class="detail-section-title">处理链历史</div>
            <el-table :data="processingChains" stripe style="width: 100%">
              <el-table-column prop="chain_id" label="Chain ID" min-width="150" />
              <el-table-column prop="version" label="组件版本" width="120" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <span class="status-tag" :class="getStatusClass(row.status)">{{ row.status }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="current_step" label="当前步骤" width="150" />
              <el-table-column prop="created_at" label="创建时间" width="180">
                <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="selectChain(row)">查看</el-button>
                  <el-button type="success" link size="small" @click="replaySpecificChain(row)">回放</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showCreatePanelDialog" title="新增属性面板" width="600px">
      <el-form :model="panelForm" label-width="100px">
        <el-form-item label="Schema版本">
          <el-input v-model="panelForm.schema_version" placeholder="例如: 1.0.0" />
        </el-form-item>
        <el-form-item label="面板配置">
          <el-input
            v-model="panelForm.panel_config"
            type="textarea"
            :rows="10"
            placeholder="请输入JSON格式的面板配置"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreatePanelDialog = false">取消</el-button>
        <el-button type="primary" @click="createPropertyPanel">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditPanelDialog" title="编辑属性面板" width="600px">
      <el-alert
        title="修改属性面板后，相关的依赖检查、示例预览和兼容报告将自动重新计算"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px;"
      />
      <el-form :model="editPanelForm" label-width="100px">
        <el-form-item label="面板配置">
          <el-input
            v-model="editPanelForm.panel_config"
            type="textarea"
            :rows="10"
            placeholder="请输入JSON格式的面板配置"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPanelDialog = false">取消</el-button>
        <el-button type="primary" @click="updatePropertyPanel">确定更新</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreateVersionDialog" title="发布新版本" width="600px">
      <el-form :model="versionForm" label-width="100px">
        <el-form-item label="版本号">
          <el-input v-model="versionForm.version" placeholder="例如: 1.0.0" />
        </el-form-item>
        <el-form-item label="发布说明">
          <el-input v-model="versionForm.release_notes" type="textarea" :rows="4" placeholder="请输入发布说明" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="versionForm.status" style="width: 100%">
            <el-option label="草稿" value="draft" />
            <el-option label="已发布" value="released" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateVersionDialog = false">取消</el-button>
        <el-button type="primary" @click="createVersion">发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showManualEditDialog" title="人工修正兼容报告" width="600px">
      <el-form :model="manualEditForm" label-width="100px">
        <el-form-item label="状态">
          <el-select v-model="manualEditForm.status" style="width: 100%">
            <el-option label="通过" value="completed" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="修正备注">
          <el-input v-model="manualEditForm.override_notes" type="textarea" :rows="3" placeholder="请输入修正备注" />
        </el-form-item>
        <el-form-item label="报告内容">
          <el-input
            v-model="manualEditForm.report_content"
            type="textarea"
            :rows="6"
            placeholder="请输入JSON格式的报告内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showManualEditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitManualEdit">提交修正</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showExportDialog" title="导出数据" width="500px">
      <el-form :model="exportForm" label-width="100px">
        <el-form-item label="导出版本">
          <el-select v-model="exportForm.version" style="width: 100%" clearable placeholder="全部版本">
            <el-option v-for="v in versions" :key="v.version" :label="v.version" :value="v.version" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="exportComponent">导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download, Loading } from '@element-plus/icons-vue'
import { componentAPI } from '../api'

const route = useRoute()
const router = useRouter()

const componentId = computed(() => route.params.id)
const activeTab = ref('chain')
const component = ref(null)
const processingChains = ref([])
const propertyPanels = ref([])
const versions = ref([])
const currentChain = ref(null)
const chainTrace = ref(null)
const lastActionHash = ref(null)

const creatingChain = ref(false)
const replaying = ref(false)

const showCreatePanelDialog = ref(false)
const showEditPanelDialog = ref(false)
const showCreateVersionDialog = ref(false)
const showManualEditDialog = ref(false)
const showExportDialog = ref(false)

const panelForm = ref({ schema_version: '', panel_config: '{}' })
const editPanelForm = ref({ id: null, panel_config: '' })
const versionForm = ref({ version: '', release_notes: '', status: 'draft' })
const manualEditForm = ref({ id: null, status: '', override_notes: '', report_content: '' })
const exportForm = ref({ version: '' })

const chainSteps = computed(() => {
  if (!currentChain.value?.steps) {
    return [
      { name: 'schema_validation', status: 'pending' },
      { name: 'property_panel_processing', status: 'pending' },
      { name: 'dependency_check', status: 'pending' },
      { name: 'example_preview', status: 'pending' },
      { name: 'compatibility_report', status: 'pending' }
    ]
  }
  return currentChain.value.steps
})

const chainProgress = computed(() => {
  const steps = chainSteps.value
  const completed = steps.filter(s => s.status === 'completed').length
  return (completed / steps.length) * 100
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const formatJson = (obj) => {
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj)
    } catch (e) {
      return obj
    }
  }
  return JSON.stringify(obj, null, 2)
}

const getStepClass = (status) => {
  const map = {
    pending: 'step-pending',
    running: 'step-running',
    completed: 'step-completed',
    failed: 'step-failed'
  }
  return map[status] || 'step-pending'
}

const getStatusClass = (status) => {
  const map = {
    pending: 'status-pending',
    running: 'status-running',
    idle: 'status-pending',
    completed: 'status-success',
    failed: 'status-failed'
  }
  return map[status] || 'status-pending'
}

const getStepIcon = (status) => {
  const map = { pending: '○', running: '⚡', completed: '✓', failed: '✗' }
  return map[status] || '○'
}

const goBack = () => router.push('/')

const loadComponent = async () => {
  const res = await componentAPI.get(componentId.value)
  component.value = res.data
}

const loadProcessingChains = async () => {
  const res = await componentAPI.getProcessingChains(componentId.value)
  processingChains.value = res.data
  if (res.data.length > 0 && !currentChain.value) {
    currentChain.value = res.data[0]
  }
}

const loadPropertyPanels = async () => {
  const res = await componentAPI.getPropertyPanels(componentId.value)
  propertyPanels.value = res.data
}

const loadVersions = async () => {
  const res = await componentAPI.getVersions(componentId.value)
  versions.value = res.data
}

const createChain = async () => {
  creatingChain.value = true
  try {
    const res = await componentAPI.createProcessingChain(componentId.value, {
      version: component.value.current_version || '1.0.0',
      chain_id: `chain_${Date.now()}`
    })
    currentChain.value = res.data
    ElMessage.success('处理链创建成功')
    loadProcessingChains()
  } catch (error) {
    ElMessage.error('创建失败')
  } finally {
    creatingChain.value = false
  }
}

const replayChain = async () => {
  if (!currentChain.value) return
  replaying.value = true
  try {
    const res = await componentAPI.replayChain(currentChain.value.chain_id, lastActionHash.value)
    currentChain.value = res.data
    lastActionHash.value = res.data.last_action_hash
    ElMessage.success('回放成功')
    if (chainTrace.value) {
      await loadChainTrace()
    }
  } catch (error) {
    ElMessage.error('回放失败')
  } finally {
    replaying.value = false
  }
}

const replaySpecificChain = async (chain) => {
  currentChain.value = chain
  await replayChain()
}

const selectChain = (chain) => {
  currentChain.value = chain
  activeTab.value = 'chain'
}

const loadChainTrace = async () => {
  if (!currentChain.value) return
  const res = await componentAPI.getChainTrace(currentChain.value.chain_id)
  chainTrace.value = res.data
}

const createPropertyPanel = async () => {
  if (!panelForm.value.schema_version) {
    ElMessage.warning('请输入Schema版本')
    return
  }
  try {
    let config
    try {
      config = JSON.parse(panelForm.value.panel_config)
    } catch (e) {
      ElMessage.error('面板配置必须是有效的JSON格式')
      return
    }
    await componentAPI.createPropertyPanel(componentId.value, {
      schema_version: panelForm.value.schema_version,
      panel_config: config
    })
    ElMessage.success('创建成功')
    showCreatePanelDialog.value = false
    panelForm.value = { schema_version: '', panel_config: '{}' }
    loadPropertyPanels()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const editPropertyPanel = (panel) => {
  editPanelForm.value = {
    id: panel.id,
    panel_config: typeof panel.panel_config === 'string'
      ? panel.panel_config
      : JSON.stringify(panel.panel_config, null, 2)
  }
  showEditPanelDialog.value = true
}

const updatePropertyPanel = async () => {
  try {
    let config
    try {
      config = JSON.parse(editPanelForm.value.panel_config)
    } catch (e) {
      ElMessage.error('面板配置必须是有效的JSON格式')
      return
    }
    await componentAPI.updatePropertyPanel(editPanelForm.value.id, { panel_config: config })
    ElMessage.success('更新成功，相关记录正在重新计算')
    showEditPanelDialog.value = false
    loadPropertyPanels()
    if (currentChain.value) {
      setTimeout(() => replayChain(), 500)
    }
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

const createVersion = async () => {
  if (!versionForm.value.version) {
    ElMessage.warning('请输入版本号')
    return
  }
  try {
    await componentAPI.createVersion(componentId.value, versionForm.value)
    ElMessage.success('版本发布成功')
    showCreateVersionDialog.value = false
    versionForm.value = { version: '', release_notes: '', status: 'draft' }
    loadVersions()
  } catch (error) {
    ElMessage.error('发布失败')
  }
}

const manualEditReport = (report) => {
  manualEditForm.value = {
    id: report.id,
    status: report.status,
    override_notes: report.override_notes || '',
    report_content: typeof report.report_content === 'string'
      ? report.report_content
      : JSON.stringify(report.report_content || {}, null, 2)
  }
  showManualEditDialog.value = true
}

const submitManualEdit = async () => {
  if (!manualEditForm.value.override_notes) {
    ElMessage.warning('请输入修正备注')
    return
  }
  try {
    let reportContent
    try {
      reportContent = JSON.parse(manualEditForm.value.report_content)
    } catch (e) {
      ElMessage.error('报告内容必须是有效的JSON格式')
      return
    }
    await componentAPI.manualUpdateReport(manualEditForm.value.id, {
      manual_override: true,
      override_notes: manualEditForm.value.override_notes,
      report_content: reportContent,
      status: manualEditForm.value.status
    })
    ElMessage.success('修正成功')
    showManualEditDialog.value = false
    if (chainTrace.value) {
      loadChainTrace()
    }
  } catch (error) {
    ElMessage.error('修正失败')
  }
}

const exportComponent = async () => {
  try {
    const res = await componentAPI.export({
      component_ids: [componentId.value],
      version: exportForm.value.version || undefined
    })
    const blob = new Blob([res.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${component.value.name}_export_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
    showExportDialog.value = false
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

onMounted(async () => {
  await loadComponent()
  await loadProcessingChains()
  await loadPropertyPanels()
  await loadVersions()
})
</script>
