<template>
  <div class="import-container">
    <el-card>
      <template #header>
        <span class="card-title">数据导入</span>
      </template>
      
      <el-alert
        title="数据格式说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <p>请确保 CSV 文件包含以下字段（列名可包含中文或英文）：</p>
          <ul>
            <li><strong>扶梯巡检</strong>: 扶梯编号/escalator_code, 巡检日期/inspection_date, 巡检员/inspector 等</li>
            <li><strong>运行电流日志</strong>: 扶梯编号/escalator_code, 记录时间/log_time, A相电流/phase_a_current, B相电流/phase_b_current, C相电流/phase_c_current</li>
            <li><strong>乘客报修记录</strong>: 扶梯编号/escalator_code, 报修时间/report_time, 故障描述/fault_description 等</li>
            <li><strong>维保到场单</strong>: 扶梯编号/escalator_code, 召修时间/call_time, 技术人员/technician_name 等</li>
          </ul>
        </template>
      </el-alert>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="扶梯巡检" name="inspection">
          <div class="upload-section">
            <el-upload
              class="upload-demo"
              drag
              :action="''"
              :auto-upload="false"
              :on-change="handleFileChange('inspection')"
              :on-remove="handleFileRemove('inspection')"
              :limit="1"
              accept=".csv"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只能上传 CSV 文件，且不超过 10MB
                </div>
              </template>
            </el-upload>
            
            <div class="upload-actions" v-if="files.inspection">
              <el-button type="primary" :loading="uploading.inspection" @click="handleUpload('inspection')">
                上传并导入
              </el-button>
              <el-button @click="clearFile('inspection')">
                取消
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="运行电流日志" name="currentLog">
          <div class="upload-section">
            <el-upload
              class="upload-demo"
              drag
              :action="''"
              :auto-upload="false"
              :on-change="handleFileChange('currentLog')"
              :on-remove="handleFileRemove('currentLog')"
              :limit="1"
              accept=".csv"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只能上传 CSV 文件，且不超过 50MB
                </div>
              </template>
            </el-upload>
            
            <div class="upload-actions" v-if="files.currentLog">
              <el-button type="primary" :loading="uploading.currentLog" @click="handleUpload('currentLog')">
                上传并导入
              </el-button>
              <el-button @click="clearFile('currentLog')">
                取消
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="乘客报修记录" name="repair">
          <div class="upload-section">
            <el-upload
              class="upload-demo"
              drag
              :action="''"
              :auto-upload="false"
              :on-change="handleFileChange('repair')"
              :on-remove="handleFileRemove('repair')"
              :limit="1"
              accept=".csv"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只能上传 CSV 文件，且不超过 10MB
                </div>
              </template>
            </el-upload>
            
            <div class="upload-actions" v-if="files.repair">
              <el-button type="primary" :loading="uploading.repair" @click="handleUpload('repair')">
                上传并导入
              </el-button>
              <el-button @click="clearFile('repair')">
                取消
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="维保到场单" name="maintenance">
          <div class="upload-section">
            <el-upload
              class="upload-demo"
              drag
              :action="''"
              :auto-upload="false"
              :on-change="handleFileChange('maintenance')"
              :on-remove="handleFileRemove('maintenance')"
              :limit="1"
              accept=".csv"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只能上传 CSV 文件，且不超过 10MB
                </div>
              </template>
            </el-upload>
            
            <div class="upload-actions" v-if="files.maintenance">
              <el-button type="primary" :loading="uploading.maintenance" @click="handleUpload('maintenance')">
                上传并导入
              </el-button>
              <el-button @click="clearFile('maintenance')">
                取消
              </el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span class="card-title">导入历史</span>
      </template>
      
      <el-table :data="importHistory" style="width: 100%">
        <el-table-column prop="type" label="数据类型" width="150">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)">
              {{ getTypeName(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fileName" label="文件名" />
        <el-table-column prop="count" label="导入数量" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="导入时间" width="180" />
        <el-table-column label="操作" width="120" v-if="importHistory.length > 0">
          <template #default="{ $index }">
            <el-button type="text" size="small" @click="removeHistory($index)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty v-if="importHistory.length === 0" description="暂无导入记录" />
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { importApi } from '@/api'

const activeTab = ref('inspection')

const files = ref({
  inspection: null,
  currentLog: null,
  repair: null,
  maintenance: null
})

const uploading = ref({
  inspection: false,
  currentLog: false,
  repair: false,
  maintenance: false
})

const importHistory = ref([])

const typeNames = {
  inspection: '扶梯巡检',
  currentLog: '运行电流日志',
  repair: '乘客报修记录',
  maintenance: '维保到场单'
}

const handleFileChange = (type) => (file) => {
  files.value[type] = file.raw
}

const handleFileRemove = (type) => () => {
  files.value[type] = null
}

const clearFile = (type) => {
  files.value[type] = null
}

const handleUpload = async (type) => {
  if (!files.value[type]) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value[type] = true

  const formData = new FormData()
  formData.append('file', files.value[type])

  try {
    let res
    switch (type) {
      case 'inspection':
        res = await importApi.inspection(formData)
        break
      case 'currentLog':
        res = await importApi.currentLog(formData)
        break
      case 'repair':
        res = await importApi.repair(formData)
        break
      case 'maintenance':
        res = await importApi.maintenance(formData)
        break
    }

    if (res.data.success) {
      ElMessage.success(res.data.message || '导入成功')
      
      importHistory.value.unshift({
        type,
        fileName: files.value[type].name,
        count: res.data.count || 0,
        status: 'success',
        time: new Date().toLocaleString('zh-CN')
      })

      files.value[type] = null
    }
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败: ' + (error.response?.data?.error || error.message))
    
    importHistory.value.unshift({
      type,
      fileName: files.value[type].name,
      count: 0,
      status: 'error',
      time: new Date().toLocaleString('zh-CN')
    })
  } finally {
    uploading.value[type] = false
  }
}

const removeHistory = (index) => {
  importHistory.value.splice(index, 1)
}

const getTypeName = (type) => {
  return typeNames[type] || type
}

const getTypeTagType = (type) => {
  const tagMap = {
    inspection: 'primary',
    currentLog: 'success',
    repair: 'warning',
    maintenance: 'info'
  }
  return tagMap[type] || ''
}
</script>

<style lang="scss" scoped>
.import-container {
  .card-title {
    font-size: 16px;
    font-weight: 500;
  }

  .upload-section {
    padding: 20px 0;

    .upload-demo {
      :deep(.el-upload) {
        width: 100%;

        .el-upload-dragger {
          width: 100%;
        }
      }
    }

    .upload-actions {
      margin-top: 20px;
      text-align: center;
    }
  }
}
</style>
