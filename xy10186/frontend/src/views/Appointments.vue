<template>
  <div>
    <div class="page-header">
      <div class="page-title">预约占用管理</div>
    </div>

    <div class="filter-panel">
      <el-form :inline="true" :model="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option label="已预约" value="scheduled" />
            <el-option label="进行中" value="ongoing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
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
        <el-table-column prop="check_type" label="检查类型" width="100" />
        <el-table-column prop="check_item" label="检查项目" />
        <el-table-column prop="dept_name" label="预约科室" width="120" />
        <el-table-column prop="bed_no" label="床位" width="80" />
        <el-table-column prop="appointment_time" label="预约时间" width="180" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewReferral(row.referral_order_id)">查看转诊单</el-button>
            <el-button link @click="updateStatus(row, 'ongoing')" v-if="row.status === 'scheduled'">开始</el-button>
            <el-button link type="success" @click="updateStatus(row, 'completed')" v-if="row.status === 'ongoing'">完成</el-button>
            <el-button link type="danger" @click="updateStatus(row, 'cancelled')" v-if="['scheduled', 'ongoing'].includes(row.status)">取消</el-button>
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

const filters = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const getStatusText = (status) => {
  const map = {
    'scheduled': '已预约',
    'ongoing': '进行中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return map[status] || status
}

const getStatusType = (status) => {
  const map = {
    'scheduled': 'info',
    'ongoing': 'warning',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return map[status] || 'info'
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...filters,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    Object.keys(params).forEach(key => {
      if (!params[key]) delete params[key]
    })

    const res = await axios.get('/api/appointments', { params })
    if (res.data.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    }
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.status = ''
  pagination.page = 1
  loadData()
}

const viewReferral = (id) => {
  router.push(`/referral-orders/${id}`)
}

const updateStatus = async (row, status) => {
  try {
    const res = await axios.put(`/api/appointments/${row.id}/status`, { status })
    if (res.data.success) {
      ElMessage.success('操作成功')
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
