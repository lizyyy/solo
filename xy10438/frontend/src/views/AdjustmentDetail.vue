<template>
  <div class="adjustment-detail">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">
        返回列表
      </el-button>
      <h2 style="margin: 0 0 0 16px;">调价单详情</h2>
      <el-tag :type="getStatusTag(adjustment.status)" style="margin-left: 16px;">
        {{ getStatusText(adjustment.status) }}
      </el-tag>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <span>基本信息</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="调价单号">
              {{ adjustment.adjustment_no }}
            </el-descriptions-item>
            <el-descriptions-item label="调价类型">
              <el-tag :type="getTypeTag(adjustment.type)">
                {{ getTypeText(adjustment.type) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="标题">
              {{ adjustment.title }}
            </el-descriptions-item>
            <el-descriptions-item label="创建人">
              {{ adjustment.creator_name }}
            </el-descriptions-item>
            <el-descriptions-item label="生效时间">
              {{ formatTime(adjustment.effect_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="过期时间">
              {{ adjustment.expire_time ? formatTime(adjustment.expire_time) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">
              {{ adjustment.description || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span>商品调价明细 ({{ adjustment.items?.length || 0 }} 个商品)</span>
          </template>
          <el-table :data="adjustment.items" border>
            <el-table-column prop="sku" label="SKU" width="120" />
            <el-table-column prop="product_name" label="商品名称" min-width="200" />
            <el-table-column prop="category" label="分类" width="150" />
            <el-table-column label="原价" width="100">
              <template #default="scope">
                <span style="color: #909399; text-decoration: line-through;">
                  ¥{{ scope.row.original_price }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="新价" width="100">
              <template #default="scope">
                <span style="color: #f56c6c; font-weight: bold;">
                  ¥{{ scope.row.new_price }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="调价幅度" width="150">
              <template #default="scope">
                <span :style="{ color: scope.row.new_price < scope.row.original_price ? '#67c23a' : '#f56c6c' }">
                  {{ getPriceDiff(scope.row) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span>门店执行进度</span>
          </template>
          <div class="progress-summary">
            <el-progress
              :percentage="Math.round(confirmedCount / (adjustment.storeTasks?.length || 1) * 100)"
              :stroke-width="24"
            >
              <template #default="{ percentage }">
                <span style="font-size: 14px;">{{ confirmedCount }}/{{ adjustment.storeTasks?.length || 0 }}</span>
              </template>
            </el-progress>
          </div>
          <div class="status-summary">
            <div class="status-item">
              <el-tag type="warning" size="large">待确认 {{ pendingCount }}</el-tag>
            </div>
            <div class="status-item">
              <el-tag type="info" size="large">部分确认 {{ partialCount }}</el-tag>
            </div>
            <div class="status-item">
              <el-tag type="danger" size="large">异常 {{ exceptionCount }}</el-tag>
            </div>
          </div>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span>门店列表</span>
          </template>
          <div class="store-list" v-loading="loading">
            <div
              v-for="task in adjustment.storeTasks"
              :key="task.id"
              class="store-item"
              @click="goToTask(task.id)"
            >
              <div class="store-item-header">
                <span class="store-name">{{ task.store_name }}</span>
                <el-tag :type="getTaskStatusTag(task.status)" size="small">
                  {{ getTaskStatusText(task.status) }}
                </el-tag>
              </div>
              <div class="store-item-info">
                <span>{{ task.region_name }} - {{ task.store_code }}</span>
              </div>
            </div>
            <el-empty v-if="!adjustment.storeTasks?.length" description="暂无门店" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { adjustmentsAPI } from '@/api'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const adjustment = ref({})

const pendingCount = computed(() => {
  return (adjustment.value.storeTasks || []).filter(t => t.status === 'pending').length
})

const confirmedCount = computed(() => {
  return (adjustment.value.storeTasks || []).filter(t => t.status === 'confirmed').length
})

const partialCount = computed(() => {
  return (adjustment.value.storeTasks || []).filter(t => t.status === 'partial_confirmed').length
})

const exceptionCount = computed(() => {
  return (adjustment.value.storeTasks || []).filter(t => t.status === 'has_exception').length
})

const loadDetail = async () => {
  loading.value = true
  try {
    const data = await adjustmentsAPI.get(route.params.id)
    adjustment.value = data
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
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

const getPriceDiff = (item) => {
  if (!item.original_price || !item.new_price) return '-'
  const diff = item.new_price - item.original_price
  const percent = ((diff / item.original_price) * 100).toFixed(1)
  const sign = diff >= 0 ? '+' : ''
  return `${sign}¥${diff.toFixed(2)} (${sign}${percent}%)`
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const goBack = () => {
  router.push('/adjustments')
}

const goToTask = (taskId) => {
  router.push(`/store-tasks/${taskId}`)
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.progress-summary {
  padding: 20px 0;
}

.status-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.status-item {
  text-align: center;
}

.store-list {
  max-height: 400px;
  overflow-y: auto;
}

.store-item {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.store-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.store-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.store-name {
  font-weight: 500;
}

.store-item-info {
  font-size: 12px;
  color: #909399;
}
</style>
