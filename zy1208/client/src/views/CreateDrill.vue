<template>
  <div class="create-drill-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">新建演练</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="create-form"
      >
        <el-form-item label="演练名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入演练名称，如：线上订单库性能分析"
            maxlength="100"
          />
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入演练描述，说明本次分析的背景和目标"
            maxlength="500"
          />
        </el-form-item>

        <el-divider content-position="left">数据文件</el-divider>

        <el-form-item label="Schema">
          <div class="upload-section">
            <el-upload
              drag
              multiple
              :auto-upload="false"
              :on-change="handleFileChange('schema', $event)"
              :on-remove="handleFileRemove('schema', $event)"
              :file-list="fileList.schema"
              accept=".sql"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 .sql 格式的 Schema 定义文件
                </div>
              </template>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item label="慢查询日志">
          <div class="upload-section">
            <el-upload
              drag
              multiple
              :auto-upload="false"
              :on-change="handleFileChange('slowLog', $event)"
              :on-remove="handleFileRemove('slowLog', $event)"
              :file-list="fileList.slowLog"
              accept=".log,.txt,.sql"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 PostgreSQL 慢查询日志格式（.log, .txt）
                </div>
              </template>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item label="数据库配置">
          <div class="upload-section">
            <el-upload
              drag
              multiple
              :auto-upload="false"
              :on-change="handleFileChange('dbProfile', $event)"
              :on-remove="handleFileRemove('dbProfile', $event)"
              :file-list="fileList.dbProfile"
              accept=".json"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 JSON 格式的数据库配置/性能指标（连接池、慢查询统计等）
                </div>
              </template>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item label="写入样例">
          <div class="upload-section">
            <el-upload
              drag
              multiple
              :auto-upload="false"
              :on-change="handleFileChange('writeSample', $event)"
              :on-remove="handleFileRemove('writeSample', $event)"
              :file-list="fileList.writeSample"
              accept=".json,.csv,.sql"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 JSON/CSV/SQL 格式的写入操作样例数据
                </div>
              </template>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            创建并开始分析
          </el-button>
          <el-button @click="$router.push('/')">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { drillApi } from '@/api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  description: ''
})

const rules = {
  name: [
    { required: true, message: '请输入演练名称', trigger: 'blur' },
    { min: 2, max: 100, message: '名称长度在 2 到 100 个字符', trigger: 'blur' }
  ]
}

const fileList = reactive({
  schema: [],
  slowLog: [],
  dbProfile: [],
  writeSample: []
})

const allFiles = ref([])

const handleFileChange = (type, file) => {
  fileList[type].push(file)
  allFiles.value.push(file.raw)
}

const handleFileRemove = (type, file) => {
  const index = fileList[type].findIndex(f => f.uid === file.uid)
  if (index > -1) {
    fileList[type].splice(index, 1)
  }
  const rawIndex = allFiles.value.findIndex(f => f === file.raw)
  if (rawIndex > -1) {
    allFiles.value.splice(rawIndex, 1)
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      const response = await drillApi.create(form, allFiles.value)
      ElMessage.success('演练创建成功')
      
      const drillId = response.data.id
      
      if (allFiles.value.length > 0) {
        router.push(`/drill/${drillId}`)
      } else {
        router.push('/')
      }
    } catch (error) {
      console.error('创建演练失败:', error)
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style scoped>
.create-drill-page {
  max-width: 900px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.create-form {
  max-width: 700px;
}

.upload-section {
  width: 100%;
}

.upload-section :deep(.el-upload) {
  width: 100%;
}

.upload-section :deep(.el-upload-dragger) {
  width: 100%;
}
</style>
