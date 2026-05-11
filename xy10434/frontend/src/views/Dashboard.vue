<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon blue">
              <el-icon><Edit /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pendingDecorations + stats.inProgressDecorations }}</div>
              <div class="stat-label">进行中装修</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon green">
              <el-icon><Wallet /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ stats.totalDeposit?.toLocaleString() || 0 }}</div>
              <div class="stat-label">累计收取押金</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon orange">
              <el-icon><Minus /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ stats.totalDeduction?.toLocaleString() || 0 }}</div>
              <div class="stat-label">累计扣款</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon purple">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completedDecorations }}</div>
              <div class="stat-label">已完成装修</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待处理事项</span>
            </div>
          </template>
          <el-tabs v-model="activeTab">
            <el-tab-pane :label="`待审批装修 (${pendingTasks.pendingDecorations?.length || 0})`" name="decorations">
              <el-table :data="pendingTasks.pendingDecorations || []" size="small">
                <el-table-column prop="building" label="楼栋" width="80" />
                <el-table-column prop="unit" label="单元" width="80" />
                <el-table-column prop="room_number" label="房号" width="80" />
                <el-table-column prop="owner_name" label="业主" />
                <el-table-column label="操作" width="100">
                  <template #default="scope">
                    <el-button type="primary" link @click="goToDetail(scope.row.id)">查看</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-if="!pendingTasks.pendingDecorations?.length" description="暂无待审批装修" />
            </el-tab-pane>
            <el-tab-pane :label="`待复核违规 (${pendingTasks.pendingInspections?.length || 0})`" name="inspections">
              <el-table :data="pendingTasks.pendingInspections || []" size="small">
                <el-table-column prop="building" label="楼栋" width="80" />
                <el-table-column prop="unit" label="单元" width="80" />
                <el-table-column prop="room_number" label="房号" width="80" />
                <el-table-column prop="violation_type" label="违规类型" />
                <el-table-column prop="deduction_amount" label="扣款金额" width="100">
                  <template #default="scope">¥{{ scope.row.deduction_amount }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-if="!pendingTasks.pendingInspections?.length" description="暂无待复核违规" />
            </el-tab-pane>
            <el-tab-pane :label="`待审核退押 (${pendingTasks.pendingRefunds?.length || 0})`" name="refunds">
              <el-table :data="pendingTasks.pendingRefunds || []" size="small">
                <el-table-column prop="building" label="楼栋" width="80" />
                <el-table-column prop="unit" label="单元" width="80" />
                <el-table-column prop="room_number" label="房号" width="80" />
                <el-table-column prop="owner_name" label="业主" />
                <el-table-column prop="refund_amount" label="应退金额" width="120">
                  <template #default="scope">¥{{ scope.row.refund_amount }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-if="!pendingTasks.pendingRefunds?.length" description="暂无待审核退押" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>装修状态统计</span>
            </div>
          </template>
          <div class="status-overview">
            <div class="status-item">
              <div class="status-dot pending"></div>
              <span class="status-label">待审批</span>
              <span class="status-count">{{ stats.pendingDecorations }}</span>
            </div>
            <div class="status-item">
              <div class="status-dot in-progress"></div>
              <span class="status-label">进行中</span>
              <span class="status-count">{{ stats.inProgressDecorations }}</span>
            </div>
            <div class="status-item">
              <div class="status-dot refunding"></div>
              <span class="status-label">退押中</span>
              <span class="status-count">{{ stats.pendingRefunds }}</span>
            </div>
            <div class="status-item">
              <div class="status-dot completed"></div>
              <span class="status-label">已完成</span>
              <span class="status-count">{{ stats.completedDecorations }}</span>
            </div>
          </div>
          <el-divider />
          <div class="amount-overview">
            <div class="amount-item">
              <span class="amount-label">已收押金</span>
              <span class="amount-value deposit">¥{{ stats.totalDeposit?.toLocaleString() || 0 }}</span>
            </div>
            <div class="amount-item">
              <span class="amount-label">已扣款</span>
              <span class="amount-value deduction">¥{{ stats.totalDeduction?.toLocaleString() || 0 }}</span>
            </div>
            <div class="amount-item">
              <span class="amount-label">已退还</span>
              <span class="amount-value refund">¥{{ stats.totalRefund?.toLocaleString() || 0 }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

const router = useRouter()
const activeTab = ref('decorations')
const stats = ref({})
const pendingTasks = ref({})

async function loadStats() {
  try {
    const response = await api.get('/dashboard/stats')
    stats.value = response.data
  } catch (err) {
    console.error(err)
  }
}

async function loadPendingTasks() {
  try {
    const response = await api.get('/dashboard/pending-tasks')
    pendingTasks.value = response.data
  } catch (err) {
    console.error(err)
  }
}

function goToDetail(id) {
  router.push(`/decoration/${id}`)
}

onMounted(() => {
  loadStats()
  loadPendingTasks()
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border: none;
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
  margin-right: 16px;
}

.stat-icon.blue { background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%); }
.stat-icon.green { background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%); }
.stat-icon.purple { background: linear-gradient(135deg, #909399 0%, #a6a9ad 100%); }

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.card-header {
  font-weight: 500;
  font-size: 16px;
}

.status-overview {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
}

.status-item {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-bottom: 8px;
}

.status-dot.pending { background-color: #909399; }
.status-dot.in-progress { background-color: #409eff; }
.status-dot.refunding { background-color: #e6a23c; }
.status-dot.completed { background-color: #67c23a; }

.status-label {
  font-size: 13px;
  color: #666;
}

.status-count {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin-top: 4px;
}

.amount-overview {
  display: flex;
  justify-content: space-around;
}

.amount-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.amount-label {
  font-size: 13px;
  color: #999;
}

.amount-value {
  font-size: 20px;
  font-weight: bold;
  margin-top: 4px;
}

.amount-value.deposit { color: #67c23a; }
.amount-value.deduction { color: #e6a23c; }
.amount-value.refund { color: #409eff; }
</style>
