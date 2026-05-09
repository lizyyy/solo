<template>
  <div>
    <div class="page-header">
      <div class="page-title">异常提醒管理</div>
      <el-button @click="loadData">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-row :gutter="16" style="margin-bottom: 20px;">
      <el-col :span="8">
        <div class="stat-card" style="background: #fef0f0;">
          <div class="stat-value" style="color: #F56C6C;">{{ statistics.unhandled }}</div>
          <div class="stat-label">待处理异常</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card" style="background: #fdf6ec;">
          <div class="stat-value" style="color: #E6A23C;">{{ statistics.warning }}</div>
          <div class="stat-label">警告级别</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card" style="background: #f4f4f5;">
          <div class="stat-value" style="color: #909399;">{{ statistics.handled }}</div>
          <div class="stat-label">已处理</div>
        </div>
      </el-col>
    </el-row>

    <div class="filter-panel">
      <el-form :inline="true" :model="filters">
        <el-form-item label="处理状态">
          <el-select v-model="filters.handled" placeholder="全部" clearable style="width: 140px">
            <el-option label="待处理" value="0" />
            <el-option label="已处理" value="1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilters">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="referral_no" label="转诊单号" width="180" />
        <el-table-column prop="patient_name" label="患者姓名" width="100" />
        <el-table-column prop="exception_type" label="异常类型" width="120" />
        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="row.exception_level === 'danger' ? 'danger' : 'warning'" size="small">
              {{ row.exception_level === 'danger' ? '严重' : '警告' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="exception_content" label="异常内容" min-width="200" show-overflow-tooltip />
        <el-table-column label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.handled ? 'success' : 'danger'" size="small">
              {{ row.handled ? '已处理' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handle_user" label="处理人" width="100" />
        <el-table-column prop="handle_result" label="处理结果" min-width="150" show-overflow-tooltip />
        <el-table-column prop="create_time" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewReferral(row.referral_order_id)">转诊单</el-button>
            <el-button link type="warning" @click="handleException(row)" v-if="!row.handled">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 16px; text-align: right;">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </div>

    <el-dialog v-model="handleDialogVisible" title="处理异常" width="500px">
      <el-form :model="handleForm" label-width="100px">
        <el-form-item label="处理人">
          <el-input v-model="handleForm.handle_user" />
        </el-form-item>
        <el-form-item label="处理结果">
          <el-input v-model="handleForm.handle_result" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const handleDialogVisible = ref(false)
const currentException = ref(null)

const statistics = reactive({
  unhandled: 0,
  warning: 0,
  handled: 0
})

const filters = reactive({
  handled: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const handleForm = reactive({
  handle_user: '',
  handle_result: ''
})

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...filters,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    Object.keys(params).forEach(key => {
      if (params[key] === '') delete params[key]
    })

    const [listRes, allRes] = await Promise.all([
      axios.get('/api/exceptions', { params }),
      axios.get('/api/exceptions')
    ])

    if (listRes.data.success) {
      tableData.value = listRes.data.data
      pagination.total = listRes.data.total
    }

    if (allRes.data.success) {
      const allExceptions = allRes.data.data
      statistics.unhandled = allExceptions.filter(e => !e.handled).length
      statistics.warning = allExceptions.filter(e => e.exception_level === 'warning').length
      statistics.handled = allExceptions.filter(e => e.handled).length
    }
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.handled = ''
  pagination.page = 1
  loadData()
}

const viewReferral = (id) => {
  router.push(`/referral-orders/${id}`)
}

const handleException = (row) => {
  currentException.value = row
  handleForm.handle_user = ''
  handleForm.handle_result = ''
  handleDialogVisible.value = true
}

const submitHandle = async () => {
  if (!handleForm.handle_user || !handleForm.handle_result) {
    ElMessage.warning('请填写处理人和处理结果')
    return
  }

  try {
    const res = await axios.put(`/api/exceptions/${currentException.value.id}/handle`, handleForm)
    if (res.data.success) {
      ElMessage.success('处理成功')
      handleDialogVisible.value = false
      loadData()
    }
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
