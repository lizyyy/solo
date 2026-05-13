<template>
  <div>
    <h2 style="margin-bottom: 20px">数据概览</h2>
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 32px; color: #409EFF; font-weight: bold">{{ boxCount }}</div>
            <div style="color: #909399; margin-top: 10px">药箱数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 32px; color: #67C23A; font-weight: bold">{{ batchCount }}</div>
            <div style="color: #909399; margin-top: 10px">药品批次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 32px; color: #E6A23C; font-weight: bold">{{ borrowCount }}</div>
            <div style="color: #909399; margin-top: 10px">借用记录</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 32px; color: #F56C6C; font-weight: bold">{{ riskCount }}</div>
            <div style="color: #909399; margin-top: 10px">效期风险</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最近操作日志</span>
          </template>
          <el-table :data="recentLogs" style="width: 100%" size="small">
            <el-table-column prop="operation_time" label="时间" width="160" />
            <el-table-column prop="operator" label="操作人" width="100" />
            <el-table-column prop="module" label="模块" width="120" />
            <el-table-column prop="remarks" label="备注" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>效期风险预警</span>
          </template>
          <el-table :data="risks" style="width: 100%" size="small">
            <el-table-column prop="medicine_name" label="药品名称" />
            <el-table-column prop="batch_number" label="批次号" width="120" />
            <el-table-column prop="risk_level" label="风险等级" width="100">
              <template #default="{ row }">
                <el-tag :type="getRiskType(row.risk_level)" size="small">
                  {{ getRiskText(row.risk_level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="days_to_expiry" label="剩余天数" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const boxCount = ref(0)
const batchCount = ref(0)
const borrowCount = ref(0)
const riskCount = ref(0)
const recentLogs = ref([])
const risks = ref([])

const getRiskType = (level) => {
  const map = { critical: 'danger', warning: 'warning', expired: 'info' }
  return map[level] || ''
}

const getRiskText = (level) => {
  const map = { critical: '紧急', warning: '预警', expired: '已过期' }
  return map[level] || level
}

const loadData = async () => {
  try {
    const [boxesRes, batchesRes, borrowsRes, logsRes, risksRes] = await Promise.all([
      axios.get('/api/boxes'),
      axios.get('/api/batches'),
      axios.get('/api/borrows'),
      axios.get('/api/logs'),
      axios.get('/api/expiry-risks')
    ])
    
    boxCount.value = boxesRes.data.length
    batchCount.value = batchesRes.data.length
    borrowCount.value = borrowsRes.data.length
    riskCount.value = risksRes.data.length
    recentLogs.value = logsRes.data.slice(0, 5)
    risks.value = risksRes.data.slice(0, 5)
  } catch (err) {
    console.error('加载数据失败', err)
  }
}

onMounted(() => {
  loadData()
})
</script>
