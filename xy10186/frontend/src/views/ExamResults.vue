<template>
  <div>
    <div class="page-header">
      <div class="page-title">检查回传管理</div>
    </div>

    <div class="filter-panel">
      <el-form :inline="true" :model="filters">
        <el-form-item label="是否异常">
          <el-select v-model="filters.abnormal_flag" placeholder="全部" clearable style="width: 140px">
            <el-option label="正常" value="0" />
            <el-option label="异常" value="1" />
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
        <el-table-column prop="exam_type" label="检查类型" width="100" />
        <el-table-column prop="exam_name" label="检查项目" />
        <el-table-column prop="exam_time" label="检查时间" width="180" />
        <el-table-column prop="exam_doctor" label="检查医生" width="100" />
        <el-table-column label="是否异常" width="100">
          <template #default="{ row }">
            <el-tag :type="row.abnormal_flag ? 'danger' : 'success'" size="small">
              {{ row.abnormal_flag ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="abnormal_desc" label="异常描述" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row)">查看详情</el-button>
            <el-button type="primary" link @click="viewReferral(row.referral_order_id)">转诊单</el-button>
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

    <el-dialog v-model="detailDialogVisible" title="检查结果详情" width="600px">
      <el-descriptions :column="2" border v-if="currentItem">
        <el-descriptions-item label="转诊单号">{{ currentItem.referral_no }}</el-descriptions-item>
        <el-descriptions-item label="患者姓名">{{ currentItem.patient_name }}</el-descriptions-item>
        <el-descriptions-item label="检查类型">{{ currentItem.exam_type }}</el-descriptions-item>
        <el-descriptions-item label="检查项目">{{ currentItem.exam_name }}</el-descriptions-item>
        <el-descriptions-item label="检查时间">{{ currentItem.exam_time }}</el-descriptions-item>
        <el-descriptions-item label="检查医生">{{ currentItem.exam_doctor }}</el-descriptions-item>
        <el-descriptions-item label="是否异常">
          <el-tag :type="currentItem.abnormal_flag ? 'danger' : 'success'" size="small">
            {{ currentItem.abnormal_flag ? '异常' : '正常' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentItem.create_time }}</el-descriptions-item>
        <el-descriptions-item label="异常描述" v-if="currentItem.abnormal_flag" :span="2">
          {{ currentItem.abnormal_desc }}
        </el-descriptions-item>
        <el-descriptions-item label="检查结果" :span="2">
          <div style="white-space: pre-wrap;">{{ currentItem.exam_result }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const detailDialogVisible = ref(false)
const currentItem = ref(null)

const filters = reactive({
  abnormal_flag: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
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

    const res = await axios.get('/api/exam-results', { params })
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
  filters.abnormal_flag = ''
  pagination.page = 1
  loadData()
}

const viewDetail = (row) => {
  currentItem.value = row
  detailDialogVisible.value = true
}

const viewReferral = (id) => {
  router.push(`/referral-orders/${id}`)
}

onMounted(() => {
  loadData()
})
</script>
