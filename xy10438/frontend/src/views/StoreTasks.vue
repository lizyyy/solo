<template>
  <div class="store-tasks">
    <el-card>
      <template #header>
        <span>门店任务列表</span>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="区域">
          <el-select v-model="searchForm.regionId" placeholder="全部区域" clearable style="width: 150px;">
            <el-option
              v-for="region in regions"
              :key="region.id"
              :label="region.name"
              :value="region.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px;">
            <el-option label="待确认" value="pending" />
            <el-option label="部分确认" value="partial_confirmed" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="有异常" value="has_exception" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索门店或调价单"
            clearable
            style="width: 200px;"
            @keyup.enter="loadTasks"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadTasks">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tasks" border v-loading="loading" style="width: 100%;">
        <el-table-column prop="store_name" label="门店名称" width="180" />
        <el-table-column prop="store_code" label="门店编码" width="120" />
        <el-table-column prop="region_name" label="区域" width="100" />
        <el-table-column prop="adjustment_title" label="调价单" min-width="200" show-overflow-tooltip />
        <el-table-column label="调价类型" width="100">
          <template #default="scope">
            <el-tag :type="getAdjustmentTypeTag(scope.row.adjustment_type)">
              {{ getAdjustmentTypeText(scope.row.adjustment_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="任务状态" width="100">
          <template #default="scope">
            <el-tag :type="getTaskStatusTag(scope.row.status)">
              {{ getTaskStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="完成进度" width="150">
          <template #default="scope">
            <el-progress
              :percentage="Math.round((scope.row.confirmed_items || 0) / (scope.row.total_items || 1) * 100)"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column prop="open_exceptions" label="异常数" width="80" align="center">
          <template #default="scope">
            <span v-if="scope.row.open_exceptions > 0" style="color: #f56c6c; font-weight: bold;">
              {{ scope.row.open_exceptions }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="生效时间" width="160">
          <template #default="scope">
            {{ formatTime(scope.row.effect_time) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="viewDetail(scope.row.id)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { storeTasksAPI, regionsAPI } from '@/api'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const tasks = ref([])
const regions = ref([])
const searchForm = ref({
  regionId: null,
  status: null,
  keyword: ''
})

const loadTasks = async () => {
  loading.value = true
  try {
    const [tasksData, regionsData] = await Promise.all([
      storeTasksAPI.list({
        regionId: searchForm.value.regionId,
        status: searchForm.value.status,
        keyword: searchForm.value.keyword
      }),
      regionsAPI.list()
    ])
    tasks.value = tasksData
    regions.value = regionsData
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.value = {
    regionId: null,
    status: null,
    keyword: ''
  }
  loadTasks()
}

const viewDetail = (id) => {
  router.push(`/store-tasks/${id}`)
}

const getAdjustmentTypeText = (type) => {
  const map = {
    promotion: '促销调价',
    regional: '区域调价',
    regular: '常规调价'
  }
  return map[type] || type
}

const getAdjustmentTypeTag = (type) => {
  const map = {
    promotion: 'danger',
    regional: 'warning',
    regular: ''
  }
  return map[type] || ''
}

const getTaskStatusText = (status) => {
  const map = {
    pending: '待确认',
    partial_confirmed: '部分确认',
    confirmed: '已确认',
    has_exception: '有异常'
  }
  return map[status] || status
}

const getTaskStatusTag = (status) => {
  const map = {
    pending: 'warning',
    partial_confirmed: 'info',
    confirmed: 'success',
    has_exception: 'danger'
  }
  return map[status] || 'info'
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  if (route.query.regionId) {
    searchForm.value.regionId = route.query.regionId
  }
  loadTasks()
})

watch(() => route.query.regionId, (newVal) => {
  if (newVal) {
    searchForm.value.regionId = newVal
    loadTasks()
  }
})
</script>

<style scoped>
.search-form {
  margin-bottom: 20px;
}
</style>
