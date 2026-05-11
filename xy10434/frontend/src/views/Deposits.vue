<template>
  <div class="deposits-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>押金流水记录</span>
        </div>
      </template>
      <el-table :data="deposits" v-loading="loading">
        <el-table-column label="房号" width="150">
          <template #default="scope">
            {{ scope.row.building }}-{{ scope.row.unit }}-{{ scope.row.room_number }}
          </template>
        </el-table-column>
        <el-table-column prop="owner_name" label="业主" width="100" />
        <el-table-column label="类型" width="100">
          <template #default="scope">
            <el-tag :type="getTypeType(scope.row.type)">
              {{ getTypeText(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="scope">
            <span :style="{ color: scope.row.type === 'receive' ? '#67c23a' : scope.row.type === 'refund' ? '#409eff' : '#e6a23c' }">
              {{ scope.row.type === 'receive' ? '+' : '-' }}¥{{ scope.row.amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="payment_method" label="支付方式" width="100" />
        <el-table-column prop="operator" label="经办人" width="100" />
        <el-table-column prop="remark" label="备注" />
        <el-table-column prop="created_at" label="操作时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const deposits = ref([])

const typeMap = {
  receive: { text: '收取', type: 'success' },
  refund: { text: '退还', type: 'primary' },
  deduction: { text: '扣款', type: 'warning' }
}

function getTypeText(type) {
  return typeMap[type]?.text || type
}

function getTypeType(type) {
  return typeMap[type]?.type || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const response = await api.get('/deposits')
    deposits.value = response.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  font-weight: 500;
  font-size: 16px;
}
</style>
