<template>
  <div>
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>积分处理链 - 会员ID: {{ chainData.member_id }}</span>
          <el-button type="success" @click="exportFull">导出完整台账</el-button>
        </div>
      </template>

      <el-steps direction="vertical" :active="-1" finish-status="success">
        <el-step
          v-for="(item, index) in chainData.chain"
          :key="index"
          :title="getStepTitle(item)"
          :description="getStepDesc(item)"
          :status="getStepStatus(item)"
        >
          <template #icon>
            <el-tag :type="getStepTagType(item.type)">
              {{ getStepIcon(item.type) }}
            </el-tag>
          </template>
        </el-step>
      </el-steps>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>批次信息</span>
          </template>
          <div v-if="chainData.batch">
            <p>批次号: {{ chainData.batch.batch_no }}</p>
            <p>积分: {{ chainData.batch.points }}</p>
            <p>来源: {{ chainData.batch.source || '-' }}</p>
            <p>状态: {{ chainData.batch.status }}</p>
            <p>创建时间: {{ formatDate(chainData.batch.created_at) }}</p>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>冻结记录 ({{ chainData.frozen?.length || 0 }})</span>
          </template>
          <div v-for="f in chainData.frozen" :key="f.id" style="margin-bottom: 10px; padding: 10px; background: #f5f7fa;">
            <p>冻结积分: {{ f.frozen_points }}</p>
            <p>原因: {{ f.reason || '-' }}</p>
            <p>状态: {{ f.status }}</p>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>快照记录 ({{ chainData.snapshots?.length || 0 }})</span>
          </template>
          <div v-for="s in chainData.snapshots" :key="s.id" style="margin-bottom: 10px; padding: 10px; background: #f5f7fa;">
            <p>可用积分: {{ s.available_points }}</p>
            <p>总积分: {{ s.total_points }}</p>
            <el-tag :type="s.is_consistent ? 'success' : 'danger'">
              {{ s.is_consistent ? '一致' : '不一致' }}
            </el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const route = useRoute()
const chainData = ref({
  member_id: '',
  batch: null,
  frozen: [],
  transactions: [],
  snapshots: [],
  chain: []
})

const loadChain = async () => {
  try {
    const batchId = route.params.batchId
    const res = await axios.get(`/api/batches/${batchId}/chain`)
    chainData.value = res.data
  } catch (e) {
    ElMessage.error('加载处理链失败')
  }
}

const getStepTitle = (item) => {
  return item.description.split(' - ')[0] || item.type
}

const getStepDesc = (item) => {
  return `积分: ${item.points} | 时间: ${formatDate(item.date)} | 编号: ${item.no}`
}

const getStepStatus = (item) => {
  if (item.type === 'snapshot') {
    return item.status === 'consistent' ? 'success' : 'error'
  }
  return item.status === 'completed' || item.status === 'active' || item.status === 'consistent' ? 'success' : 'wait'
}

const getStepTagType = (type) => {
  const map = {
    batch: 'primary',
    frozen: 'info',
    consume: 'danger',
    expire: 'warning',
    refund: 'success',
    snapshot: ''
  }
  return map[type] || ''
}

const getStepIcon = (type) => {
  const map = {
    batch: '批次',
    frozen: '冻结',
    consume: '消费',
    expire: '过期',
    refund: '退款',
    snapshot: '快照'
  }
  return map[type] || type
}

const exportFull = () => {
  window.open(`/api/export/full/${chainData.value.member_id}`, '_blank')
  ElMessage.success('开始导出')
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadChain()
})
</script>
