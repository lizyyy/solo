<template>
  <div class="templates">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>模板列表</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建模板
          </el-button>
        </div>
      </template>

      <el-table :data="templates" style="width: 100%">
        <el-table-column prop="name" label="模板名称" width="200" />
        <el-table-column prop="subject" label="邮件主题" />
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by" label="创建人" width="120" />
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/templates/${row.id}`)">
            查看
          </el-button>
          <el-button link type="primary" size="small" @click="editTemplate(row)">
            编辑
          </el-button>
          <el-button 
            link 
            type="warning" 
            size="small" 
            :disabled="row.status === 'approved'"
            @click="submitApproval(row)">
            提交审批
          </el-button>
        </template>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建模板" width="800px">
      <el-form :model="templateForm" label-width="100px">
        <el-form-item label="模板名称">
          <el-input v-model="templateForm.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="邮件主题">
          <el-input v-model="templateForm.subject" placeholder="请输入邮件主题" />
        </el-form-item>
        <el-form-item label="邮件内容">
          <el-input v-model="templateForm.content" type="textarea" :rows="8" placeholder="请输入邮件内容，支持变量如 {{name}}" />
        </el-form-item>
        <el-form-item label="变量定义">
          <div v-for="(v, idx) in templateForm.variables" :key="idx" style="display: flex; gap: 10px; margin-bottom: 10px">
            <el-input v-model="v.name" placeholder="变量名" style="width: 150px" />
            <el-select v-model="v.type" placeholder="类型" style="width: 120px">
              <el-option label="字符串" value="string" />
              <el-option label="邮箱" value="email" />
              <el-option label="数字" value="number" />
              <el-option label="日期" value="date" />
            </el-select>
            <el-switch v-model="v.required" active-text="必填" />
            <el-button link type="danger" @click="templateForm.variables.splice(idx, 1)">删除</el-button>
          </div>
          <el-button type="dashed" @click="templateForm.variables.push({name: '', type: 'string', required: true})">
            添加变量
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createTemplate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showApprovalDialog" title="提交审批" width="500px">
      <el-form :model="approvalForm" label-width="100px">
        <el-form-item label="审批类型">
          <el-select v-model="approvalForm.type">
            <el-option label="模板审批" value="template" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="approvalForm.request_comment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showApprovalDialog = false">取消</el-button>
        <el-button type="primary" @click="doApproval">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { templateApi, approvalApi } from '@/api'

const templates = ref([])
const showCreateDialog = ref(false)
const showApprovalDialog = ref(false)
const currentTemplate = ref(null)

const templateForm = ref({
  name: '',
  subject: '',
  content: '',
  variables: []
})

const approvalForm = ref({
  type: 'template',
  request_comment: ''
})

const loadTemplates = async () => {
  try {
    const res = await templateApi.list()
    templates.value = res.data
  } catch (error) {
    ElMessage.error('加载模板失败')
  }
}

const createTemplate = async () => {
  try {
    await templateApi.create(templateForm.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadTemplates()
    templateForm.value = { name: '', subject: '', content: '', variables: [] }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const editTemplate = (row) => {
  ElMessage.info('编辑功能待完善')
}

const submitApproval = (row) => {
  currentTemplate.value = row
  showApprovalDialog.value = true
}

const doApproval = async () => {
  try {
    await approvalApi.create({
      ...approvalForm.value,
      template_id: currentTemplate.value.id
    })
    ElMessage.success('审批已提交')
    showApprovalDialog.value = false
    loadTemplates()
  } catch (error) {
    ElMessage.error('提交失败')
  }
}

const getStatusType = (status) => {
  const map = {
    draft: 'info',
    pending_review: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    draft: '草稿',
    pending_review: '待审批',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return map[status] || status
}

onMounted(() => {
  loadTemplates()
})
</script>
