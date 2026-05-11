<template>
  <div class="exceptions">
    <el-card>
      <template #header>
        <span>异常管理</span>
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
            <el-option label="未处理" value="open" />
            <el-option label="已解决" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 150px;">
            <el-option label="价签缺失" value="tag_missing" />
            <el-option label="价格不符" value="price_mismatch" />
            <el-option label="价签损坏" value="damaged_tag" />
            <el-option label="位置错误" value="wrong_location" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadExceptions">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-table :data="exceptions" border v-loading="loading" style="width: 100%;">
        <el-table-column prop="store_name" label="门店" width="150" />
        <el-table-column prop="region_name" label="区域" width="100" />
        <el-table-column prop="adjustment_title" label="调价单" min-width="180" show-overflow-tooltip />
        <el-table-column prop="product_name" label="商品" width="180">
          <template #default="scope">
            <span v-if="scope.row.product_name">{{ scope.row.product_name }}</span>
            <span v-else style="color: #909399;">全单异常</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="scope">
            <el-tag :type="getExceptionTypeTag(scope.row.type)" size="small">
              {{ getExceptionTypeText(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
        <el-table-column prop="reporter_name" label="上报人" width="100" />
        <el-table-column label="上报时间" width="160">
          <template #default="scope">
            {{ formatTime(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'open' ? 'danger' : 'success'" size="small">
              {{ scope.row.status === 'open' ? '未处理' : '已解决' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="goToTask(scope.row.store_task_id)">
              查看任务
            </el-button>
            <el-button
              v-if="scope.row.status === 'open'"
              type="success"
              link
              size="small"
              @click="showResolveDialog(scope.row)"
            >
              处理
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="resolveDialogVisible"
      title="处理异常"
      width="500px"
    >
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="门店">
          <span>{{ currentException?.store_name }}</span>
        </el-form-item>
        <el-form-item label="异常类型">
          <el-tag :type="getExceptionTypeTag(currentException?.type)">
            {{ getExceptionTypeText(currentException?.type) }}
          </el-tag>
        </el-form-item>
        <el-form-item label="描述">
          <span>{{ currentException?.description }}</span>
        </el-form-item>
        <el-form-item label="处理方案">
          <el-input
            v-model="resolveForm.resolution"
            type="textarea"
            :rows="3"
            placeholder="请输入处理方案"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="resolveException">
          标记已解决
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { exceptionsAPI, regionsAPI } from '@/api'

const router = useRouter()

const loading = ref(false)
const exceptions = ref([])
const regions = ref([])
const searchForm = ref({
  regionId: null,
  status: null,
  type: null
})

const resolveDialogVisible = ref(false)
const currentException = ref(null)
const resolveForm = ref({
  resolution: ''
})

const loadExceptions = async () => {
  loading.value = true
  try {
    const [data, regionsData] = await Promise.all([
      exceptionsAPI.list({
        regionId: searchForm.value.regionId,
        status: searchForm.value.status,
        type: searchForm.value.type
      }),
      regionsAPI.list()
    ])
    exceptions.value = data
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
    type: null
  }
  loadExceptions()
}

const goToTask = (taskId) => {
  router.push(`/store-tasks/${taskId}`)
}

const showResolveDialog = (exception) => {
  currentException.value = exception
  resolveForm.value.resolution = ''
  resolveDialogVisible.value = true
}

const resolveException = async () => {
  try {
    await exceptionsAPI.resolve(currentException.value.id, {
      resolution: resolveForm.value.resolution,
      resolvedBy: 'system'
    })
    ElMessage.success('处理成功')
    resolveDialogVisible.value = false
    loadExceptions()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

const getExceptionTypeText = (type) => {
  const map = {
    tag_missing: '价签缺失',
    price_mismatch: '价格不符',
    damaged_tag: '价签损坏',
    wrong_location: '位置错误',
    other: '其他'
  }
  return map[type] || type
}

const getExceptionTypeTag = (type) => {
  const map = {
    tag_missing: 'danger',
    price_mismatch: 'warning',
    damaged_tag: 'info',
    wrong_location: '',
    other: 'info'
  }
  return map[type] || ''
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  loadExceptions()
})
</script>

<style scoped>
.search-form {
  margin-bottom: 20px;
}
</style>
