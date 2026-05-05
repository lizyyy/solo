<template>
  <div class="export-container">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon size="24" color="#409eff"><Document /></el-icon>
              <span class="card-title">导出 Markdown 复核单</span>
            </div>
          </template>
          
          <p class="card-desc">
            导出格式化的复核单，包含风险评估详情、关联告警和工单信息，适合打印或存档。
          </p>

          <el-form :model="markdownForm" label-width="100px" style="margin-top: 20px">
            <el-form-item label="导出范围">
              <el-radio-group v-model="markdownForm.scope">
                <el-radio value="all">全部评估</el-radio>
                <el-radio value="filter">筛选后</el-radio>
                <el-radio value="selected">指定ID</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="指定ID" v-if="markdownForm.scope === 'selected'">
              <el-input
                v-model="markdownForm.assessment_ids"
                type="textarea"
                :rows="3"
                placeholder="请输入评估ID，多个用逗号分隔&#10;例如: 1,2,3,4,5"
              />
            </el-form-item>

            <el-form-item label="风险等级" v-if="markdownForm.scope === 'filter'">
              <el-select v-model="markdownForm.final_risk_level" multiple placeholder="全部等级" clearable style="width: 100%">
                <el-option label="严重" value="严重" />
                <el-option label="高" value="高" />
                <el-option label="中" value="中" />
                <el-option label="低" value="低" />
              </el-select>
            </el-form-item>

            <el-form-item label="包含内容">
              <el-checkbox-group v-model="markdownForm.include">
                <el-checkbox label="images" true-value="images">包含图片引用</el-checkbox>
                <el-checkbox label="alarms" true-value="alarms">关联告警</el-checkbox>
                <el-checkbox label="work_orders" true-value="work_orders">关联工单</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>

          <el-button 
            type="primary" 
            @click="handleExportMarkdown" 
            :loading="exportingMarkdown"
            style="width: 100%; margin-top: 10px"
          >
            <el-icon><Download /></el-icon>
            导出 Markdown
          </el-button>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon size="24" color="#67c23a"><DataAnalysis /></el-icon>
              <span class="card-title">导出 JSON 明细</span>
            </div>
          </template>
          
          <p class="card-desc">
            导出完整的结构化数据，包含所有字段和关联信息，适合数据备份或进一步分析。
          </p>

          <el-form :model="jsonForm" label-width="100px" style="margin-top: 20px">
            <el-form-item label="导出范围">
              <el-radio-group v-model="jsonForm.scope">
                <el-radio value="all">全部评估</el-radio>
                <el-radio value="filter">筛选后</el-radio>
                <el-radio value="selected">指定ID</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="指定ID" v-if="jsonForm.scope === 'selected'">
              <el-input
                v-model="jsonForm.assessment_ids"
                type="textarea"
                :rows="3"
                placeholder="请输入评估ID，多个用逗号分隔&#10;例如: 1,2,3,4,5"
              />
            </el-form-item>

            <el-form-item label="风险等级" v-if="jsonForm.scope === 'filter'">
              <el-select v-model="jsonForm.final_risk_level" multiple placeholder="全部等级" clearable style="width: 100%">
                <el-option label="严重" value="严重" />
                <el-option label="高" value="高" />
                <el-option label="中" value="中" />
                <el-option label="低" value="低" />
              </el-select>
            </el-form-item>

            <el-form-item label="导出字段">
              <el-checkbox-group v-model="jsonForm.include">
                <el-checkbox label="basic" true-value="basic">基本信息</el-checkbox>
                <el-checkbox label="ai_result" true-value="ai_result">AI评估结果</el-checkbox>
                <el-checkbox label="manual" true-value="manual">人工改判</el-checkbox>
                <el-checkbox label="images" true-value="images">图片信息</el-checkbox>
                <el-checkbox label="alarms" true-value="alarms">关联告警</el-checkbox>
                <el-checkbox label="work_orders" true-value="work_orders">关联工单</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>

          <el-button 
            type="success" 
            @click="handleExportJson" 
            :loading="exportingJson"
            style="width: 100%; margin-top: 10px"
          >
            <el-icon><Download /></el-icon>
            导出 JSON
          </el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px">
      <template #header>
        <span class="card-title">导出历史</span>
      </template>
      
      <el-table :data="exportHistory" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.type === 'markdown' ? 'primary' : 'success'" size="small">
              {{ row.type === 'markdown' ? 'Markdown' : 'JSON' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="scope" label="范围" width="100">
          <template #default="{ row }">
            <span v-if="row.scope === 'all'">全部</span>
            <span v-else-if="row.scope === 'filter'">筛选</span>
            <span v-else>指定ID</span>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="记录数" width="100">
          {{ row.count }} 条
        </el-table-column>
        <el-table-column prop="created_at" label="导出时间" width="180">
          {{ formatDate(row.created_at) }}
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleDownloadHistory(row)">
              下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { exportMarkdown, exportJson } from '@/api/export'
import { Document, DataAnalysis, Download } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const exportingMarkdown = ref(false)
const exportingJson = ref(false)

const markdownForm = reactive({
  scope: 'all',
  assessment_ids: '',
  final_risk_level: [] as string[],
  include: ['images', 'alarms', 'work_orders'],
})

const jsonForm = reactive({
  scope: 'all',
  assessment_ids: '',
  final_risk_level: [] as string[],
  include: ['basic', 'ai_result', 'manual', 'images', 'alarms', 'work_orders'],
})

const exportHistory = ref([
  { id: 1, type: 'markdown', scope: 'all', count: 15, created_at: '2024-01-15 14:30:00' },
  { id: 2, type: 'json', scope: 'selected', count: 5, created_at: '2024-01-14 10:20:00' },
])

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const parseIds = (idsStr: string): number[] => {
  if (!idsStr.trim()) return []
  return idsStr.split(',')
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .map(s => parseInt(s, 10))
}

const handleExportMarkdown = async () => {
  exportingMarkdown.value = true
  
  try {
    let assessmentIds: number[] | undefined
    
    if (markdownForm.scope === 'selected') {
      assessmentIds = parseIds(markdownForm.assessment_ids)
      if (assessmentIds.length === 0) {
        ElMessage.warning('请输入有效的评估ID')
        return
      }
    }
    
    const result = await exportMarkdown({
      assessment_ids: assessmentIds,
      final_risk_level: markdownForm.scope === 'filter' && markdownForm.final_risk_level.length > 0 
        ? markdownForm.final_risk_level 
        : undefined,
      include_images: markdownForm.include.includes('images'),
      include_alarms: markdownForm.include.includes('alarms'),
      include_work_orders: markdownForm.include.includes('work_orders'),
    })
    
    const blob = new Blob([result.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `复核单_${dayjs().format('YYYYMMDD_HHmmss')}.md`
    link.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('Markdown 导出成功')
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  } finally {
    exportingMarkdown.value = false
  }
}

const handleExportJson = async () => {
  exportingJson.value = true
  
  try {
    let assessmentIds: number[] | undefined
    
    if (jsonForm.scope === 'selected') {
      assessmentIds = parseIds(jsonForm.assessment_ids)
      if (assessmentIds.length === 0) {
        ElMessage.warning('请输入有效的评估ID')
        return
      }
    }
    
    const result = await exportJson({
      assessment_ids: assessmentIds,
      final_risk_level: jsonForm.scope === 'filter' && jsonForm.final_risk_level.length > 0 
        ? jsonForm.final_risk_level 
        : undefined,
      include_basic: jsonForm.include.includes('basic'),
      include_ai_result: jsonForm.include.includes('ai_result'),
      include_manual: jsonForm.include.includes('manual'),
      include_images: jsonForm.include.includes('images'),
      include_alarms: jsonForm.include.includes('alarms'),
      include_work_orders: jsonForm.include.includes('work_orders'),
    })
    
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `风险评估明细_${dayjs().format('YYYYMMDD_HHmmss')}.json`
    link.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('JSON 导出成功')
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  } finally {
    exportingJson.value = false
  }
}

const handleDownloadHistory = (row: any) => {
  ElMessage.info('历史下载功能演示')
}
</script>

<style scoped>
.export-container {
  min-height: 100%;
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.card-desc {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}
</style>
