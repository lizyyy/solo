<template>
  <div class="home-container">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span>新建导入任务</span>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="导入类型" prop="schemaId">
          <el-select v-model="form.schemaId" placeholder="请选择导入类型" style="width: 300px">
            <el-option
              v-for="schema in schemas"
              :key="schema.id"
              :label="schema.name"
              :value="schema.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="上传文件" prop="file">
          <el-upload
            drag
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
            :file-list="fileList"
            accept=".csv,.xlsx,.xls"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 CSV, XLSX, XLS 格式
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="uploading" @click="handleSubmit">
            开始校验
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="result" class="result-card">
      <template #header>
        <div class="card-header">
          <span>校验结果</span>
          <el-button type="primary" size="small" @click="goToDetail">
            查看详情
          </el-button>
        </div>
      </template>

      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-card total">
            <div class="stat-value">{{ result.summary.total }}</div>
            <div class="stat-label">总记录数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card success">
            <div class="stat-value">{{ result.summary.success }}</div>
            <div class="stat-label">成功</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card failed">
            <div class="stat-value">{{ result.summary.failed }}</div>
            <div class="stat-label">失败</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card rate">
            <div class="stat-value">
              {{ result.summary.total > 0 
                ? ((result.summary.success / result.summary.total) * 100).toFixed(1) 
                : 0 }}%
            </div>
            <div class="stat-label">成功率</div>
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <div v-if="result.summary.failedDetails.length > 0">
        <h4>错误统计</h4>
        <el-table :data="result.summary.failedDetails" stripe>
          <el-table-column prop="field" label="字段" width="150" />
          <el-table-column prop="message" label="错误信息" />
          <el-table-column prop="value" label="数量" width="100" />
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { schemasApi, importApi, type ValidationSchema, type ImportJob, type ImportSummary } from '../api'

const router = useRouter()
const formRef = ref<FormInstance>()
const schemas = ref<ValidationSchema[]>([])
const fileList = ref<UploadFile[]>([])
const uploading = ref(false)
const result = ref<{ job: ImportJob; summary: ImportSummary } | null>(null)

const form = reactive({
  schemaId: '',
  file: null as File | null
})

const rules: FormRules = {
  schemaId: [{ required: true, message: '请选择导入类型', trigger: 'change' }]
}

onMounted(async () => {
  try {
    const { data } = await schemasApi.list()
    schemas.value = data.schemas
  } catch (e: any) {
    ElMessage.error('加载导入类型失败: ' + e.message)
  }
})

function handleFileChange(file: UploadFile) {
  fileList.value = [file]
  form.file = file.raw || null
}

function handleExceed() {
  ElMessage.warning('只能上传一个文件')
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (!form.file) {
      ElMessage.warning('请选择要上传的文件')
      return
    }

    uploading.value = true
    try {
      const { data } = await importApi.upload(form.file, form.schemaId)
      result.value = data
      
      if (data.summary.failed > 0) {
        ElMessage.warning(`校验完成，${data.summary.failed} 条记录需要处理`)
      } else {
        ElMessage.success('全部校验通过！')
      }
    } catch (e: any) {
      ElMessage.error('导入失败: ' + (e.response?.data?.error || e.message))
    } finally {
      uploading.value = false
    }
  })
}

function resetForm() {
  formRef.value?.resetFields()
  fileList.value = []
  form.file = null
  result.value = null
}

function goToDetail() {
  if (result.value) {
    router.push(`/jobs/${result.value.job.id}`)
  }
}
</script>

<style scoped>
.home-container {
  max-width: 1000px;
  margin: 24px auto;
}

.upload-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.stats-row {
  margin-top: 16px;
}

.stat-card {
  text-align: center;
  padding: 24px 16px;
  border-radius: 8px;
}

.stat-card.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card.success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.stat-card.failed {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
  color: white;
}

.stat-card.rate {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

h4 {
  margin-bottom: 16px;
  color: #303133;
}
</style>