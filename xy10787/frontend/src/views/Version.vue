<template>
  <div class="version-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>版本管理</span>
          <el-button type="primary" @click="openCreateDialog">新增版本</el-button>
        </div>
      </template>

      <el-table :data="versions" v-loading="loading" border>
        <el-table-column prop="version" label="版本号" width="150" />
        <el-table-column prop="language_pack.language_name" label="语言包" width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="发布状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.is_published ? 'success' : 'warning'" size="small">
              {{ row.is_published ? '已发布' : '未发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="published_at" label="发布时间" width="180">
          <template #default="{ row }">
            {{ row.published_at ? formatDate(row.published_at) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="published_by" label="发布人" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="success"
              @click="publishVersion(row)"
              :disabled="row.is_published"
            >
              发布版本
            </el-button>
            <el-button
              size="small"
              @click="regenerateReport(row)"
              :disabled="!row.is_published"
            >
              重新生成报告
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新增版本" width="500px">
      <el-form :model="versionForm" label-width="100px">
        <el-form-item label="语言包">
          <el-select v-model="versionForm.language_pack_id" style="width: 100%" placeholder="请选择语言包">
            <el-option
              v-for="pack in languagePacks"
              :key="pack.id"
              :label="`${pack.language_name} (${pack.language_code})`"
              :value="pack.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="versionForm.version" placeholder="例如: v1.0.0" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="versionForm.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createVersion">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { versionApi, translationApi } from '@/api'

const loading = ref(false)
const versions = ref([])
const languagePacks = ref([])
const createDialogVisible = ref(false)

const versionForm = reactive({
  language_pack_id: null,
  version: '',
  description: ''
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const loadVersions = async () => {
  loading.value = true
  try {
    versions.value = await versionApi.getVersions()
  } catch (error) {
    ElMessage.error('加载版本列表失败')
  } finally {
    loading.value = false
  }
}

const loadLanguagePacks = async () => {
  try {
    languagePacks.value = await translationApi.getLanguagePacks()
  } catch (error) {
    ElMessage.error('加载语言包失败')
  }
}

const openCreateDialog = () => {
  Object.assign(versionForm, {
    language_pack_id: null,
    version: '',
    description: ''
  })
  createDialogVisible.value = true
}

const createVersion = async () => {
  try {
    await versionApi.createVersion(versionForm)
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadVersions()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const publishVersion = async (row) => {
  try {
    await versionApi.publishVersion(row.id)
    ElMessage.success('发布成功')
    loadVersions()
  } catch (error) {
    ElMessage.error('发布失败')
  }
}

const regenerateReport = async (row) => {
  try {
    await versionApi.regenerateReport(row.id)
    ElMessage.success('报告重新生成成功')
  } catch (error) {
    ElMessage.error('重新生成报告失败')
  }
}

onMounted(() => {
  loadLanguagePacks()
  loadVersions()
})
</script>

<style scoped>
.version-page {
  height: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
