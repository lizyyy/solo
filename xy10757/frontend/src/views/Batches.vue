<template>
  <div>
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>积分批次</span>
          <el-button type="primary" @click="showAddDialog = true">新增批次</el-button>
        </div>
      </template>
      <el-table :data="batches" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="batch_no" label="批次号" width="150" />
        <el-table-column prop="member_id" label="会员ID" width="120" />
        <el-table-column prop="points" label="积分数" width="100" />
        <el-table-column prop="source" label="来源" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '有效' : '已过期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewChain(row.id)">
              查看处理链
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAddDialog" title="新增积分批次" width="500px">
      <el-form :model="newBatch" label-width="100px">
        <el-form-item label="批次号">
          <el-input v-model="newBatch.batch_no" placeholder="请输入批次号" />
        </el-form-item>
        <el-form-item label="会员ID">
          <el-input v-model="newBatch.member_id" placeholder="请输入会员ID" />
        </el-form-item>
        <el-form-item label="积分数">
          <el-input-number v-model="newBatch.points" :min="1" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="newBatch.source" placeholder="请输入来源" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newBatch.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addBatch">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const router = useRouter()
const batches = ref([])
const showAddDialog = ref(false)
const newBatch = ref({
  batch_no: '',
  member_id: '',
  points: 1000,
  source: '',
  remark: ''
})

const loadBatches = async () => {
  try {
    const res = await axios.get('/api/batches/')
    batches.value = res.data
  } catch (e) {
    ElMessage.error('加载批次失败')
  }
}

const addBatch = async () => {
  try {
    await axios.post('/api/batches/', newBatch.value)
    ElMessage.success('新增成功')
    showAddDialog.value = false
    newBatch.value = { batch_no: '', member_id: '', points: 1000, source: '', remark: '' }
    loadBatches()
  } catch (e) {
    ElMessage.error('新增失败: ' + (e.response?.data?.detail || e.message))
  }
}

const viewChain = (batchId) => {
  router.push(`/chain/${batchId}`)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadBatches()
})
</script>
