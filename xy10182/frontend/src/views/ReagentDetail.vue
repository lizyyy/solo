<template>
  <div class="reagent-detail">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <div class="title">{{ reagent?.name }} - 详情</div>
          <el-button type="primary" @click="goToEdit">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
        </div>
      </template>

      <el-row :gutter="20" v-if="reagent">
        <el-col :span="12">
          <el-descriptions title="基本信息" :column="1" border>
            <el-descriptions-item label="试剂编码">{{ reagent.code }}</el-descriptions-item>
            <el-descriptions-item label="试剂名称">{{ reagent.name }}</el-descriptions-item>
            <el-descriptions-item label="分类">{{ reagent.category }}</el-descriptions-item>
            <el-descriptions-item label="规格">{{ reagent.specification || '-' }}</el-descriptions-item>
            <el-descriptions-item label="单位">{{ reagent.unit }}</el-descriptions-item>
          </el-descriptions>
        </el-col>
        <el-col :span="12">
          <el-descriptions title="库存信息" :column="1" border>
            <el-descriptions-item label="安全库存">{{ reagent.minStock }}</el-descriptions-item>
            <el-descriptions-item label="最大库存">{{ reagent.maxStock }}</el-descriptions-item>
            <el-descriptions-item label="保质期">{{ reagent.shelfLifeDays }} 天</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="reagent.status === 'active' ? 'success' : 'info'">
                {{ reagent.status === 'active' ? '启用' : '停用' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ formatTime(reagent.createdAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-col>
      </el-row>

      <el-alert v-if="reagent?.description" :title="reagent.description" type="info" style="margin-top: 20px;" show-icon />
    </el-card>

    <el-card shadow="never" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span>相关批次 ({{ batches.length }})</span>
          <el-button type="primary" @click="goToBatches">
            <el-icon><Plus /></el-icon>
            新增入库
          </el-button>
        </div>
      </template>
      <el-table :data="batches" v-loading="loading" stripe>
        <el-table-column prop="batchNo" label="批次号" min-width="180" />
        <el-table-column prop="manufacturer" label="生产厂家" min-width="200" />
        <el-table-column prop="productionDate" label="生产日期" width="120" />
        <el-table-column prop="expiryDate" label="有效期" width="120" />
        <el-table-column prop="totalQuantity" label="总数" width="80" />
        <el-table-column prop="usedQuantity" label="已用" width="80" />
        <el-table-column prop="remainingQuantity" label="剩余" width="80" />
        <el-table-column prop="storageLocation" label="存储位置" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="viewBatch(scope.row.id)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getReagentDetail } from '../api/reagent'
import { getBatchList } from '../api/batch'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const reagent = ref(null)
const batches = ref([])

const statusMap = {
  in_stock: { label: '正常库存', type: 'success' },
  low_stock: { label: '库存不足', type: 'warning' },
  expiring: { label: '即将过期', type: 'warning' },
  expired: { label: '已过期', type: 'danger' },
  empty: { label: '已空库', type: 'info' }
}

function getStatusLabel(status) {
  return statusMap[status]?.label || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function formatTime(time) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

async function fetchDetail() {
  loading.value = true
  try {
    const res = await getReagentDetail(route.params.id)
    reagent.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function fetchBatches() {
  try {
    const res = await getBatchList({ reagentId: route.params.id })
    batches.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

function goBack() {
  router.push('/reagents')
}

function goToEdit() {
  router.push('/reagents')
}

function goToBatches() {
  router.push('/batches')
}

function viewBatch(id) {
  router.push(`/batches/${id}`)
}

onMounted(() => {
  fetchDetail()
  fetchBatches()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: 500;
}
</style>
