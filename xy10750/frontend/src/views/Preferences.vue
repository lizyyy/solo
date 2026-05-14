<template>
  <div class="preferences-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>用户偏好管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增偏好
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="用户ID">
          <el-input v-model="filters.user_id" placeholder="请输入用户ID" clearable />
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="filters.channel" placeholder="请选择渠道" clearable>
            <el-option label="邮箱" value="email" />
            <el-option label="短信" value="sms" />
            <el-option label="推送" value="push" />
            <el-option label="微信" value="wechat" />
            <el-option label="APP" value="app" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="活跃" value="active" />
            <el-option label="未激活" value="inactive" />
            <el-option label="待审核" value="pending" />
            <el-option label="已暂停" value="suspended" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="user_id" label="用户ID" width="150" />
        <el-table-column prop="channel" label="渠道" width="100">
          <template #default="{ row }">
            <el-tag>{{ row.channel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="topics" label="订阅主题" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="(topic, index) in row.topics"
              :key="index"
              style="margin: 2px"
            >
              {{ topic }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dnd_enabled" label="免打扰" width="100">
          <template #default="{ row }">
            <el-tag :type="row.dnd_enabled ? 'warning' : 'success'">
              {{ row.dnd_enabled ? '开启' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dnd_start_time" label="开始时间" width="120" />
        <el-table-column prop="dnd_end_time" label="结束时间" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="updated_at" label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="success" @click="handleReview(row)">复核</el-button>
            <el-button link type="warning" @click="handleVersions(row)">版本</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="fetchList"
        @current-change="fetchList"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="120px">
        <el-form-item label="用户ID" :required="true">
          <el-input v-model="form.user_id" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="渠道" :required="true">
          <el-select v-model="form.channel" :disabled="isEdit">
            <el-option label="邮箱" value="email" />
            <el-option label="短信" value="sms" />
            <el-option label="推送" value="push" />
            <el-option label="微信" value="wechat" />
            <el-option label="APP" value="app" />
          </el-select>
        </el-form-item>
        <el-form-item label="订阅主题" :required="true">
          <el-select v-model="form.topics" multiple placeholder="请选择订阅主题">
            <el-option label="营销活动" value="marketing" />
            <el-option label="系统通知" value="system" />
            <el-option label="订单通知" value="order" />
            <el-option label="账户通知" value="account" />
            <el-option label="安全提醒" value="security" />
          </el-select>
        </el-form-item>
        <el-form-item label="免打扰">
          <el-switch v-model="form.dnd_enabled" />
        </el-form-item>
        <el-form-item v-if="form.dnd_enabled" label="免打扰时段">
          <el-time-picker
            v-model="dnd_time_range"
            is-range
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm"
          />
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <el-select v-model="form.status">
            <el-option label="活跃" value="active" />
            <el-option label="未激活" value="inactive" />
            <el-option label="待审核" value="pending" />
            <el-option label="已暂停" value="suspended" />
          </el-select>
        </el-form-item>
        <el-form-item label="变更原因" v-if="isEdit" :required="true">
          <el-input v-model="form.change_reason" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="操作人" :required="true">
          <el-input v-model="form.operator" />
        </el-form-item>
        <el-form-item label="请求ID" :required="true">
          <el-input v-model="form.request_id" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="reviewDrawerVisible"
      title="偏好详情复核"
      direction="rtl"
      size="600px"
    >
      <el-descriptions :column="1" border v-if="currentPreference">
        <el-descriptions-item label="ID">{{ currentPreference.id }}</el-descriptions-item>
        <el-descriptions-item label="用户ID">{{ currentPreference.user_id }}</el-descriptions-item>
        <el-descriptions-item label="渠道">{{ currentPreference.channel }}</el-descriptions-item>
        <el-descriptions-item label="订阅主题">
          <el-tag v-for="(topic, index) in currentPreference.topics" :key="index" style="margin: 2px">
            {{ topic }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="免打扰">
          {{ currentPreference.dnd_enabled ? '开启' : '关闭' }}
        </el-descriptions-item>
        <el-descriptions-item label="免打扰开始时间">{{ currentPreference.dnd_start_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="免打扰结束时间">{{ currentPreference.dnd_end_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ currentPreference.status }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ currentPreference.version }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ currentPreference.created_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="更新人">{{ currentPreference.updated_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(currentPreference.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDate(currentPreference.updated_at) }}</el-descriptions-item>
      </el-descriptions>
      <div class="drawer-footer" style="margin-top: 20px; text-align: right">
        <el-button @click="reviewDrawerVisible = false">关闭</el-button>
      </div>
    </el-drawer>

    <el-dialog
      v-model="versionsDialogVisible"
      title="版本历史"
      width="800px"
    >
      <el-table :data="versionList" border>
        <el-table-column prop="version" label="版本号" width="100" />
        <el-table-column prop="channel" label="渠道" width="100" />
        <el-table-column prop="topics" label="订阅主题" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="(topic, index) in (row.topics || [])" :key="index" style="margin: 2px">
              {{ topic }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="change_reason" label="变更原因" min-width="150" />
        <el-table-column prop="changed_by" label="操作人" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click="handleRollback(row)"
            >
              回滚
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { preferenceApi } from '../api'

const tableData = ref([])
const dialogVisible = ref(false)
const reviewDrawerVisible = ref(false)
const versionsDialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const currentPreference = ref(null)
const versionList = ref([])
const dnd_time_range = ref([])

const filters = reactive({
  user_id: '',
  channel: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const form = reactive({
  id: null,
  user_id: '',
  channel: '',
  topics: [],
  dnd_enabled: false,
  dnd_start_time: '',
  dnd_end_time: '',
  status: 'active',
  change_reason: '',
  operator: '',
  request_id: ''
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = {
    active: 'success',
    inactive: 'info',
    pending: 'warning',
    suspended: 'danger'
  }
  return map[status] || 'info'
}

const fetchList = async () => {
  try {
    const params = {
      ...filters,
      page: pagination.page,
      page_size: pagination.page_size
    }
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key]
      }
    })
    const res = await preferenceApi.getList(params)
    tableData.value = res.data.data
    pagination.total = res.data.total
  } catch (error) {
    ElMessage.error('获取列表失败')
  }
}

const resetFilters = () => {
  filters.user_id = ''
  filters.channel = ''
  filters.status = ''
  pagination.page = 1
  fetchList()
}

const handleAdd = () => {
  dialogTitle.value = '新增偏好'
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑偏好'
  isEdit.value = true
  form.id = row.id
  form.user_id = row.user_id
  form.channel = row.channel
  form.topics = [...row.topics]
  form.dnd_enabled = row.dnd_enabled
  form.dnd_start_time = row.dnd_start_time
  form.dnd_end_time = row.dnd_end_time
  form.status = row.status
  if (row.dnd_start_time && row.dnd_end_time) {
    dnd_time_range.value = [row.dnd_start_time, row.dnd_end_time]
  } else {
    dnd_time_range.value = []
  }
  dialogVisible.value = true
}

const handleReview = (row) => {
  currentPreference.value = row
  reviewDrawerVisible.value = true
}

const handleVersions = async (row) => {
  currentPreference.value = row
  try {
    const res = await preferenceApi.getVersions(row.id)
    versionList.value = res.data
    versionsDialogVisible.value = true
  } catch (error) {
    ElMessage.error('获取版本历史失败')
  }
}

const handleRollback = async (versionRow) => {
  try {
    await ElMessageBox.confirm(
      `确定要回滚到版本 ${versionRow.version} 吗？`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const operator = form.operator || 'admin'
    await preferenceApi.rollback(currentPreference.value.id, versionRow.version, operator)
    ElMessage.success('回滚成功')
    versionsDialogVisible.value = false
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('回滚失败')
    }
  }
}

const handleSubmit = async () => {
  if (!form.user_id || !form.channel || !form.topics.length || !form.request_id || !form.operator) {
    ElMessage.warning('请填写必填项')
    return
  }

  if (dnd_time_range.value && dnd_time_range.value.length === 2) {
    form.dnd_start_time = dnd_time_range.value[0]
    form.dnd_end_time = dnd_time_range.value[1]
  }

  try {
    if (isEdit.value) {
      const data = {
        channel: form.channel,
        topics: form.topics,
        dnd_enabled: form.dnd_enabled,
        dnd_start_time: form.dnd_start_time,
        dnd_end_time: form.dnd_end_time,
        status: form.status,
        change_reason: form.change_reason,
        updated_by: form.operator,
        request_id: form.request_id
      }
      await preferenceApi.update(form.id, data)
      ElMessage.success('更新成功')
    } else {
      const data = {
        user_id: form.user_id,
        channel: form.channel,
        topics: form.topics,
        dnd_enabled: form.dnd_enabled,
        dnd_start_time: form.dnd_start_time,
        dnd_end_time: form.dnd_end_time,
        created_by: form.operator,
        request_id: form.request_id
      }
      await preferenceApi.create(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error(error.response?.data?.detail || '操作失败')
  }
}

const resetForm = () => {
  form.id = null
  form.user_id = ''
  form.channel = ''
  form.topics = []
  form.dnd_enabled = false
  form.dnd_start_time = ''
  form.dnd_end_time = ''
  form.status = 'active'
  form.change_reason = ''
  form.operator = ''
  form.request_id = ''
  dnd_time_range.value = []
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.preferences-page {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}

.drawer-footer {
  padding: 10px 0;
  border-top: 1px solid #eee;
}
</style>