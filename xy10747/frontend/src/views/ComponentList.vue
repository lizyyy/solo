<template>
  <div class="container">
    <div class="page-header">
      <h1 class="page-title">组件列表</h1>
      <div style="display: flex; gap: 12px;">
        <el-button type="primary" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出数据
        </el-button>
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新增组件
        </el-button>
      </div>
    </div>

    <el-card class="card">
      <el-table :data="components" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="组件名称" min-width="180" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.type" size="small">{{ row.type }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
        <el-table-column prop="current_version" label="当前版本" width="120">
          <template #default="{ row }">
            <el-tag type="success" size="small" v-if="row.current_version">
              {{ row.current_version }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goToDetail(row.id)">
              查看详情
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新增组件" width="500px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="组件名称">
          <el-input v-model="createForm.name" placeholder="请输入组件名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="createForm.type" placeholder="请输入组件类型" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="请输入组件描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'
import { componentAPI } from '../api'

const router = useRouter()
const components = ref([])
const loading = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)
const createForm = ref({
  name: '',
  type: '',
  description: ''
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const loadComponents = async () => {
  loading.value = true
  try {
    const res = await componentAPI.list()
    components.value = res.data
  } catch (error) {
    ElMessage.error('加载组件列表失败')
  } finally {
    loading.value = false
  }
}

const goToDetail = (id) => {
  router.push(`/components/${id}`)
}

const handleCreate = async () => {
  if (!createForm.value.name) {
    ElMessage.warning('请输入组件名称')
    return
  }
  creating.value = true
  try {
    await componentAPI.create(createForm.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    createForm.value = { name: '', type: '', description: '' }
    loadComponents()
  } catch (error) {
    ElMessage.error('创建失败')
  } finally {
    creating.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除组件"${row.name}"吗？`, '提示', {
      type: 'warning'
    })
    await componentAPI.delete(row.id)
    ElMessage.success('删除成功')
    loadComponents()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleExport = async () => {
  try {
    const res = await componentAPI.export({})
    const blob = new Blob([res.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `components_export_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  loadComponents()
})
</script>
