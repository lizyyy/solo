<template>
  <el-container class="app-container">
    <el-header>
      <div class="header-left">
        <el-icon size="24"><Monitor /></el-icon>
        <span class="title">城市地下管廊 3D 巡检复核工具</span>
      </div>
      <div class="header-right">
        <el-button type="primary" size="small" @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入数据
        </el-button>
        <el-button size="small" @click="loadSampleData">
          <el-icon><Document /></el-icon>
          加载示例
        </el-button>
        <el-dropdown>
          <el-button size="small">
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="exportMarkdown">
                导出 Markdown 交班单
              </el-dropdown-item>
              <el-dropdown-item @click="exportJson">
                导出 JSON 明细
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" type="danger" @click="confirmClear">
          <el-icon><Delete /></el-icon>
          清空数据
        </el-button>
      </div>
    </el-header>

    <el-container>
      <el-aside width="320px">
        <el-tabs v-model="activeTab" class="aside-tabs">
          <el-tab-pane label="风险列表" name="risks">
            <div class="risk-list">
              <el-empty v-if="risks.length === 0" description="暂无风险数据" />
              <div 
                v-for="risk in risks" 
                :key="risk.id"
                class="risk-item"
                :class="{ active: selectedRisk?.id === risk.id }"
                @click="selectRisk(risk)"
              >
                <div class="risk-icon" :style="{ backgroundColor: getRiskColor(risk.type) }">
                  <el-icon v-if="risk.type === RiskTypes.OXYGEN_DEFICIENCY"><Warning /></el-icon>
                  <el-icon v-else-if="risk.type === RiskTypes.FLAMMABLE_GAS"><Fire /></el-icon>
                  <el-icon v-else-if="risk.type === RiskTypes.WATER_ACCUMULATION"><Watermelon /></el-icon>
                  <el-icon v-else><Document /></el-icon>
                </div>
                <div class="risk-info">
                  <div class="risk-title">{{ getRiskTitle(risk) }}</div>
                  <div class="risk-desc">{{ risk.message }}</div>
                  <div class="risk-status">
                    <el-tag v-if="risk.judgment === null" size="small" type="warning">待确认</el-tag>
                    <el-tag v-else-if="risk.judgment === 'confirm'" size="small" type="danger">已确认</el-tag>
                    <el-tag v-else-if="risk.judgment === 'dismiss'" size="small" type="success">已排除</el-tag>
                    <el-tag v-else size="small" type="info">延后处理</el-tag>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="数据统计" name="stats">
            <div class="stats-container">
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-card shadow="hover" class="stat-card">
                    <div class="stat-icon" style="background-color: #409eff">
                      <el-icon><OfficeBuilding /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-value">{{ sections.length }}</div>
                      <div class="stat-label">管廊分段</div>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="hover" class="stat-card">
                    <div class="stat-icon" style="background-color: #67c23a">
                      <el-icon><Cpu /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-value">{{ sensors.length }}</div>
                      <div class="stat-label">传感器</div>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
              <el-row :gutter="10" style="margin-top: 10px">
                <el-col :span="12">
                  <el-card shadow="hover" class="stat-card">
                    <div class="stat-icon" style="background-color: #e6a23c">
                      <el-icon><List /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-value">{{ tickets.length }}</div>
                      <div class="stat-label">巡检工单</div>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="hover" class="stat-card">
                    <div class="stat-icon" style="background-color: #909399">
                      <el-icon><Aim /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-value">{{ manholes.length }}</div>
                      <div class="stat-label">井盖记录</div>
                    </div>
                  </el-card>
                </el-col>
              </el-row>

              <el-divider>风险分布</el-divider>
              <div class="risk-stats">
                <div class="risk-stat-item">
                  <span class="dot" style="background-color: #f56c6c"></span>
                  <span>缺氧风险: {{ countRiskType(RiskTypes.OXYGEN_DEFICIENCY) }}</span>
                </div>
                <div class="risk-stat-item">
                  <span class="dot" style="background-color: #e6a23c"></span>
                  <span>可燃气体: {{ countRiskType(RiskTypes.FLAMMABLE_GAS) }}</span>
                </div>
                <div class="risk-stat-item">
                  <span class="dot" style="background-color: #409eff"></span>
                  <span>积水风险: {{ countRiskType(RiskTypes.WATER_ACCUMULATION) }}</span>
                </div>
                <div class="risk-stat-item">
                  <span class="dot" style="background-color: #909399"></span>
                  <span>未闭环工单: {{ countRiskType(RiskTypes.UNOPENED_TICKET) }}</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-aside>

      <el-main>
        <Tunnel3DViewer
          :sections="sections"
          :riskMarkers="risks"
          :sensors="sensors"
          :manholes="manholes"
          @sectionClick="onSectionClick"
          @riskClick="onRiskClick"
        />
      </el-main>
    </el-container>

    <el-dialog v-model="showImportDialog" title="导入数据" width="600px">
      <el-tabs v-model="importTab">
        <el-tab-pane label="全部数据" name="all">
          <el-upload
            class="upload-demo"
            drag
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持导入包含管廊分段、传感器、工单、井盖记录的 JSON 文件
              </div>
            </template>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="管廊分段" name="sections">
          <el-upload drag :auto-upload="false" :on-change="(f) => handleFileChange(f, 'sections')" :limit="1">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖放或点击上传管廊分段 JSON</div>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="传感器数据" name="sensors">
          <el-upload drag :auto-upload="false" :on-change="(f) => handleFileChange(f, 'sensors')" :limit="1">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖放或点击上传传感器 JSON</div>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="巡检工单" name="tickets">
          <el-upload drag :auto-upload="false" :on-change="(f) => handleFileChange(f, 'tickets')" :limit="1">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖放或点击上传工单 JSON</div>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="井盖记录" name="manholes">
          <el-upload drag :auto-upload="false" :on-change="(f) => handleFileChange(f, 'manholes')" :limit="1">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖放或点击上传井盖记录 JSON</div>
          </el-upload>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRiskDetail" title="风险详情" width="600px">
      <div v-if="selectedRisk" class="risk-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="风险类型">
            <el-tag :type="getRiskTagType(selectedRisk.type)">{{ getRiskTitle(selectedRisk) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="风险等级">
            <el-tag :type="selectedRisk.level === 'high' ? 'danger' : 'warning'">
              {{ selectedRisk.level === 'high' ? '高风险' : '中风险' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="管廊分段">
            {{ getSectionName(selectedRisk.sectionId) }}
          </el-descriptions-item>
          <el-descriptions-item label="详细描述">{{ selectedRisk.message }}</el-descriptions-item>
          <el-descriptions-item label="位置">
            X: {{ selectedRisk.position.x?.toFixed(1) }}, 
            Y: {{ selectedRisk.position.y?.toFixed(1) }}, 
            Z: {{ selectedRisk.position.z?.toFixed(1) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>来源数据</el-divider>
        <div v-if="sourceData" class="source-data">
          <el-descriptions :column="1" border size="small">
            <template v-if="selectedRisk.sourceType === 'sensor'">
              <el-descriptions-item label="传感器编号">{{ sourceData.code }}</el-descriptions-item>
              <el-descriptions-item label="氧含量">{{ sourceData.oxygenLevel }}%</el-descriptions-item>
              <el-descriptions-item label="可燃气体">{{ sourceData.flammableGasLevel }}%LEL</el-descriptions-item>
              <el-descriptions-item label="硫化氢">{{ sourceData.h2sLevel }}ppm</el-descriptions-item>
              <el-descriptions-item label="一氧化碳">{{ sourceData.coLevel }}ppm</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatTime(sourceData.lastUpdate) }}</el-descriptions-item>
            </template>
            <template v-else-if="selectedRisk.sourceType === 'ticket'">
              <el-descriptions-item label="工单编号">{{ sourceData.ticketNo }}</el-descriptions-item>
              <el-descriptions-item label="工单类型">{{ sourceData.inspectionType }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ formatStatus(sourceData.status) }}</el-descriptions-item>
              <el-descriptions-item label="巡检员">{{ sourceData.inspector || '未分配' }}</el-descriptions-item>
              <el-descriptions-item label="计划时间">{{ formatTime(sourceData.scheduledTime) }}</el-descriptions-item>
              <el-descriptions-item label="发现问题">{{ sourceData.findings || '无' }}</el-descriptions-item>
            </template>
          </el-descriptions>
        </div>
        <el-empty v-else description="暂无来源数据详情" :image-size="60" />

        <el-divider>人工改判</el-divider>
        <el-form label-width="100px">
          <el-form-item label="改判结果">
            <el-radio-group v-model="judgmentForm.judgment">
              <el-radio value="confirm">确认风险</el-radio>
              <el-radio value="dismiss">排除误报</el-radio>
              <el-radio value="defer">延后处理</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="改判人">
            <el-input v-model="judgmentForm.operator" placeholder="请输入姓名" />
          </el-form-item>
          <el-form-item label="备注说明">
            <el-input
              v-model="judgmentForm.remark"
              type="textarea"
              :rows="3"
              placeholder="请输入改判说明..."
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveJudgment">保存改判</el-button>
          </el-form-item>
        </el-form>

        <el-divider v-if="sectionNotes.length > 0">改判历史</el-divider>
        <div v-if="sectionNotes.length > 0" class="notes-history">
          <div v-for="note in sectionNotes" :key="note.id" class="note-item">
            <div class="note-header">
              <el-tag :type="getJudgmentTagType(note.judgment)" size="small">
                {{ formatJudgment(note.judgment) }}
              </el-tag>
              <span class="note-time">{{ formatTime(note.createdAt) }}</span>
            </div>
            <div class="note-operator">改判人: {{ note.operator || '未知' }}</div>
            <div class="note-remark" v-if="note.remark">{{ note.remark }}</div>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showSectionDetail" title="管廊分段详情" width="600px">
      <div v-if="selectedSection" class="section-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="分段名称">{{ selectedSection.name }}</el-descriptions-item>
          <el-descriptions-item label="分段编号">{{ selectedSection.code }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ selectedSection.description || '无' }}</el-descriptions-item>
          <el-descriptions-item label="尺寸">
            宽 {{ selectedSection.width }}m × 高 {{ selectedSection.height }}m
          </el-descriptions-item>
          <el-descriptions-item label="传感器数量">
            {{ selectedSection.sensors?.length || 0 }} 个
          </el-descriptions-item>
          <el-descriptions-item label="井盖数量">
            {{ selectedSection.manholes?.length || 0 }} 个
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>关联风险</el-divider>
        <div v-if="sectionRisks.length > 0" class="section-risks">
          <div 
            v-for="risk in sectionRisks" 
            :key="risk.id"
            class="risk-item"
            @click="selectRisk(risk); showSectionDetail = false"
          >
            <div class="risk-icon" :style="{ backgroundColor: getRiskColor(risk.type) }">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="risk-info">
              <div class="risk-title">{{ getRiskTitle(risk) }}</div>
              <div class="risk-desc">{{ risk.message }}</div>
            </div>
          </div>
        </div>
        <el-empty v-else description="该分段暂无风险" :image-size="60" />
      </div>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Monitor, Upload, Document, Download, ArrowDown, Delete,
  Warning, Fire, Watermelon, OfficeBuilding, Cpu, List, Aim,
  UploadFilled, Refresh, Grid
} from '@element-plus/icons-vue'
import Tunnel3DViewer from './components/Tunnel3DViewer.vue'
import { useDataStore } from './store'
import { useDataImporter, ImportTypes } from './utils/dataImporter'
import { useDataExporter } from './utils/dataExporter'
import { sampleData } from './utils/sampleData'
import { DataTypes, RiskTypes, RiskColors } from './models'

const store = useDataStore()
const importer = useDataImporter()
const exporter = useDataExporter()

const activeTab = ref('risks')
const importTab = ref('all')
const showImportDialog = ref(false)
const showRiskDetail = ref(false)
const showSectionDetail = ref(false)

const sections = ref([])
const risks = ref([])
const sensors = ref([])
const tickets = ref([])
const manholes = ref([])
const notes = ref([])

const selectedRisk = ref(null)
const selectedSection = ref(null)
const sourceData = ref(null)
const sectionNotes = ref([])
const sectionRisks = ref([])

const judgmentForm = ref({
  judgment: 'confirm',
  operator: '',
  remark: ''
})

const loadData = async () => {
  sections.value = await store.getItems(DataTypes.TUNNEL_SECTIONS)
  risks.value = await store.getItems(DataTypes.RISK_MARKERS)
  sensors.value = await store.getItems(DataTypes.GAS_SENSORS)
  tickets.value = await store.getItems(DataTypes.INSPECTION_TICKETS)
  manholes.value = await store.getItems(DataTypes.MANHOLE_RECORDS)
  notes.value = await store.getItems(DataTypes.JUDGMENT_NOTES)
}

const loadSampleData = async () => {
  try {
    await importer.importData(sampleData, ImportTypes.ALL)
    await loadData()
    ElMessage.success('示例数据加载成功！')
  } catch (error) {
    ElMessage.error('加载示例数据失败: ' + error.message)
  }
}

const handleFileChange = async (file, type = 'all') => {
  try {
    const importType = {
      'all': ImportTypes.ALL,
      'sections': ImportTypes.TUNNEL_SECTIONS,
      'sensors': ImportTypes.GAS_SENSORS,
      'tickets': ImportTypes.INSPECTION_TICKETS,
      'manholes': ImportTypes.MANHOLE_RECORDS
    }[type] || ImportTypes.ALL

    const result = await importer.importFromFile(file.raw, importType)
    await loadData()
    showImportDialog.value = false
    ElMessage.success(`导入成功: ${result.success} 条记录`)
  } catch (error) {
    ElMessage.error('导入失败: ' + error.message)
  }
}

const getRiskColor = (type) => {
  const colors = {
    [RiskTypes.OXYGEN_DEFICIENCY]: '#f56c6c',
    [RiskTypes.FLAMMABLE_GAS]: '#e6a23c',
    [RiskTypes.WATER_ACCUMULATION]: '#409eff',
    [RiskTypes.UNOPENED_TICKET]: '#909399'
  }
  return colors[type] || '#f56c6c'
}

const getRiskTitle = (risk) => {
  const titles = {
    [RiskTypes.OXYGEN_DEFICIENCY]: '缺氧风险',
    [RiskTypes.FLAMMABLE_GAS]: '可燃气体风险',
    [RiskTypes.WATER_ACCUMULATION]: '积水风险',
    [RiskTypes.UNOPENED_TICKET]: '未闭环工单'
  }
  return titles[risk.type] || '未知风险'
}

const getRiskTagType = (type) => {
  const types = {
    [RiskTypes.OXYGEN_DEFICIENCY]: 'danger',
    [RiskTypes.FLAMMABLE_GAS]: 'warning',
    [RiskTypes.WATER_ACCUMULATION]: 'primary',
    [RiskTypes.UNOPENED_TICKET]: 'info'
  }
  return types[type] || 'danger'
}

const countRiskType = (type) => {
  return risks.value.filter(r => r.type === type).length
}

const getSectionName = (sectionId) => {
  const section = sections.value.find(s => s.id === sectionId)
  return section ? section.name : '未知分段'
}

const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

const formatStatus = (status) => {
  const map = {
    'pending': '待处理',
    'in_progress': '进行中',
    'completed': '已完成',
    'closed': '已关闭'
  }
  return map[status] || status
}

const formatJudgment = (judgment) => {
  const map = {
    'confirm': '确认风险',
    'dismiss': '排除误报',
    'defer': '延后处理'
  }
  return map[judgment] || judgment
}

const getJudgmentTagType = (judgment) => {
  const map = {
    'confirm': 'danger',
    'dismiss': 'success',
    'defer': 'warning'
  }
  return map[judgment] || 'info'
}

const selectRisk = (risk) => {
  selectedRisk.value = risk
  showRiskDetail.value = true

  if (risk.sourceType === 'sensor') {
    sourceData.value = sensors.value.find(s => s.id === risk.sourceId)
  } else if (risk.sourceType === 'ticket') {
    sourceData.value = tickets.value.find(t => t.id === risk.sourceId)
  } else {
    sourceData.value = null
  }

  sectionNotes.value = notes.value.filter(n => n.riskId === risk.id)

  judgmentForm.value = {
    judgment: risk.judgment || 'confirm',
    operator: '',
    remark: ''
  }
}

const onRiskClick = (risk) => {
  selectRisk(risk)
}

const onSectionClick = (section) => {
  selectedSection.value = section
  showSectionDetail.value = true
  sectionRisks.value = risks.value.filter(r => r.sectionId === section.id)
}

const saveJudgment = async () => {
  if (!selectedRisk.value) return

  try {
    await store.addJudgmentNote({
      riskId: selectedRisk.value.id,
      sectionId: selectedRisk.value.sectionId,
      judgment: judgmentForm.value.judgment,
      remark: judgmentForm.value.remark,
      operator: judgmentForm.value.operator,
      createdAt: new Date().toISOString()
    })

    await loadData()
    sectionNotes.value = notes.value.filter(n => n.riskId === selectedRisk.value.id)
    selectedRisk.value.judgment = judgmentForm.value.judgment

    ElMessage.success('改判记录已保存')
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

const exportMarkdown = async () => {
  try {
    const md = await exporter.exportMarkdownHandover()
    const filename = `巡检交班单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.md`
    exporter.downloadFile(md, filename, 'text/markdown')
    ElMessage.success('Markdown 交班单导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

const exportJson = async () => {
  try {
    const json = await exporter.exportJsonDetails()
    const filename = `巡检明细_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
    exporter.downloadFile(json, filename, 'application/json')
    ElMessage.success('JSON 明细导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

const confirmClear = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有数据吗？此操作不可恢复！',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await store.clearAll()
    await loadData()
    ElMessage.success('数据已清空')
  } catch {
  }
}

onMounted(async () => {
  await store.init()
  await loadData()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.el-header {
  background-color: #304156;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  gap: 10px;
}

.el-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.aside-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.aside-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  background-color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.risk-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.risk-item.active {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.risk-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  flex-shrink: 0;
}

.risk-info {
  flex: 1;
  min-width: 0;
}

.risk-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.risk-desc {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-status {
  margin-top: 6px;
}

.stats-container {
  padding: 10px 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 12px;
  color: #606266;
}

.risk-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.risk-detail, .section-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.source-data {
  background-color: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
}

.notes-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note-item {
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 6px;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-time {
  font-size: 12px;
  color: #909399;
}

.note-operator {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.note-remark {
  margin-top: 8px;
  padding: 8px;
  background-color: #fff;
  border-radius: 4px;
  font-size: 13px;
  color: #303133;
}

.section-risks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
