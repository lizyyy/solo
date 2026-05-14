<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-label">规则总数</div>
            <div class="stat-value">{{ stats.total_rules }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card preheating">
          <div class="stat-content">
            <div class="stat-label">预热中</div>
            <div class="stat-value">{{ stats.preheating }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card ready">
          <div class="stat-content">
            <div class="stat-label">已就绪</div>
            <div class="stat-value">{{ stats.ready }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card hit-rate">
          <div class="stat-content">
            <div class="stat-label">平均命中率</div>
            <div class="stat-value">{{ stats.avg_hit_rate }}%</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>快捷操作</span>
            </div>
          </template>
          <el-space wrap>
            <el-button type="primary" @click="$router.push('/rules')">
              查看缓存规则
            </el-button>
            <el-button type="success" @click="showCreateDialog = true">
              新建缓存规则
            </el-button>
            <el-button type="info" @click="$router.push('/reports')">
              查看性能报告
            </el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>
  </div>

  <el-dialog v-model="showCreateDialog" title="新建缓存规则" width="600px">
    <el-form :model="newRule" label-width="100px">
      <el-form-item label="规则键">
        <el-input v-model="newRule.rule_key" placeholder="例如: user:info:*" />
      </el-form-item>
      <el-form-item label="匹配模式">
        <el-input v-model="newRule.rule_pattern" placeholder="正则表达式" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="newRule.description" type="textarea" />
      </el-form-item>
      <el-form-item label="TTL(秒)">
        <el-input-number v-model="newRule.ttl" :min="1" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showCreateDialog = false">取消</el-button>
      <el-button type="primary" @click="createRule" :loading="creating">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const stats = ref({
  total_rules: 0,
  preheating: 0,
  ready: 0,
  avg_hit_rate: 0
})

const showCreateDialog = ref(false)
const creating = ref(false)
const newRule = ref({
  rule_key: '',
  rule_pattern: '',
  description: '',
  ttl: 3600
})

const loadStats = async () => {
  try {
    const res = await axios.get('/api/dashboard/stats')
    stats.value = res.data
  } catch (err) {
    ElMessage.error('加载统计数据失败')
  }
}

const createRule = async () => {
  if (!newRule.value.rule_key) {
    ElMessage.warning('请输入规则键')
    return
  }
  creating.value = true
  try {
    await axios.post('/api/rules', {
      ...newRule.value,
      original_input: newRule.value,
      processed_result: { pattern: newRule.value.rule_pattern }
    })
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadStats()
    newRule.value = { rule_key: '', rule_pattern: '', description: '', ttl: 3600 }
  } catch (err) {
    ElMessage.error('创建失败')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.stat-card {
  text-align: center;
}

.stat-card.preheating {
  border-left: 4px solid #e6a23c;
}

.stat-card.ready {
  border-left: 4px solid #67c23a;
}

.stat-card.hit-rate {
  border-left: 4px solid #409eff;
}

.stat-content {
  padding: 10px 0;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
