<template>
  <div class="stores">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>门店管理</span>
        </div>
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
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadStores">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-table :data="stores" border v-loading="loading" style="width: 100%;">
        <el-table-column prop="code" label="门店编码" width="120" />
        <el-table-column prop="name" label="门店名称" width="180" />
        <el-table-column prop="region_name" label="区域" width="100" />
        <el-table-column prop="address" label="地址" min-width="250" show-overflow-tooltip />
        <el-table-column prop="phone" label="电话" width="150" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'" size="small">
              {{ scope.row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="scope">
            {{ formatTime(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="viewStoreTasks(scope.row.id)">
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
import { Search, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { storesAPI, regionsAPI } from '@/api'

const router = useRouter()

const loading = ref(false)
const stores = ref([])
const regions = ref([])
const searchForm = ref({
  regionId: null,
  status: null
})

const loadStores = async () => {
  loading.value = true
  try {
    const [data, regionsData] = await Promise.all([
      storesAPI.list({
        regionId: searchForm.value.regionId,
        status: searchForm.value.status
      }),
      regionsAPI.list()
    ])
    stores.value = data
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
    status: null
  }
  loadStores()
}

const viewStoreTasks = (storeId) => {
  router.push({ path: '/store-tasks', query: { storeId } })
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  loadStores()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}
</style>
