<template>
  <div class="container">
    <div class="page-header">
      <h2>{{ isEdit ? '编辑推送' : '创建推送' }}</h2>
    </div>
    
    <el-card>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="form-container"
        :disabled="isSubmitting"
      >
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入推送标题"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="请输入推送内容"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="推送类型" prop="pushType">
          <el-radio-group v-model="form.pushType">
            <el-radio value="broadcast">广播推送</el-radio>
            <el-radio value="targeted">定向推送</el-radio>
            <el-radio value="system">系统推送</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="form.pushType === 'targeted'" label="目标用户" prop="targetUsers">
          <el-select
            v-model="form.targetUsers"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入用户ID或选择，按回车添加"
            style="width: 100%"
          >
            <el-option
              v-for="item in form.targetUsers"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
          <div style="margin-top: 8px; color: #909399; font-size: 12px">
            提示：输入用户ID后按回车添加
          </div>
        </el-form-item>
        
        <el-form-item label="优先级">
          <el-slider
            v-model="form.priority"
            :min="-10"
            :max="10"
            :step="1"
            show-input
            style="width: 300px"
          />
          <span style="margin-left: 12px; color: #909399">
            数值越高优先级越高
          </span>
        </el-form-item>
        
        <el-form-item label="定时发送">
          <el-date-picker
            v-model="scheduledDateTime"
            type="datetime"
            placeholder="选择发送时间（留空则立即发送）"
            style="width: 300px"
          />
          <el-button
            v-if="scheduledDateTime"
            link
            type="primary"
            @click="scheduledDateTime = null"
          >
            清除定时
          </el-button>
        </el-form-item>
        
        <el-form-item>
          <div class="form-footer">
            <el-button @click="handleCancel">取消</el-button>
            <el-button
              type="primary"
              :loading="isSubmitting"
              @click="handleSubmit"
            >
              {{ isEdit ? '保存修改' : '创建推送' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'
import type { PushType, PushMessage } from '@/types'
import { createPushMessage, updatePushMessage, getPushMessage } from '@/api/push'

const route = useRoute()
const router = useRouter()
const formRef = ref<FormInstance>()
const isSubmitting = ref(false)

const messageId = computed(() => route.params.id as string)
const isEdit = computed(() => !!messageId.value)

const scheduledDateTime = ref<Date | null>(null)

const form = reactive({
  title: '',
  content: '',
  pushType: 'broadcast' as PushType,
  targetUsers: [] as string[],
  priority: 0,
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }],
}

async function loadMessage() {
  if (!isEdit.value) return
  
  try {
    const message = await getPushMessage(messageId.value)
    form.title = message.title
    form.content = message.content
    form.pushType = message.pushType
    form.targetUsers = message.targetUsers || []
    form.priority = message.priority
    
    if (message.scheduledAt) {
      scheduledDateTime.value = new Date(message.scheduledAt)
    }
  } catch (e) {
    ElMessage.error('加载推送信息失败')
    router.push('/push')
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    isSubmitting.value = true
    
    const params: any = {
      title: form.title,
      content: form.content,
      pushType: form.pushType,
      targetUsers: form.targetUsers,
      priority: form.priority,
    }
    
    if (scheduledDateTime.value) {
      params.scheduledAt = scheduledDateTime.value.toISOString()
    }
    
    if (isEdit.value) {
      await updatePushMessage(messageId.value, params)
      ElMessage.success('推送已更新')
    } else {
      await createPushMessage(params)
      ElMessage.success('推送已创建并加入发送队列')
    }
    
    router.push('/push')
  } catch (e: any) {
    if (e?.message) {
      ElMessage.error(e.message)
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleCancel() {
  router.push('/push')
}

onMounted(() => {
  loadMessage()
})
</script>
