<template>
  <div>
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>交易记录</span>
          <div>
            <el-button type="primary" @click="showConsumeDialog = true">消费抵扣</el-button>
            <el-button type="warning" @click="showExpireDialog = true">过期回收</el-button>
            <el-button type="success" @click="showRefundDialog = true">退款返还</el-button>
            <el-button type="info" @click="showFreezeDialog = true">冻结积分</el-button>
          </div>
        </div>
      </template>
      <el-table :data="transactions" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="tx_no" label="交易编号" width="150" />
        <el-table-column prop="member_id" label="会员ID" width="100" />
        <el-table-column prop="tx_type" label="交易类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTxTypeColor(row.tx_type)">
              {{ getTxTypeName(row.tx_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分数" width="100" />
        <el-table-column prop="before_balance" label="操作前余额" width="120" />
        <el-table-column prop="after_balance" label="操作后余额" width="120" />
        <el-table-column prop="is_reviewed" label="是否复核" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_reviewed ? 'success' : 'warning'">
              {{ row.is_reviewed ? '已复核' : '未复核' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_manual" label="人工修正" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_manual" type="danger">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showConsumeDialog" title="消费抵扣" width="500px">
      <el-form :model="consumeForm" label-width="100px">
        <el-form-item label="交易编号">
          <el-input v-model="consumeForm.tx_no" placeholder="自动生成可留空" />
        </el-form-item>
        <el-form-item label="会员ID">
          <el-input v-model="consumeForm.member_id" />
        </el-form-item>
        <el-form-item label="批次ID">
          <el-input-number v-model="consumeForm.batch_id" :min="1" />
        </el-form-item>
        <el-form-item label="消费积分">
          <el-input-number v-model="consumeForm.points" :min="1" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="consumeForm.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConsumeDialog = false">取消</el-button>
        <el-button type="primary" @click="doConsume">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showExpireDialog" title="过期回收" width="500px">
      <el-form label-width="100px">
        <el-form-item label="会员ID">
          <el-input v-model="expireForm.member_id" />
        </el-form-item>
        <el-form-item label="批次ID">
          <el-input-number v-model="expireForm.batch_id" :min="1" />
        </el-form-item>
        <el-form-item label="过期积分">
          <el-input-number v-model="expireForm.points" :min="1" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="expireForm.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExpireDialog = false">取消</el-button>
        <el-button type="primary" @click="doExpire">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRefundDialog" title="退款返还" width="500px">
      <el-form label-width="100px">
        <el-form-item label="会员ID">
          <el-input v-model="refundForm.member_id" />
        </el-form-item>
        <el-form-item label="批次ID">
          <el-input-number v-model="refundForm.batch_id" :min="1" />
        </el-form-item>
        <el-form-item label="返还积分">
          <el-input-number v-model="refundForm.points" :min="1" />
        </el-form-item>
        <el-form-item label="关联交易ID">
          <el-input-number v-model="refundForm.related_tx_id" :min="1" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="refundForm.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRefundDialog = false">取消</el-button>
        <el-button type="primary" @click="doRefund">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showFreezeDialog" title="冻结积分" width="500px">
      <el-form :model="freezeForm" label-width="100px">
        <el-form-item label="会员ID">
          <el-input v-model="freezeForm.member_id" />
        </el-form-item>
        <el-form-item label="批次ID">
          <el-input-number v-model="freezeForm.batch_id" :min="1" />
        </el-form-item>
        <el-form-item label="冻结积分">
          <el-input-number v-model="freezeForm.frozen_points" :min="1" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="freezeForm.reason" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="freezeForm.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFreezeDialog = false">取消</el-button>
        <el-button type="primary" @click="doFreeze">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const transactions = ref([])
const showConsumeDialog = ref(false)
const showExpireDialog = ref(false)
const showRefundDialog = ref(false)
const showFreezeDialog = ref(false)

const consumeForm = ref({ tx_no: '', member_id: '', batch_id: 1, points: 100, operator: '' })
const expireForm = ref({ member_id: '', batch_id: 1, points: 100, operator: '' })
const refundForm = ref({ member_id: '', batch_id: 1, points: 100, related_tx_id: 1, operator: '' })
const freezeForm = ref({ member_id: '', batch_id: 1, frozen_points: 100, reason: '', operator: '' })

const loadTransactions = async () => {
  try {
    const res = await axios.get('/api/points/transactions')
    transactions.value = res.data
  } catch (e) {
    ElMessage.error('加载交易记录失败')
  }
}

const doConsume = async () => {
  try {
    await axios.post('/api/points/consume', consumeForm.value)
    ElMessage.success('消费成功')
    showConsumeDialog.value = false
    loadTransactions()
  } catch (e) {
    ElMessage.error('操作失败: ' + (e.response?.data?.detail || e.message))
  }
}

const doExpire = async () => {
  try {
    await axios.post('/api/points/expire', null, { params: expireForm.value })
    ElMessage.success('过期回收成功')
    showExpireDialog.value = false
    loadTransactions()
  } catch (e) {
    ElMessage.error('操作失败: ' + (e.response?.data?.detail || e.message))
  }
}

const doRefund = async () => {
  try {
    await axios.post('/api/points/refund', null, { params: refundForm.value })
    ElMessage.success('退款返还成功')
    showRefundDialog.value = false
    loadTransactions()
  } catch (e) {
    ElMessage.error('操作失败: ' + (e.response?.data?.detail || e.message))
  }
}

const doFreeze = async () => {
  try {
    await axios.post('/api/points/freeze', freezeForm.value)
    ElMessage.success('冻结成功')
    showFreezeDialog.value = false
  } catch (e) {
    ElMessage.error('操作失败: ' + (e.response?.data?.detail || e.message))
  }
}

const getTxTypeName = (type) => {
  const map = { consume: '消费', expire: '过期', refund: '退款', freeze: '冻结' }
  return map[type] || type
}

const getTxTypeColor = (type) => {
  const map = { consume: 'danger', expire: 'warning', refund: 'success', freeze: 'info' }
  return map[type] || ''
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadTransactions()
})
</script>
