<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 36px; color: #409eff; font-weight: bold;">{{ stats.batchCount }}</div>
            <div style="color: #606266; margin-top: 10px;">积分批次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 36px; color: #67c23a; font-weight: bold;">{{ stats.transactionCount }}</div>
            <div style="color: #606266; margin-top: 10px;">交易记录</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 36px; color: #e6a23c; font-weight: bold;">{{ stats.snapshotCount }}</div>
            <div style="color: #606266; margin-top: 10px;">余额快照</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 36px; color: #f56c6c; font-weight: bold;">{{ stats.reviewCount }}</div>
            <div style="color: #606266; margin-top: 10px;">复核记录</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>快捷操作</span>
          </template>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <el-button type="primary" @click="goToBatches">查看积分批次</el-button>
            <el-button type="success" @click="goToTransactions">查看交易记录</el-button>
            <el-button type="warning" @click="goToSnapshots">查看余额快照</el-button>
            <el-button type="danger" @click="goToReview">进入比对复核</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>系统说明</span>
          </template>
          <div>
            <p style="margin-bottom: 10px;">✓ 积分批次管理 - 支持新增、查询积分批次</p>
            <p style="margin-bottom: 10px;">✓ 积分操作 - 冻结、消费、过期回收、退款返还</p>
            <p style="margin-bottom: 10px;">✓ 余额快照 - 定期生成余额快照，支持比对</p>
            <p style="margin-bottom: 10px;">✓ 比对复核 - 自动比对余额差异，人工复核</p>
            <p style="margin-bottom: 10px;">✓ 人工修正 - 支持修正交易记录，重新计算后续余额</p>
            <p>✓ 数据导出 - 支持Excel导出交易记录、快照等</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const stats = ref({
  batchCount: 0,
  transactionCount: 0,
  snapshotCount: 0,
  reviewCount: 0
})

const loadStats = async () => {
  try {
    const [batches, transactions, snapshots, reviews] = await Promise.all([
      axios.get('/api/batches/'),
      axios.get('/api/points/transactions'),
      axios.get('/api/balance/snapshots'),
      axios.get('/api/review/records')
    ])
    stats.value.batchCount = batches.data.length
    stats.value.transactionCount = transactions.data.length
    stats.value.snapshotCount = snapshots.data.length
    stats.value.reviewCount = reviews.data.length
  } catch (e) {
    console.error('加载统计数据失败', e)
  }
}

const goToBatches = () => router.push('/batches')
const goToTransactions = () => router.push('/transactions')
const goToSnapshots = () => router.push('/snapshots')
const goToReview = () => router.push('/review')

onMounted(() => {
  loadStats()
})
</script>
