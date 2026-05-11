<template>
  <div class="adjustments">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>调价单列表</span>
          <el-button type="primary" :icon="Plus" @click="goToCreate">
            创建调价单
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 150px;">
            <el-option label="促销调价" value="promotion" />
            <el-option label="区域调价" value="regional" />
            <el-option label="常规调价" value="regular" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px;">
            <el-option label="草稿" value="draft" />
            <el-option label="已发布" value="published" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
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
        <el-form-item label="关键字">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索单号或标题"
            clearable
            style="width: 200px;"
            @keyup.enter="loadAdjustments"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadAdjustments">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-table :data="adjustments" border v-loading="loading" style="width: 100%;">
        <el-table-column prop="adjustment_no" label="调价单号" width="180" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="类型" width="100">
          <template #default="scope">
            <el-tag :type="getTypeTag(scope.row.type)">
              {{ getTypeText(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusTag(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="门店进度" width="150">
          <template #default="scope">
            <el-progress
              :percentage="Math.round(scope.row.confirmed_stores / (scope.row.total_stores || 1) * 100)"
              :stroke-width="12"
            >
              <template #default="{ percentage }">
                <span style="font-size: 12px;">{{ scope.row.confirmed_stores }}/{{ scope.row.total_stores }}</span>
              </template>
            </el-progress>
          </template>
        </el-table-column>
        <el-table-column label="生效时间" width="160">
          <template #default="scope">
            {{ formatTime(scope.row.effect_time) }}
          </template>
        </el-table-column>
        <el-table-column label="过期时间" width="160">
          <template #default="scope">
            {{ scope.row.expire_time ? formatTime(scope.row.expire_time) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="创建人" width="100" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="viewDetail(scope.row.id)">
              详情
            </el-button>
            <el-button 
              v-if="scope.row.status === 'draft'" 
              type="success" 
              link 
              size="small"
              @click="publishAdjustment(scope.row.id)"
            >
              发布
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { adjustmentsAPI, regionsAPI } from '@/api'

const router = useRouter()

const loading = ref(false)
const adjustments = ref([])
const regions = ref([])
const searchForm = ref({
  type: null,
  status: null,
  regionId: null,
  keyword: ''
})

const loadAdjustments = async () => {
  loading.value = true
  try {
    const [data, regionsData] = await Promise.all([
      adjustmentsAPI.list({
        type: searchForm.value.type,
        status: searchForm.value.status,
        regionId: searchForm.value.regionId,
        keyword: searchForm.value.keyword
      }),
      regionsAPI.list()
    ])
    adjustments.value = data
    regions.value = regionsData
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.value = {
    type: null,
    status: null,
    regionId: null,
    keyword: ''
  }
  loadAdjustments()
}

const goToCreate = () => {
  router.push('/adjustments/create')
}

const viewDetail = (id) => {
  router.push(`/adjustments/${id}`)
}

const publishAdjustment = async (id) => {
  try {
    await ElMessageBox.confirm('发布后将无法修改，确认发布此调价单？', '确认发布', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await adjustmentsAPI.publish(id)
    ElMessage.success('发布成功')
    loadAdjustments()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message)
    }
  }
}

const getTypeText = (type) => {
  const map = {
    promotion: '促销调价',
    regional: '区域调价',
    regular: '常规调价'
  }
  return map[type] || type
}

const getTypeTag = (type) => {
  const map = {
    promotion: 'danger',
    regional: 'warning',
    regular: ''
  }
  return map[type] || ''
}

const getStatusText = (status) => {
  const map = {
    draft: '草稿',
    published: '已发布',
    completed: '已完成'
  }
  return map[status] || status
}

const getStatusTag = (status) => {
  const map = {
    draft: 'info',
    published: 'success',
    completed: ''
  }
  return map[status] || ''
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  loadAdjustments()
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
