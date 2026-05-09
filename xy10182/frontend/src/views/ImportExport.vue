<template>
  <div class="import-export">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="导出数据" name="export">
        <el-card shadow="never">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-card shadow="hover" class="export-card">
                <el-icon :size="48" style="color: #409EFF;"><Document /></el-icon>
                <div class="export-title">试剂数据</div>
                <div class="export-desc">导出所有试剂信息</div>
                <el-button type="primary" @click="exportReagents">
                  <el-icon><Download /></el-icon>
                  导出CSV
                </el-button>
              </el-card>
            </el-col>
            <el-col :span="8">
              <el-card shadow="hover" class="export-card">
                <el-icon :size="48" style="color: #67c23a;"><ShoppingBag /></el-icon>
                <div class="export-title">批次数据</div>
                <div class="export-desc">导出所有批次库存</div>
                <el-button type="success" @click="exportBatches">
                  <el-icon><Download /></el-icon>
                  导出CSV
                </el-button>
              </el-card>
            </el-col>
            <el-col :span="8">
              <el-card shadow="hover" class="export-card">
                <el-icon :size="48" style="color: #e6a23c;"><Clock /></el-icon>
                <div class="export-title">操作记录</div>
                <div class="export-desc">导出所有操作历史</div>
                <el-button type="warning" @click="exportRecords">
                  <el-icon><Download /></el-icon>
                  导出CSV
                </el-button>
              </el-card>
            </el-col>
          </el-row>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="导入数据" name="import">
        <el-card shadow="never">
          <el-alert
            title="导入说明"
            type="info"
            :closable="false"
            style="margin-bottom: 20px;"
            show-icon
          >
            <template #default>
              <ul style="margin-top: 8px; padding-left: 20px;">
                <li>试剂导入格式：名称、编码、分类、规格、单位、安全库存、最大库存、保质期</li>
                <li>批次导入格式：试剂编码、批次号、生产厂家、生产日期、有效期、数量、存储位置</li>
                <li>CSV文件请使用UTF-8编码</li>
              </ul>
            </template>
          </el-alert>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-card shadow="hover">
                <div class="import-section">
                  <el-icon :size="32" style="color: #409EFF;"><Document /></el-icon>
                  <div class="import-title">导入试剂</div>
                  <el-upload
                    class="upload-demo"
                    drag
                    :auto-upload="false"
                    :on-change="onFileChange('reagent')"
                    :limit="1"
                    accept=".csv"
                  >
                    <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                    <div class="el-upload__text">
                      将CSV文件拖到此处，或<em>点击上传</em>
                    </div>
                    <template #tip>
                      <div class="el-upload__tip">
                        只能上传 csv 文件
                      </div>
                    </template>
                  </el-upload>
                  <el-button
                    type="primary"
                    :loading="importingReagent"
                    @click="doImport('reagent')"
                    :disabled="!reagentFile"
                    style="margin-top: 16px;"
                  >
                    开始导入
                  </el-button>
                </div>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="hover">
                <div class="import-section">
                  <el-icon :size="32" style="color: #67c23a;"><ShoppingBag /></el-icon>
                  <div class="import-title">导入批次</div>
                  <el-upload
                    class="upload-demo"
                    drag
                    :auto-upload="false"
                    :on-change="(file) => onFileChange('batch', file)"
                    :limit="1"
                    accept=".csv"
                  >
                    <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                    <div class="el-upload__text">
                      将CSV文件拖到此处，或<em>点击上传</em>
                    </div>
                    <template #tip>
                      <div class="el-upload__tip">
                        只能上传 csv 文件
                      </div>
                    </template>
                  </el-upload>
                  <el-button
                    type="success"
                    :loading="importingBatch"
                    @click="doImport('batch')"
                    :disabled="!batchFile"
                    style="margin-top: 16px;"
                  >
                    开始导入
                  </el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="resultVisible" title="导入结果" width="600px">
      <div v-if="importResult">
        <el-result
          :icon="importResult.imported > 0 ? 'success' : 'error'"
          :title="importResult.imported > 0 ? '导入完成' : '导入失败'"
          :sub-title="`成功导入 ${importResult.imported} 条，失败 ${importResult.failed} 条"
        />
        <el-table :data="importResult.importedItems" v-if="importResult.importedItems?.length > 0" style="margin-top: 16px;" stripe>
          <el-table-column label="名称" prop="name" />
          <el-table-column label="编码" prop="code" />
        </el-table>
        <el-table :data="importResult.failedItems" v-if="importResult.failedItems?.length > 0" style="margin-top: 16px;" stripe>
          <el-table-column label="行号" prop="line" width="80" />
          <el-table-column label="错误" prop="error" />
        </el-table>
        <el-table :data="importResult.warnings" v-if="importResult.warnings?.length > 0" style="margin-top: 16px;" stripe>
          <el-table-column label="行号" prop="line" width="80" />
          <el-table-column label="提示" prop="message" />
        </el-table>
      </div>
      <template #footer>
        <el-button type="primary" @click="resultVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../utils/request'

const activeTab = ref('export')
const reagentFile = ref(null)
const batchFile = ref(null)
const importingReagent = ref(false)
const importingBatch = ref(false)
const resultVisible = ref(false)
const importResult = ref(null)

function exportReagents() {
  window.open('/api/export/reagents')
}

function exportBatches() {
  window.open('/api/export/batches')
}

function exportRecords() {
  window.open('/api/export/records')
}

function onFileChange(type, file) {
  if (type === 'reagent') {
    reagentFile.value = file
  } else {
    batchFile.value = file
  }
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const result = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    result.push(obj)
  }
  
  return result
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file.raw, 'UTF-8')
  })
}

async function doImport(type) {
  const file = type === 'reagent' ? reagentFile.value : batchFile.value
  if (!file) return

  const loading = type === 'reagent' ? importingReagent : importingBatch
  loading.value = true

  try {
    const content = await readFile(file)
    const csvData = parseCSV(content)

    const url = type === 'reagent' ? '/export/import/reagents' : '/export/import/batches'
    
    const res = await request({
      url,
      method: 'post',
      data: { csvData }
    })

    importResult.value = res.data
    resultVisible.value = true
    ElMessage.success(`导入完成`)

    if (type === 'reagent') {
      reagentFile.value = null
    } else {
      batchFile.value = null
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.export-card {
  text-align: center;
  padding: 30px 20px;
}

.export-title {
  font-size: 18px;
  font-weight: 500;
  margin-top: 16px;
  color: #303133;
}

.export-desc {
  font-size: 14px;
  color: #909399;
  margin: 8px 0 16px;
}

.import-section {
  text-align: center;
  padding: 10px;
}

.import-title {
  font-size: 16px;
  font-weight: 500;
  margin: 16px 0;
  color: #303133;
}

.upload-demo {
  margin-top: 16px;
}
</style>
