<template>
  <div class="record-list">
    <el-card class="search-card">
      <el-form :model="searchForm" inline size="small">
        <el-form-item label="服务名称">
          <el-input v-model="searchForm.service_name" placeholder="输入服务名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="选择状态" clearable>
            <el-option label="生效中" value="active" />
            <el-option label="已停用" value="inactive" />
            <el-option label="已归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRecords" :icon="Search">搜索</el-button>
          <el-button @click="resetSearch" :icon="Refresh">重置</el-button>
          <el-button type="success" @click="saveCurrentQuery" :icon="Star">保存查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="action-card">
      <el-button type="primary" @click="openCreateDialog" :icon="Plus">新建记录</el-button>
      <el-button type="success" @click="exportRecords" :icon="Download">导出Excel</el-button>
      <el-dropdown @command="loadSavedQuery">
        <el-button :icon="Document">
          已保存查询<el-icon class="el-icon--right"><arrow-down /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="query in savedQueries" :key="query.id" :command="query">
              {{ query.name }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-card>

    <el-card>
      <el-table :data="records" v-loading="loading" border stripe>
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="序号" width="80" />
        <el-table-column prop="service_name" label="服务名称" min-width="150" />
        <el-table-column prop="sampling_rule" label="采样规则" min-width="200" show-overflow-tooltip />
        <el-table-column prop="trace_id" label="Trace ID" width="180" />
        <el-table-column prop="error_fragment_status" label="错误状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.error_fragment_status)">
              {{ getStatusText(row.error_fragment_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_manually_confirmed" label="人工确认" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_manually_confirmed ? 'success' : 'info'">
              {{ row.is_manually_confirmed ? '已确认' : '待确认' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openReviewDrawer(row)">复核</el-button>
            <el-button link type="success" size="small" @click="openVersionsDrawer(row)">版本</el-button>
            <el-button link type="warning" size="small" @click="analyzeError(row)" :disabled="!row.error_fragment">分析错误</el-button>
            <el-button link type="info" size="small" @click="confirmRecord(row)" :disabled="row.is_manually_confirmed">确认</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadRecords"
        @current-change="loadRecords"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建记录" width="600px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="服务名称" required>
          <el-input v-model="createForm.service_name" />
        </el-form-item>
        <el-form-item label="采样规则" required>
          <el-input v-model="createForm.sampling_rule" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="Trace ID">
          <el-input v-model="createForm.trace_id" />
        </el-form-item>
        <el-form-item label="错误片段">
          <el-input v-model="createForm.error_fragment" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="排障摘要">
          <el-input v-model="createForm.troubleshooting_summary" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="createForm.created_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createRecord">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="reviewDrawerVisible" title="复核记录" size="50%">
      <div v-if="currentRecord" class="review-content">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="服务名称">{{ currentRecord.service_name }}</el-descriptions-item>
          <el-descriptions-item label="采样规则">{{ currentRecord.sampling_rule }}</el-descriptions-item>
          <el-descriptions-item label="Trace ID">{{ currentRecord.trace_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="错误片段">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">{{ currentRecord.error_fragment || '-' }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="排障摘要">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">{{ currentRecord.troubleshooting_summary || '-' }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="当前错误状态">
            <el-tag :type="getStatusType(currentRecord.error_fragment_status)">
              {{ getStatusText(currentRecord.error_fragment_status) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>修正内容</el-divider>

        <el-form :model="updateForm" label-width="120px">
          <el-form-item label="错误状态">
            <el-select v-model="updateForm.error_fragment_status">
              <el-option label="待处理" value="pending" />
              <el-option label="已分析" value="analyzed" />
              <el-option label="已解决" value="resolved" />
              <el-option label="无错误" value="none" />
            </el-select>
          </el-form-item>
          <el-form-item label="排障摘要">
            <el-input v-model="updateForm.troubleshooting_summary" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item label="变更原因">
            <el-input v-model="updateForm.change_reason" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="操作人">
            <el-input v-model="updateForm.changed_by" />
          </el-form-item>
        </el-form>

        <div class="drawer-footer">
          <el-button @click="reviewDrawerVisible = false">取消</el-button>
          <el-button type="primary" @click="updateRecord">保存修改</el-button>
        </div>
      </div>
    </el-drawer>

    <el-drawer v-model="versionsDrawerVisible" title="版本历史" size="40%">
      <div v-if="currentRecord" class="versions-content">
        <el-timeline>
          <el-timeline-item
            v-for="version in versions"
            :key="version.id"
            :timestamp="formatDate(version.created_at)"
          >
            <el-card shadow="hover" class="version-card">
              <template #header>
                <div class="version-header">
                  <span class="version-number">版本 {{ version.version_number }}</span>
                  <el-button
                    link
                    type="primary"
                    size="small"
                    @click="rollbackToVersion(version.version_number)"
                  >
                    回滚到此版本
                  </el-button>
                </div>
              </template>
              <p><strong>变更原因：</strong>{{ version.change_reason || '-' }}</p>
              <p><strong>操作人：</strong>{{ version.changed_by || '-' }}</p>
              <p><strong>服务名称：</strong>{{ version.service_name }}</p>
              <p><strong>采样规则：</strong>{{ version.sampling_rule }}</p>
              <p v-if="version.trace_id"><strong>Trace ID：</strong>{{ version.trace_id }}</p>
              <p v-if="version.error_fragment"><strong>错误片段：</strong>{{ version.error_fragment }}</p>
              <p v-if="version.troubleshooting_summary"><strong>排障摘要：</strong>{{ version.troubleshooting_summary }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>

    <el-dialog v-model="saveQueryDialogVisible" title="保存查询" width="400px">
      <el-form :model="saveQueryForm" label-width="80px">
        <el-form-item label="查询名称" required>
          <el-input v-model="saveQueryForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="saveQueryForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveQueryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doSaveQuery">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Download, Document, Star, ArrowDown } from '@element-plus/icons-vue'
import { recordsApi, savedQueriesApi, exportApi, idempotencyApi } from '../api/records'

const loading = ref(false)
const records = ref([])
const savedQueries = ref([])
const createDialogVisible = ref(false)
const reviewDrawerVisible = ref(false)
const versionsDrawerVisible = ref(false)
const saveQueryDialogVisible = ref(false)
const currentRecord = ref(null)
const versions = ref([])

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const searchForm = reactive({
  service_name: '',
  status: ''
})

const createForm = reactive({
  service_name: '',
  sampling_rule: '',
  trace_id: '',
  error_fragment: '',
  troubleshooting_summary: '',
  created_by: ''
})

const updateForm = reactive({
  error_fragment_status: '',
  troubleshooting_summary: '',
  change_reason: '',
  changed_by: ''
})

const saveQueryForm = reactive({
  name: '',
  description: ''
})

const loadRecords = async () => {
  loading.value = true
  try {
    const params = {
      skip: (pagination.page - 1) * pagination.limit,
      limit: pagination.limit,
      service_name: searchForm.service_name || undefined,
      status: searchForm.status || undefined
    }
    const res = await recordsApi.list(params)
    records.value = res.data.items
    pagination.total = res.data.total
  } catch (error) {
    ElMessage.error('加载记录失败')
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.service_name = ''
  searchForm.status = ''
  pagination.page = 1
  loadRecords()
}

const openCreateDialog = () => {
  Object.keys(createForm).forEach(key => createForm[key] = '')
  createDialogVisible.value = true
}

const createRecord = async () => {
  if (!createForm.service_name || !createForm.sampling_rule) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    const idempotencyData = { ...createForm }
    const keyRes = await idempotencyApi.generate(idempotencyData)
    const recordData = { ...createForm, request_idempotency_key: keyRes.data.idempotency_key }
    await recordsApi.create(recordData)
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadRecords()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const openReviewDrawer = (row) => {
  currentRecord.value = { ...row }
  updateForm.error_fragment_status = row.error_fragment_status
  updateForm.troubleshooting_summary = row.troubleshooting_summary
  updateForm.change_reason = ''
  updateForm.changed_by = ''
  reviewDrawerVisible.value = true
}

const updateRecord = async () => {
  if (!updateForm.changed_by) {
    ElMessage.warning('请填写操作人')
    return
  }

  try {
    await recordsApi.update(currentRecord.value.id, { ...updateForm })
    ElMessage.success('修改成功')
    reviewDrawerVisible.value = false
    loadRecords()
  } catch (error) {
    ElMessage.error('修改失败')
  }
}

const openVersionsDrawer = async (row) => {
  currentRecord.value = { ...row }
  versionsDrawerVisible.value = true
  try {
    const res = await recordsApi.versions(row.id)
    versions.value = res.data
  } catch (error) {
    ElMessage.error('加载版本历史失败')
  }
}

const rollbackToVersion = async (versionNumber) => {
  try {
    await ElMessageBox.confirm(`确定要回滚到版本 ${versionNumber} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const rolledBackBy = prompt('请输入操作人:')
    if (!rolledBackBy) {
      ElMessage.warning('请输入操作人')
      return
    }

    await recordsApi.rollback(currentRecord.value.id, versionNumber, rolledBackBy)
    ElMessage.success('回滚成功')
    openVersionsDrawer(currentRecord.value)
    loadRecords()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('回滚失败')
    }
  }
}

const analyzeError = async (row) => {
  try {
    const res = await recordsApi.analyzeError(row.id)
    ElMessage.success(`分析完成: ${res.data.summary}`)
    loadRecords()
  } catch (error) {
    ElMessage.error('分析失败')
  }
}

const confirmRecord = async (row) => {
  try {
    const confirmedBy = prompt('请输入确认人:')
    if (!confirmedBy) {
      ElMessage.warning('请输入确认人')
      return
    }
    await recordsApi.confirm(row.id, confirmedBy)
    ElMessage.success('确认成功')
    loadRecords()
  } catch (error) {
    ElMessage.error('确认失败')
  }
}

const exportRecords = async () => {
  try {
    const params = {
      service_name: searchForm.service_name || undefined
    }
    const res = await exportApi.excel(params)
    
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `日志采样记录_${new Date().getTime()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const saveCurrentQuery = () => {
  saveQueryForm.name = ''
  saveQueryForm.description = ''
  saveQueryDialogVisible.value = true
}

const doSaveQuery = async () => {
  if (!saveQueryForm.name) {
    ElMessage.warning('请填写查询名称')
    return
  }

  try {
    await savedQueriesApi.create({
      name: saveQueryForm.name,
      query_params: JSON.stringify(searchForm),
      description: saveQueryForm.description,
      created_by: 'user'
    })
    ElMessage.success('保存成功')
    saveQueryDialogVisible.value = false
    loadSavedQueries()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const loadSavedQueries = async () => {
  try {
    const res = await savedQueriesApi.list()
    savedQueries.value = res.data
  } catch (error) {
    console.error('加载保存的查询失败')
  }
}

const loadSavedQuery = (query) => {
  try {
    const params = JSON.parse(query.query_params)
    searchForm.service_name = params.service_name || ''
    searchForm.status = params.status || ''
    pagination.page = 1
    loadRecords()
    ElMessage.success(`已加载查询: ${query.name}`)
  } catch (error) {
    ElMessage.error('加载查询失败')
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    analyzed: 'info',
    resolved: 'success',
    none: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    analyzed: '已分析',
    resolved: '已解决',
    none: '无错误'
  }
  return map[status] || status
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadRecords()
  loadSavedQueries()
})
</script>

<style scoped>
.record-list {
  padding: 20px;
}

.search-card,
.action-card {
  margin-bottom: 20px;
}

.action-card .el-button {
  margin-right: 10px;
}

.review-content,
.versions-content {
  padding: 0 20px;
}

.drawer-footer {
  margin-top: 30px;
  text-align: right;
}

.version-card {
  margin-bottom: 15px;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-number {
  font-weight: bold;
  color: #409eff;
}

pre {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
