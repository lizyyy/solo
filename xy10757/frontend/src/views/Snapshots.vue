<template>
  <div>
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>余额快照</span>
          <el-button type="primary" @click="showAddDialog = true">创建快照</el-button>
        </div>
      </template>
      <el-table :data="snapshots" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="member_id" label="会员ID" width="100" />
        <el-table-column prop="total_points" label="总积分" width="100" />
        <el-table-column prop="available_points" label="可用积分" width="100" />
        <el-table-column prop="frozen_points" label="冻结积分" width="100" />
        <el-table-column prop="expired_points" label="过期积分" width="100" />
        <el-table-column prop="consumed_points" label="已消费" width="100" />
        <el-table-column prop="refunded_points" label="已返还" width="100" />
        <el-table-column prop="is_consistent" label="一致性" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_consistent ? 'success' : 'danger'">
              {{ row.is_consistent ? '一致' : '不一致' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="snapshot_date" label="快照时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.snapshot_date) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="compare(row)">
              比对
            </el-button>
            <el-button type="success" size="small" @click="exportSnapshot(row.member_id)">
              导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAddDialog" title="创建余额快照" width="500px">
      <el-form :model="newSnapshot" label-width="120px">
        <el-form-item label="会员ID">
          <el-input v-model="newSnapshot.member_id" />
        </el-form-item>
        <el-form-item label="总积分">
          <el-input-number v-model="newSnapshot.total_points" :min="0" />
        </el-form-item>
        <el-form-item label="可用积分">
          <el-input-number v-model="newSnapshot.available_points" :min="0" />
        </el-form-item>
        <el-form-item label="冻结积分">
          <el-input-number v-model="newSnapshot.frozen_points" :min="0" />
        </el-form-item>
        <el-form-item label="过期积分">
          <el-input-number v-model="newSnapshot.expired_points" :min="0" />
        </el-form-item>
        <el-form-item label="已消费">
          <el-input-number v-model="newSnapshot.consumed_points" :min="0" />
        </el-form-item>
        <el-form-item label="已返还">
          <el-input-number v-model="newSnapshot.refunded_points" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="createSnapshot">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCompareDialog" title="比对结果" width="600px">
      <el-alert
        :title="compareResult.is_consistent ? '数据一致' : '发现不一致'"
        :type="compareResult.is_consistent ? 'success' : 'error'"
        style="margin-bottom: 20px;"
      />
      <div>
        <p>计算可用余额: {{ compareResult.calculated_balance }}</p>
        <p>快照可用余额: {{ compareResult.snapshot_balance }}</p>
        <div v-if="compareResult.differences && compareResult.differences.length">
          <h4>差异明细:</h4>
          <ul>
            <li v-for="(diff, idx) in compareResult.differences" :key="idx">{{ diff }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showCompareDialog = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const snapshots = ref([])
const showAddDialog = ref(false)
const showCompareDialog = ref(false)
const compareResult = ref({})

const newSnapshot = ref({
  snapshot_date: new Date().toISOString(),
  member_id: '',
  total_points: 0,
  available_points: 0,
  frozen_points: 0,
  expired_points: 0,
  consumed_points: 0,
  refunded_points: 0
})

const loadSnapshots = async () => {
  try {
    const res = await axios.get('/api/balance/snapshots')
    snapshots.value = res.data
  } catch (e) {
    ElMessage.error('加载快照失败')
  }
}

const createSnapshot = async () => {
  try {
    await axios.post('/api/balance/snapshot', newSnapshot.value)
    ElMessage.success('创建成功')
    showAddDialog.value = false
    loadSnapshots()
  } catch (e) {
    ElMessage.error('创建失败: ' + (e.response?.data?.detail || e.message))
  }
}

const compare = async (row) => {
  try {
    const res = await axios.post(`/api/review/compare/${row.member_id}/${row.id}`)
    compareResult.value = res.data
    showCompareDialog.value = true
  } catch (e) {
    ElMessage.error('比对失败: ' + (e.response?.data?.detail || e.message))
  }
}

const exportSnapshot = (memberId) => {
  window.open(`/api/export/snapshots/${memberId}`, '_blank')
  ElMessage.success('开始导出')
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadSnapshots()
})
</script>
