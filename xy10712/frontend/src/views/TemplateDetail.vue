<template>
  <div class="template-detail">
    <el-button @click="$router.back()" style="margin-bottom: 20px">
      <el-icon><ArrowLeft /></el-icon>
      返回
    </el-button>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <span>模板信息</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="模板名称">{{ template.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ template.version }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(template.status)">{{ getStatusText(template.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建人">{{ template.created_by }}</el-descriptions-item>
        <el-descriptions-item label="邮件主题" :span="2">{{ template.subject }}</el-descriptions-item>
        <el-descriptions-item label="邮件内容" :span="2">
          <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 0">{{ template.content }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="变量定义" :span="2">
          <el-tag v-for="v in template.variables" :key="v.name" style="margin-right: 8px">
            {{ v.name }} ({{ v.type }}) {{ v.required ? '*' : '' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
        <span>版本历史</span>
        <div>
          <el-select v-model="diffVersion1" placeholder="选择版本1" style="width: 150px; margin-right: 10px">
            <el-option v-for="v in versions" :key="v.version" :label="`v${v.version}`" :value="v.version" />
          </el-select>
          <el-select v-model="diffVersion2" placeholder="选择版本2" style="width: 150px; margin-right: 10px">
            <el-option v-for="v in versions" :key="v.version" :label="`v${v.version}`" :value="v.version" />
          </el-select>
          <el-button type="primary" size="small" @click="showDiff">对比</el-button>
        </div>
      </template>
      <el-table :data="versions">
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="subject" label="主题" />
        <el-table-column prop="created_by" label="创建人" width="120" />
        <el-table-column prop="change_description" label="变更说明" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showDiffDialog" title="版本差异" width="900px">
      <el-alert v-if="!differences.length" title="没有差异" type="info" />
      <el-table v-else :data="differences" style="width: 100%">
        <el-table-column prop="field" label="字段" width="150" />
        <el-table-column prop="old_value" label="原值" />
        <el-table-column prop="new_value" label="新值" />
        <el-table-column prop="change_type" label="变更类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.change_type }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { templateApi } from '@/api'

const route = useRoute()
const template = ref({})
const versions = ref([])
const diffVersion1 = ref(null)
const diffVersion2 = ref(null)
const showDiffDialog = ref(false)
const differences = ref([])

const loadTemplate = async () => {
  try {
    const res = await templateApi.get(route.params.id)
    template.value = res.data
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const loadVersions = async () => {
  try {
    const res = await templateApi.getVersions(route.params.id)
    versions.value = res.data
  } catch (error) {
    ElMessage.error('加载版本失败')
  }
}

const showDiff = async () => {
  if (!diffVersion1.value || !diffVersion2.value) {
    ElMessage.warning('请选择两个版本')
    return
  }
  try {
    const res = await templateApi.getDiff(route.params.id, diffVersion1.value, diffVersion2.value)
    differences.value = res.data.differences
    showDiffDialog.value = true
  } catch (error) {
    ElMessage.error('加载差异失败')
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

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadTemplate()
  loadVersions()
})
</script>
