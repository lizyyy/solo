<template>
  <div class="export-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据导出</span>
        </div>
      </template>

      <el-form :model="exportForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="状态筛选">
              <el-select
                v-model="exportForm.status_filter"
                multiple
                placeholder="选择要导出的状态"
                style="width: 100%"
              >
                <el-option label="待解析" value="待解析" />
                <el-option label="解析成功" value="解析成功" />
                <el-option label="解析拦截" value="解析拦截" />
                <el-option label="解析补偿" value="解析补偿" />
                <el-option label="待人工复核" value="待人工复核" />
                <el-option label="复核完成" value="复核完成" />
                <el-option label="已导出" value="已导出" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="开始日期">
              <el-date-picker
                v-model="exportForm.start_date"
                type="date"
                placeholder="选择开始日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="exportForm.end_date"
                type="date"
                placeholder="选择结束日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="导出格式">
              <el-radio-group v-model="exportForm.export_format">
                <el-radio label="excel">Excel</el-radio>
                <el-radio label="csv">CSV</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="previewExport" :loading="previewLoading">
            <el-icon><View /></el-icon>
            预览数据
          </el-button>
          <el-button type="success" @click="downloadExport" :loading="downloadLoading" :disabled="!previewData.length">
            <el-icon><Download /></el-icon>
            下载文件
          </el-button>
          <el-button type="warning" @click="markAsExported" :disabled="!previewData.length">
            <el-icon><Check /></el-icon>
            标记为已导出
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="previewData.length" style="margin-top: 20px">
        <div class="preview-header">
          <span>预览结果：共 {{ previewTotal }} 条数据</span>
          <span style="color: #909399; font-size: 12px">（显示前10条）</span>
        </div>
        <el-table :data="previewData" stripe border style="margin-top: 10px" size="small">
          <el-table-column
            v-for="col in previewColumns"
            :key="col"
            :prop="col"
            :label="col"
            :width="getColumnWidth(col)"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const previewLoading = ref(false)
const downloadLoading = ref(false)
const previewData = ref([])
const previewColumns = ref([])
const previewTotal = ref(0)

const exportForm = ref({
  status_filter: [],
  start_date: null,
  end_date: null,
  export_format: 'excel'
})

const getColumnWidth = (col) => {
  const widths = {
    '简历ID': 80,
    '简历文件名': 200,
    '当前状态': 100,
    '岗位匹配度(%)': 120,
    '匹配岗位': 150,
    '上传时间': 180,
    '姓名': 100,
    '电话': 120,
    '电子邮箱': 180,
    '年龄': 80,
    '性别': 80,
    '最高学历': 100,
    '毕业院校': 150,
    '所学专业': 150,
    '工作年限(年)': 120,
    '当前公司': 150,
    '当前职位': 150,
    '期望薪资': 120,
    '当前薪资': 120,
    '所在城市': 100,
    '技能列表': 250,
    '解析来源': 100,
    '解析置信度(%)': 120,
    '解析版本': 100
  }
  return widths[col] || 120
}

const previewExport = async () => {
  previewLoading.value = true
  try {
    const response = await api.previewExport(exportForm.value)
    previewData.value = response.data.preview_data || []
    previewColumns.value = response.data.columns || []
    previewTotal.value = response.data.total || 0
    ElMessage.success(`找到 ${previewTotal.value} 条数据`)
  } catch (error) {
    ElMessage.error('预览失败')
  } finally {
    previewLoading.value = false
  }
}

const downloadExport = async () => {
  downloadLoading.value = true
  try {
    const response = await api.downloadExport(exportForm.value)
    
    const blob = new Blob([response.data], {
      type: exportForm.value.export_format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8'
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    const ext = exportForm.value.export_format === 'excel' ? 'xlsx' : 'csv'
    link.download = `简历数据_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.${ext}`
    link.click()
    
    window.URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch (error) {
    ElMessage.error('下载失败')
  } finally {
    downloadLoading.value = false
  }
}

const markAsExported = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要将这些简历标记为已导出吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const ids = previewData.value.map(item => item['简历ID']).filter(id => id)
    if (ids.length) {
      await api.markAsExported(ids)
      ElMessage.success('标记成功')
      await previewExport()
    }
  } catch {
    // 取消操作
  }
}
</script>

<style scoped>
.card-header {
  font-size: 16px;
  font-weight: 500;
}

.preview-header {
  padding: 10px 0;
  font-size: 14px;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
}
</style>
