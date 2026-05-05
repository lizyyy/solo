<template>
  <div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon style="margin-right: 8px; vertical-align: middle;"><Document /></el-icon>
              导出 Markdown 审评交接单
            </span>
          </div>
        </template>
        <p style="color: #606266; margin-bottom: 16px; font-size: 14px;">
          生成完整的审评交接单，包含盲样明细、风险检测结果、复核备注等信息，方便打印或存档。
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <el-button type="primary" @click="previewMarkdown">
            <el-icon style="margin-right: 6px;"><View /></el-icon>
            预览
          </el-button>
          <el-button type="success" @click="exportMarkdown">
            <el-icon style="margin-right: 6px;"><Download /></el-icon>
            导出文件
          </el-button>
        </div>
      </el-card>

      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon style="margin-right: 8px; vertical-align: middle;"><DataAnalysis /></el-icon>
              导出 JSON 审计明细
            </span>
          </div>
        </template>
        <p style="color: #606266; margin-bottom: 16px; font-size: 14px;">
          导出完整的结构化数据，包含所有盲样、风险、照片和备注信息，适用于数据备份和进一步分析。
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <el-button type="primary" @click="previewJSON">
            <el-icon style="margin-right: 6px;"><View /></el-icon>
            预览
          </el-button>
          <el-button type="success" @click="exportJSON">
            <el-icon style="margin-right: 6px;"><Download /></el-icon>
            导出文件
          </el-button>
        </div>
      </el-card>
    </div>

    <el-card shadow="hover" style="margin-top: 24px;">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon style="margin-right: 8px; vertical-align: middle;"><InfoFilled /></el-icon>
            导出内容预览
          </span>
        </div>
      </template>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">盲样数量</div>
          <div class="stat-number" style="color: #409eff;">{{ samples.length }}</div>
          <div class="stat-label">条记录</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">风险项</div>
          <div class="stat-number" style="color: #f56c6c;">{{ risks.length }}</div>
          <div class="stat-label">项检测</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">照片数量</div>
          <div class="stat-number" style="color: #67c23a;">{{ photos.length }}</div>
          <div class="stat-label">张</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">备注记录</div>
          <div class="stat-number" style="color: #e6a23c;">{{ Object.keys(remarks).length }}</div>
          <div class="stat-label">条</div>
        </div>
      </div>

      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">风险等级分布:</h4>
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <el-tag type="danger" size="large">
          高风险: {{ risks.filter(r => r.level === 'high').length }} 项
        </el-tag>
        <el-tag type="warning" size="large">
          中风险: {{ risks.filter(r => r.level === 'medium').length }} 项
        </el-tag>
        <el-tag type="success" size="large">
          低风险: {{ risks.filter(r => r.level === 'low').length }} 项
        </el-tag>
      </div>
    </el-card>

    <el-dialog v-model="markdownPreviewVisible" title="Markdown 审评交接单预览" width="900px">
      <div class="preview-content">{{ markdownPreview }}</div>
      <template #footer>
        <el-button @click="markdownPreviewVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyToClipboard(markdownPreview)">
          <el-icon style="margin-right: 6px;"><CopyDocument /></el-icon>
          复制内容
        </el-button>
        <el-button type="success" @click="exportMarkdown">
          <el-icon style="margin-right: 6px;"><Download /></el-icon>
          导出文件
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="jsonPreviewVisible" title="JSON 审计明细预览" width="900px">
      <div class="preview-content">{{ jsonPreview }}</div>
      <template #footer>
        <el-button @click="jsonPreviewVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyToClipboard(jsonPreview)">
          <el-icon style="margin-right: 6px;"><CopyDocument /></el-icon>
          复制内容
        </el-button>
        <el-button type="success" @click="exportJSON">
          <el-icon style="margin-right: 6px;"><Download /></el-icon>
          导出文件
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { generateMarkdownReport, generateJSONAudit } from '../utils/exportHelper'
import dayjs from 'dayjs'

const props = defineProps({
  samples: {
    type: Array,
    default: () => []
  },
  risks: {
    type: Array,
    default: () => []
  },
  remarks: {
    type: Object,
    default: () => ({})
  },
  reviewStatus: {
    type: Object,
    default: () => ({})
  },
  photos: {
    type: Array,
    default: () => []
  }
})

const electronAPI = window.electronAPI || {}

const markdownPreviewVisible = ref(false)
const jsonPreviewVisible = ref(false)
const markdownPreview = ref('')
const jsonPreview = ref('')

const previewMarkdown = () => {
  if (props.samples.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  try {
    markdownPreview.value = generateMarkdownReport({
      samples: props.samples,
      risks: props.risks,
      remarks: props.remarks,
      reviewStatus: props.reviewStatus,
      photos: props.photos
    })
    markdownPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(`生成预览失败: ${error.message}`)
  }
}

const previewJSON = () => {
  if (props.samples.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  try {
    jsonPreview.value = generateJSONAudit({
      samples: props.samples,
      risks: props.risks,
      remarks: props.remarks,
      reviewStatus: props.reviewStatus,
      photos: props.photos
    })
    jsonPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(`生成预览失败: ${error.message}`)
  }
}

const exportMarkdown = async () => {
  if (props.samples.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  try {
    const content = generateMarkdownReport({
      samples: props.samples,
      risks: props.risks,
      remarks: props.remarks,
      reviewStatus: props.reviewStatus,
      photos: props.photos
    })

    const defaultName = `审评交接单_${dayjs().format('YYYYMMDD_HHmmss')}.md`
    
    const filePath = await electronAPI.saveFile(defaultName, [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ])

    if (filePath) {
      const result = await electronAPI.writeFile(filePath, content)
      if (result.success) {
        ElMessage.success(`文件已导出: ${filePath}`)
        markdownPreviewVisible.value = false
      } else {
        throw new Error(result.error)
      }
    }
  } catch (error) {
    ElMessage.error(`导出失败: ${error.message}`)
  }
}

const exportJSON = async () => {
  if (props.samples.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  try {
    const content = generateJSONAudit({
      samples: props.samples,
      risks: props.risks,
      remarks: props.remarks,
      reviewStatus: props.reviewStatus,
      photos: props.photos
    })

    const defaultName = `审计明细_${dayjs().format('YYYYMMDD_HHmmss')}.json`
    
    const filePath = await electronAPI.saveFile(defaultName, [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ])

    if (filePath) {
      const result = await electronAPI.writeFile(filePath, content)
      if (result.success) {
        ElMessage.success(`文件已导出: ${filePath}`)
        jsonPreviewVisible.value = false
      } else {
        throw new Error(result.error)
      }
    }
  } catch (error) {
    ElMessage.error(`导出失败: ${error.message}`)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('内容已复制到剪贴板')
  } catch (error) {
    ElMessage.error(`复制失败: ${error.message}`)
  }
}
</script>
