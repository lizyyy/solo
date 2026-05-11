<template>
  <div class="regions">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>区域管理</span>
        </div>
      </template>

      <el-table :data="regions" border v-loading="loading" style="width: 100%;">
        <el-table-column prop="code" label="区域编码" width="150" />
        <el-table-column prop="name" label="区域名称" width="200" />
        <el-table-column label="门店数" width="100" align="center">
          <template #default="scope">
            <span style="font-weight: bold;">{{ scope.row.store_count || 0 }}</span>
            <span style="color: #909399;"> 家</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="scope">
            {{ formatTime(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="viewRegionTasks(scope.row.id)">
              任务
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { regionsAPI } from '@/api'

const router = useRouter()

const loading = ref(false)
const regions = ref([])

const loadRegions = async () => {
  loading.value = true
  try {
    const data = await regionsAPI.list()
    regions.value = data
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

const viewRegionTasks = (regionId) => {
  router.push({ path: '/store-tasks', query: { regionId } })
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  loadRegions()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
