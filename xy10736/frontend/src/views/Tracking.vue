<template>
  <div class="tracking-page">
    <div class="page-header">
      <h2 class="page-title">埋点管理</h2>
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>新增埋点
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="版本">
          <el-input v-model="filters.version" placeholder="输入版本号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadPoints">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="points" stripe v-loading="loading">
        <el-table-column prop="name" label="埋点名称" width="160" />
        <el-table-column prop="code" label="埋点编码" width="200" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="page" label="所属页面" width="140" />
        <el-table-column prop="eventType" label="事件类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ getEventTypeText(row.eventType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadPoints"
        @current-change="loadPoints"
        class="pagination"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingPoint ? '编辑埋点' : '新增埋点'" width="600">
      <el-form :model="pointForm" label-width="100px">
        <el-form-item label="埋点名称" required>
          <el-input v-model="pointForm.name" placeholder="例如: 首页曝光" />
        </el-form-item>
        <el-form-item label="埋点编码" required>
          <el-input v-model="pointForm.code" placeholder="例如: page_home_view" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="pointForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="所属页面" required>
          <el-input v-model="pointForm.page" placeholder="例如: 首页" />
        </el-form-item>
        <el-form-item label="事件类型" required>
          <el-select v-model="pointForm.eventType" placeholder="选择事件类型">
            <el-option label="页面曝光" value="pageview" />
            <el-option label="点击事件" value="click" />
            <el-option label="自定义事件" value="track" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号" required>
          <el-input v-model="pointForm.version" placeholder="例如: v2.1.0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="pointForm.status" active-value="active" inactive-value="inactive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPoint">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { trackingAPI } from '@/api'

const loading = ref(false)
const points = ref([])
const dialogVisible = ref(false)
const editingPoint = ref(null)
const filters = reactive({ version: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const pointForm = reactive({
  name: '',
  code: '',
  description: '',
  page: '',
  eventType: '',
  version: '',
  status: 'active',
  required: true
})

const loadPoints = async () => {
  loading.value = true
  try {
    const res = await trackingAPI.getPoints({
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters
    })
    points.value = res.data.data
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.version = ''
  filters.status = ''
  loadPoints()
}

const showCreateDialog = () => {
  editingPoint.value = null
  Object.assign(pointForm, {
    name: '',
    code: '',
    description: '',
    page: '',
    eventType: '',
    version: '',
    status: 'active',
    required: true
  })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  editingPoint.value = row
  Object.assign(pointForm, { ...row })
  dialogVisible.value = true
}

const submitPoint = async () => {
  if (!pointForm.name || !pointForm.code || !pointForm.page || !pointForm.eventType || !pointForm.version) {
    ElMessage.warning('请填写必填项')
    return
  }
  if (editingPoint.value) {
    await trackingAPI.updatePoint(editingPoint.value.id, pointForm)
    ElMessage.success('更新成功')
  } else {
    await trackingAPI.createPoint(pointForm)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadPoints()
}

const getEventTypeText = (type) => {
  const map = { pageview: '页面曝光', click: '点击事件', track: '自定义事件' }
  return map[type] || type
}

const formatDate = (date) => new Date(date).toLocaleString('zh-CN')

onMounted(loadPoints)
</script>

<style scoped>
.tracking-page { padding: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title { font-size: 24px; color: #303133; margin: 0; }
.filter-card { margin-bottom: 24px; border-radius: 12px; }
.filter-form { margin: 0; }
.table-card { border-radius: 12px; }
.pagination { margin-top: 24px; text-align: right; }
</style>
