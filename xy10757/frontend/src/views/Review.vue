<template>
  <div>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card style="margin-bottom: 20px;">
          <template #header>
            <span>待复核交易</span>
          </template>
          <el-table :data="pendingTransactions" border stripe max-height="400">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="tx_no" label="交易编号" width="150" />
            <el-table-column prop="tx_type" label="类型" width="80">
              <template #default="{ row }">
                {{ getTxTypeName(row.tx_type) }}
              </template>
            </el-table-column>
            <el-table-column prop="points" label="积分" width="80" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="review(row)">
                  复核
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card style="margin-bottom: 20px;">
          <template #header>
            <span>人工修正</span>
          </template>
          <el-form :model="correctionForm" label-width="100px">
            <el-form-item label="交易ID">
              <el-input-number v-model="correctionForm.tx_id" :min="1" />
              <el-button type="info" size="small" @click="loadTransaction">
                加载交易
              </el-button>
            </el-form-item>
            <el-form-item label="当前积分">
              <el-input :value="currentTransaction.points" disabled />
            </el-form-item>
            <el-form-item label="新积分">
              <el-input-number v-model="correctionForm.new_points" :min="0" />
            </el-form-item>
            <el-form-item label="修正原因">
              <el-input v-model="correctionForm.reason" type="textarea" />
            </el-form-item>
            <el-form-item label="操作人">
              <el-input v-model="correctionForm.operator" />
            </el-form-item>
            <el-form-item>
              <el-button type="danger" @click="doCorrect">
                提交修正
              </el-button>
              <div style="color: #f56c6c; font-size: 12px; margin-top: 5px;">
                * 修正幅度不能超过1000，已复核的交易不能修正
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header>
        <span>复核记录</span>
      </template>
      <el-table :data="reviewRecords" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="review_type" label="复核类型" width="120" />
        <el-table-column prop="target_id" label="目标ID" width="80" />
        <el-table-column prop="before_data" label="变更前" show-overflow-tooltip />
        <el-table-column prop="after_data" label="变更后" show-overflow-tooltip />
        <el-table-column prop="reviewer" label="复核人" width="100" />
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const pendingTransactions = ref([])
const reviewRecords = ref([])
const currentTransaction = ref({})
const correctionForm = ref({
  tx_id: 0,
  new_points: 0,
  reason: '',
  operator: ''
})

const loadPending = async () => {
  try {
    const res = await axios.get('/api/points/transactions')
    pendingTransactions.value = res.data.filter(t => !t.is_reviewed)
  } catch (e) {
    ElMessage.error('加载待复核交易失败')
  }
}

const loadRecords = async () => {
  try {
    const res = await axios.get('/api/review/records')
    reviewRecords.value = res.data
  } catch (e) {
    ElMessage.error('加载复核记录失败')
  }
}

const loadTransaction = async () => {
  if (!correctionForm.value.tx_id) {
    ElMessage.warning('请输入交易ID')
    return
  }
  try {
    const res = await axios.get(`/api/points/transactions/${correctionForm.value.tx_id}`)
    currentTransaction.value = res.data
    correctionForm.value.new_points = res.data.points
  } catch (e) {
    ElMessage.error('加载交易失败: ' + (e.response?.data?.detail || e.message))
  }
}

const review = async (row) => {
  try {
    const reviewer = prompt('请输入复核人姓名:')
    if (!reviewer) return
    await axios.post(`/api/review/review/${row.id}`, null, { params: { reviewer } })
    ElMessage.success('复核成功')
    loadPending()
    loadRecords()
  } catch (e) {
    ElMessage.error('复核失败: ' + (e.response?.data?.detail || e.message))
  }
}

const doCorrect = async () => {
  try {
    await axios.post('/api/review/correct', correctionForm.value)
    ElMessage.success('修正成功，已重新计算后续余额')
    loadPending()
    loadRecords()
  } catch (e) {
    ElMessage.error('修正失败: ' + (e.response?.data?.detail || e.message))
  }
}

const getTxTypeName = (type) => {
  const map = { consume: '消费', expire: '过期', refund: '退款', freeze: '冻结' }
  return map[type] || type
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadPending()
  loadRecords()
})
</script>
