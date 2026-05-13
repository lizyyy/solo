<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>拼配方案管理</span>
          <el-button type="primary" @click="router.push('/schemes/new')">
            <el-icon><Plus /></el-icon>新建方案
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="草稿" value="draft" />
            <el-option label="已审核" value="approved" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="方案名称/编号" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="scheme_no" label="方案编号" width="160" />
        <el-table-column prop="name" label="方案名称" />
        <el-table-column prop="version" label="版本" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">V{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="比例合计" width="100" align="center">
          <template #default="{ row }">
            <span :class="{ 'error': Math.abs(row.total_ratio - 100) > 0.01 }">
              {{ row.total_ratio }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="tasting_count" label="试饮数" width="80" align="center" />
        <el-table-column label="平均评分" width="120">
          <template #default="{ row }">
            <el-rate v-if="row.avg_rating" :model-value="row.avg_rating" disabled show-score text-color="#ff9900" />
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'approved' ? 'success' : 'info'" size="small">
              {{ row.status === 'approved' ? '已审核' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/schemes/${row.id}`)">详情</el-button>
            <el-button link type="success" @click="copyScheme(row)" v-if="row.status === 'approved'">新版</el-button>
            <el-button link type="warning" @click="approveScheme(row)" v-if="row.status === 'draft'">审核</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { schemeApi } from '../api'

const router = useRouter()
const tableData = ref([])

const filters = reactive({
  status: '',
  keyword: ''
})

const resetFilters = () => {
  filters.status = ''
  filters.keyword = ''
  loadData()
}

const loadData = async () => {
  try {
    const res = await schemeApi.list(filters)
    tableData.value = res.data
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const copyScheme = (row: any) => {
  sessionStorage.setItem('copy_scheme_id', row.id)
  router.push('/schemes/new')
}

const approveScheme = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      '确认审核通过该方案？审核后可用于生产入库。',
      '审核方案',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await schemeApi.approve(row.id)
    ElMessage.success('审核成功')
    loadData()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '审核失败')
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.error {
  color: #F56C6C;
  font-weight: 600;
}

.text-muted {
  color: #909399;
}
</style>
