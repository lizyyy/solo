<template>
  <div class="import-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">数据导入</span>
          <el-button type="primary" @click="handleBatchImport" :loading="importing">
            <el-icon class="mr-1"><UploadFilled /></el-icon>
            批量导入所有数据
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="原文段落表" name="original">
          <div class="tab-content">
            <div class="import-section">
              <div class="section-header">
                <h4>导入原文段落数据</h4>
                <el-text type="info">格式：JSON数组，包含 paragraphId、pageNumber、content 字段</el-text>
              </div>
              
              <el-upload
                class="upload-demo"
                drag
                :auto-upload="false"
                :on-change="handleFileChange('original')"
                accept=".json,.txt,.csv"
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">
                  将文件拖到此处，或<em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    支持 JSON、TXT、CSV 格式
                  </div>
                </template>
              </el-upload>

              <el-divider>或手动输入数据</el-divider>

              <el-input
                v-model="originalData"
                type="textarea"
                :rows="10"
                placeholder="请输入原文段落数据（JSON数组格式）"
                class="data-input"
              />

              <div class="button-group">
                <el-button type="primary" @click="importOriginalTexts" :loading="loading.original">
                  导入原文段落
                </el-button>
                <el-button @click="showSampleData('original')">
                  查看示例数据
                </el-button>
              </div>
            </div>

            <div class="preview-section" v-if="previewData.original.length > 0">
              <el-divider>预览已导入的数据</el-divider>
              <el-table :data="previewData.original" border style="width: 100%">
                <el-table-column prop="paragraphId" label="段落ID" width="120" />
                <el-table-column prop="pageNumber" label="页码" width="80" />
                <el-table-column prop="content" label="内容" />
                <el-table-column prop="charCount" label="字符数" width="100" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="盲文点位校对记录" name="braille">
          <div class="tab-content">
            <div class="import-section">
              <div class="section-header">
                <h4>导入盲文点位校对数据</h4>
                <el-text type="info">格式：JSON数组，包含 paragraphId、pageNumber、brailleContent、points 字段</el-text>
              </div>
              
              <el-upload
                class="upload-demo"
                drag
                :auto-upload="false"
                :on-change="handleFileChange('braille')"
                accept=".json,.txt,.csv"
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">
                  将文件拖到此处，或<em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    支持 JSON、TXT、CSV 格式
                  </div>
                </template>
              </el-upload>

              <el-divider>或手动输入数据</el-divider>

              <el-input
                v-model="brailleData"
                type="textarea"
                :rows="10"
                placeholder="请输入盲文点位校对数据（JSON数组格式）"
                class="data-input"
              />

              <div class="button-group">
                <el-button type="primary" @click="importBrailleProofreadings" :loading="loading.braille">
                  导入校对记录
                </el-button>
                <el-button @click="showSampleData('braille')">
                  查看示例数据
                </el-button>
              </div>
            </div>

            <div class="preview-section" v-if="previewData.braille.length > 0">
              <el-divider>预览已导入的数据</el-divider>
              <el-table :data="previewData.braille" border style="width: 100%">
                <el-table-column prop="paragraphId" label="段落ID" width="120" />
                <el-table-column prop="pageNumber" label="页码" width="80" />
                <el-table-column prop="brailleContent" label="盲文内容" />
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="scope">
                    <el-tag :type="getStatusType(scope.row.status)">
                      {{ getStatusText(scope.row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="热压机温度曲线" name="temperature">
          <div class="tab-content">
            <div class="import-section">
              <div class="section-header">
                <h4>导入热压机温度曲线数据</h4>
                <el-text type="info">格式：JSON数组，包含 jobId、pageNumber、timestamp、temperature、targetTemperature 字段</el-text>
              </div>
              
              <el-upload
                class="upload-demo"
                drag
                :auto-upload="false"
                :on-change="handleFileChange('temperature')"
                accept=".json,.txt,.csv"
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">
                  将文件拖到此处，或<em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    支持 JSON、TXT、CSV 格式
                  </div>
                </template>
              </el-upload>

              <el-divider>或手动输入数据</el-divider>

              <el-input
                v-model="temperatureData"
                type="textarea"
                :rows="10"
                placeholder="请输入热压机温度曲线数据（JSON数组格式）"
                class="data-input"
              />

              <div class="button-group">
                <el-button type="primary" @click="importTemperatureCurves" :loading="loading.temperature">
                  导入温度曲线
                </el-button>
                <el-button @click="showSampleData('temperature')">
                  查看示例数据
                </el-button>
              </div>
            </div>

            <div class="preview-section" v-if="previewData.temperature.length > 0">
              <el-divider>预览已导入的数据</el-divider>
              <el-table :data="previewData.temperature" border style="width: 100%">
                <el-table-column prop="jobId" label="任务ID" width="120" />
                <el-table-column prop="pageNumber" label="页码" width="80" />
                <el-table-column prop="timestamp" label="时间" width="180">
                  <template #default="scope">
                    {{ formatTime(scope.row.timestamp) }}
                  </template>
                </el-table-column>
                <el-table-column prop="temperature" label="实际温度(°C)" width="120">
                  <template #default="scope">
                    <el-tag :type="getTemperatureTagType(scope.row.temperature, scope.row.targetTemperature)">
                      {{ scope.row.temperature }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="targetTemperature" label="目标温度(°C)" width="120" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="学生试读反馈" name="feedback">
          <div class="tab-content">
            <div class="import-section">
              <div class="section-header">
                <h4>导入学生试读反馈数据</h4>
                <el-text type="info">格式：JSON数组，包含 pageNumber、studentName、feedback、rating、feedbackTime 字段</el-text>
              </div>
              
              <el-upload
                class="upload-demo"
                drag
                :auto-upload="false"
                :on-change="handleFileChange('feedback')"
                accept=".json,.txt,.csv"
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">
                  将文件拖到此处，或<em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    支持 JSON、TXT、CSV 格式
                  </div>
                </template>
              </el-upload>

              <el-divider>或手动输入数据</el-divider>

              <el-input
                v-model="feedbackData"
                type="textarea"
                :rows="10"
                placeholder="请输入学生试读反馈数据（JSON数组格式）"
                class="data-input"
              />

              <div class="button-group">
                <el-button type="primary" @click="importStudentFeedbacks" :loading="loading.feedback">
                  导入学生反馈
                </el-button>
                <el-button @click="showSampleData('feedback')">
                  查看示例数据
                </el-button>
              </div>
            </div>

            <div class="preview-section" v-if="previewData.feedback.length > 0">
              <el-divider>预览已导入的数据</el-divider>
              <el-table :data="previewData.feedback" border style="width: 100%">
                <el-table-column prop="pageNumber" label="页码" width="80" />
                <el-table-column prop="studentName" label="学生姓名" width="120" />
                <el-table-column prop="feedback" label="反馈内容" />
                <el-table-column prop="rating" label="评分" width="100">
                  <template #default="scope">
                    <el-rate v-model="scope.row.rating" disabled />
                  </template>
                </el-table-column>
                <el-table-column prop="feedbackTime" label="反馈时间" width="180">
                  <template #default="scope">
                    {{ formatTime(scope.row.feedbackTime) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="sampleDialogVisible" title="示例数据格式" width="700px">
      <el-input
        :model-value="sampleData"
        type="textarea"
        :rows="15"
        readonly
        class="sample-data"
      />
      <template #footer>
        <el-button @click="copySampleData">
          复制示例数据
        </el-button>
        <el-button type="primary" @click="sampleDialogVisible = false">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { importApi } from '../api'
import dayjs from 'dayjs'

const sampleDatasets = {
  original: [
    {
      paragraphId: 'P001',
      pageNumber: 1,
      content: '第一章 基础知识'
    },
    {
      paragraphId: 'P002',
      pageNumber: 1,
      content: '盲文是一种通过触觉感知的文字系统。'
    }
  ],
  braille: [
    {
      paragraphId: 'P001',
      pageNumber: 1,
      brailleContent: '⠠⠃⠗⠁⠊⠇⠇⠑⠀⠞⠑⠭⠞',
      points: [[1, 2], [3, 4], [5, 6]],
      proofreader: '张老师',
      status: 'verified'
    }
  ],
  temperature: [
    {
      jobId: 'J20240501001',
      pageNumber: 1,
      timestamp: '2024-05-01 10:00:00',
      temperature: 180,
      targetTemperature: 180,
      machineId: 'HM001'
    },
    {
      jobId: 'J20240501001',
      pageNumber: 1,
      timestamp: '2024-05-01 10:00:30',
      temperature: 178,
      targetTemperature: 180,
      machineId: 'HM001'
    }
  ],
  feedback: [
    {
      pageNumber: 1,
      studentName: '小明',
      feedback: '这段盲文容易理解，没有问题。',
      rating: 5,
      feedbackTime: '2024-05-01 14:30:00'
    }
  ]
}

export default {
  name: 'ImportView',
  setup() {
    const activeTab = ref('original')
    const importing = ref(false)
    
    const originalData = ref('')
    const brailleData = ref('')
    const temperatureData = ref('')
    const feedbackData = ref('')
    
    const loading = reactive({
      original: false,
      braille: false,
      temperature: false,
      feedback: false
    })

    const previewData = reactive({
      original: [],
      braille: [],
      temperature: [],
      feedback: []
    })

    const sampleDialogVisible = ref(false)
    const sampleData = ref('')
    const currentSampleType = ref('')

    const handleFileChange = (type) => (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target.result
        switch (type) {
          case 'original':
            originalData.value = content
            break
          case 'braille':
            brailleData.value = content
            break
          case 'temperature':
            temperatureData.value = content
            break
          case 'feedback':
            feedbackData.value = content
            break
        }
      }
      reader.readAsText(file.raw)
    }

    const parseJsonData = (dataStr) => {
      try {
        return JSON.parse(dataStr)
      } catch (e) {
        ElMessage.error('JSON格式解析错误，请检查数据格式')
        return null
      }
    }

    const importOriginalTexts = async () => {
      if (!originalData.value.trim()) {
        ElMessage.warning('请输入或上传原文段落数据')
        return
      }

      const data = parseJsonData(originalData.value)
      if (!data) return

      loading.original = true
      try {
        const response = await importApi.importOriginalTexts(data)
        if (response.success) {
          ElMessage.success(response.message)
          previewData.original = response.data
          originalData.value = ''
        }
      } catch (error) {
        console.error('导入失败:', error)
      } finally {
        loading.original = false
      }
    }

    const importBrailleProofreadings = async () => {
      if (!brailleData.value.trim()) {
        ElMessage.warning('请输入或上传盲文校对数据')
        return
      }

      const data = parseJsonData(brailleData.value)
      if (!data) return

      loading.braille = true
      try {
        const response = await importApi.importBrailleProofreadings(data)
        if (response.success) {
          ElMessage.success(response.message)
          previewData.braille = response.data
          brailleData.value = ''
        }
      } catch (error) {
        console.error('导入失败:', error)
      } finally {
        loading.braille = false
      }
    }

    const importTemperatureCurves = async () => {
      if (!temperatureData.value.trim()) {
        ElMessage.warning('请输入或上传温度曲线数据')
        return
      }

      const data = parseJsonData(temperatureData.value)
      if (!data) return

      loading.temperature = true
      try {
        const response = await importApi.importTemperatureCurves(data)
        if (response.success) {
          ElMessage.success(response.message)
          previewData.temperature = response.data
          temperatureData.value = ''
        }
      } catch (error) {
        console.error('导入失败:', error)
      } finally {
        loading.temperature = false
      }
    }

    const importStudentFeedbacks = async () => {
      if (!feedbackData.value.trim()) {
        ElMessage.warning('请输入或上传学生反馈数据')
        return
      }

      const data = parseJsonData(feedbackData.value)
      if (!data) return

      loading.feedback = true
      try {
        const response = await importApi.importStudentFeedbacks(data)
        if (response.success) {
          ElMessage.success(response.message)
          previewData.feedback = response.data
          feedbackData.value = ''
        }
      } catch (error) {
        console.error('导入失败:', error)
      } finally {
        loading.feedback = false
      }
    }

    const handleBatchImport = async () => {
      try {
        await ElMessageBox.confirm(
          '将执行所有导入操作，请确保数据已准备好。是否继续？',
          '批量导入确认',
          {
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
      } catch {
        return
      }

      importing.value = true
      
      const tasks = []
      
      if (originalData.value.trim()) {
        tasks.push(importOriginalTexts())
      }
      if (brailleData.value.trim()) {
        tasks.push(importBrailleProofreadings())
      }
      if (temperatureData.value.trim()) {
        tasks.push(importTemperatureCurves())
      }
      if (feedbackData.value.trim()) {
        tasks.push(importStudentFeedbacks())
      }

      if (tasks.length === 0) {
        ElMessage.warning('没有需要导入的数据')
        importing.value = false
        return
      }

      try {
        await Promise.all(tasks)
        ElMessage.success('批量导入完成')
      } catch (error) {
        ElMessage.error('批量导入过程中出现错误')
      } finally {
        importing.value = false
      }
    }

    const showSampleData = (type) => {
      currentSampleType.value = type
      sampleData.value = JSON.stringify(sampleDatasets[type], null, 2)
      sampleDialogVisible.value = true
    }

    const copySampleData = () => {
      navigator.clipboard.writeText(sampleData.value)
        .then(() => {
          ElMessage.success('示例数据已复制到剪贴板')
        })
        .catch(() => {
          ElMessage.error('复制失败，请手动复制')
        })
    }

    const getStatusType = (status) => {
      const map = {
        pending: 'warning',
        verified: 'success',
        has_issues: 'danger'
      }
      return map[status] || 'info'
    }

    const getStatusText = (status) => {
      const map = {
        pending: '待处理',
        verified: '已验证',
        has_issues: '有问题'
      }
      return map[status] || status
    }

    const formatTime = (time) => {
      if (!time) return '-'
      return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }

    const getTemperatureTagType = (temp, target) => {
      const diff = Math.abs(temp - target)
      if (diff <= 2) return 'success'
      if (diff <= 5) return 'warning'
      return 'danger'
    }

    return {
      activeTab,
      importing,
      originalData,
      brailleData,
      temperatureData,
      feedbackData,
      loading,
      previewData,
      sampleDialogVisible,
      sampleData,
      handleFileChange,
      importOriginalTexts,
      importBrailleProofreadings,
      importTemperatureCurves,
      importStudentFeedbacks,
      handleBatchImport,
      showSampleData,
      copySampleData,
      getStatusType,
      getStatusText,
      formatTime,
      getTemperatureTagType
    }
  }
}
</script>

<style lang="scss" scoped>
.import-view {
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

.tab-content {
  padding: 10px 0;
}

.import-section {
  .section-header {
    margin-bottom: 15px;
    
    h4 {
      margin: 0 0 8px 0;
      color: #303133;
      font-size: 16px;
    }
  }
}

.upload-demo {
  width: 100%;
  
  :deep(.el-upload-dragger) {
    width: 100%;
  }
}

.data-input {
  margin-bottom: 15px;
}

.button-group {
  display: flex;
  gap: 12px;
}

.preview-section {
  margin-top: 20px;
}

.mr-1 {
  margin-right: 4px;
}
</style>
