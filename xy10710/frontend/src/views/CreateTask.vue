<template>
  <div class="create-task-container">
    <el-card class="header-card">
      <div class="header-content">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h1>创建转码任务</h1>
      </div>
    </el-card>

    <el-card class="form-card">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-divider content-position="left">原图信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="原图URL" prop="original_image_url">
              <el-input v-model="form.original_image_url" placeholder="输入图片URL" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="文件名" prop="original_image_name">
              <el-input v-model="form.original_image_name" placeholder="输入文件名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="宽度" prop="original_width">
              <el-input-number v-model="form.original_width" :min="1" :max="10000" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="高度" prop="original_height">
              <el-input-number v-model="form.original_height" :min="1" :max="10000" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="格式" prop="original_format">
              <el-select v-model="form.original_format" placeholder="选择格式" style="width: 100%">
                <el-option label="JPG" value="jpg" />
                <el-option label="PNG" value="png" />
                <el-option label="WEBP" value="webp" />
                <el-option label="GIF" value="gif" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">目标规格</el-divider>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="目标宽度" prop="target_width">
              <el-input-number v-model="form.target_width" :min="1" :max="10000" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="目标高度" prop="target_height">
              <el-input-number v-model="form.target_height" :min="1" :max="10000" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="目标格式" prop="target_format">
              <el-select v-model="form.target_format" placeholder="选择格式" style="width: 100%">
                <el-option label="JPG" value="jpg" />
                <el-option label="PNG" value="png" />
                <el-option label="WEBP" value="webp" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="质量(1-100)" prop="target_quality">
              <el-slider v-model="form.target_quality" :min="1" :max="100" show-input />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="优先级" prop="priority">
              <el-input-number v-model="form.priority" :min="0" :max="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最大重试次数" prop="max_retries">
              <el-input-number v-model="form.max_retries" :min="0" :max="10" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">水印配置</el-divider>
        <el-form-item label="启用水印">
          <el-switch v-model="form.watermark_config.enabled" />
        </el-form-item>
        <template v-if="form.watermark_config.enabled">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="水印文字">
                <el-input v-model="form.watermark_config.text" placeholder="输入水印文字" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="水印位置">
                <el-select v-model="form.watermark_config.position" style="width: 100%">
                  <el-option label="左上角" value="top_left" />
                  <el-option label="右上角" value="top_right" />
                  <el-option label="左下角" value="bottom_left" />
                  <el-option label="右下角" value="bottom_right" />
                  <el-option label="居中" value="center" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="透明度">
                <el-slider v-model="form.watermark_config.opacity" :min="0" :max="1" :step="0.1" show-input />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="字体大小">
                <el-input-number v-model="form.watermark_config.font_size" :min="12" :max="100" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <el-divider content-position="left">其他信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="创建人" prop="created_by">
              <el-input v-model="form.created_by" placeholder="输入创建人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="幂等性Key">
              <el-input v-model="form.idempotency_key" placeholder="可选，用于防止重复提交" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button type="primary" size="large" @click="handleSubmit" :loading="submitting">
            创建任务
          </el-button>
          <el-button size="large" @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { createTask } from '@/api/task'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  original_image_url: '',
  original_image_name: '',
  original_width: null,
  original_height: null,
  original_format: '',
  target_width: null,
  target_height: null,
  target_format: '',
  target_quality: 85,
  priority: 0,
  max_retries: 3,
  created_by: '',
  idempotency_key: '',
  watermark_config: {
    enabled: false,
    text: '',
    position: 'bottom_right',
    opacity: 0.5,
    font_size: 30,
    color: '#FFFFFF'
  }
})

const rules = {
  original_image_url: [
    { required: true, message: '请输入原图URL', trigger: 'blur' }
  ],
  original_image_name: [
    { required: true, message: '请输入文件名', trigger: 'blur' }
  ]
}

const goBack = () => {
  router.push('/')
}

const resetForm = () => {
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const submitData = { ...form }
    if (!submitData.watermark_config.enabled) {
      submitData.watermark_config = null
    }
    await createTask(submitData)
    ElMessage.success('任务创建成功')
    router.push('/')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.create-task-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-card {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-content h1 {
  font-size: 20px;
  color: #303133;
  margin: 0;
}

.form-card {
  min-height: 600px;
}
</style>
