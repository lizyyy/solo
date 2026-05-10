<template>
  <div class="dashboard">
    <div class="stats-row">
      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon blue">
            <el-icon size="28"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ data?.stats?.totalMembers || 0 }}</div>
            <div class="stat-label">会员总数</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon green">
            <el-icon size="28"><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ data?.stats?.paidThisYear || 0 }}</div>
            <div class="stat-label">本年度已结清</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon orange">
            <el-icon size="28"><Clock /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ data?.stats?.overdue || 0 }}</div>
            <div class="stat-label">逾期未缴</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon purple">
            <el-icon size="28"><Discount /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ data?.stats?.pendingReductions || 0 }}</div>
            <div class="stat-label">待审批减免</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon red">
            <el-icon size="28"><UserRemove /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ data?.stats?.resignedMembers || 0 }}</div>
            <div class="stat-label">已退会</div>
          </div>
        </div>
      </el-card>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="section-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>年度缴费完成情况</span>
              <span class="completion-rate">
                完成率：<strong>{{ data?.completionRate || 0 }}%</strong>
              </span>
            </div>
          </template>
          
          <div class="progress-section">
            <div class="progress-bar-container">
              <div 
                class="progress-bar" 
                :style="{ width: (data?.completionRate || 0) + '%' }"
              ></div>
            </div>
            <div class="progress-labels">
              <span>已完成 {{ data?.stats?.paidThisYear || 0 }} 家</span>
              <span>未完成 {{ (data?.stats?.activeMembers || 0) - (data?.stats?.paidThisYear || 0) }} 家</span>
            </div>
          </div>
          
          <el-divider />
          
          <div class="amount-summary">
            <div class="amount-item">
              <span class="amount-label">应收总额</span>
              <span class="amount-value primary">¥{{ formatNumber(data?.annualSummary?.totalOriginal) }}</span>
            </div>
            <div class="amount-item">
              <span class="amount-label">减免总额</span>
              <span class="amount-value warning">¥{{ formatNumber(data?.annualSummary?.totalReduction) }}</span>
            </div>
            <div class="amount-item">
              <span class="amount-label">已收总额</span>
              <span class="amount-value success">¥{{ formatNumber(data?.annualSummary?.totalPaid) }}</span>
            </div>
            <div class="amount-item">
              <span class="amount-label">欠费总额</span>
              <span class="amount-value danger">¥{{ formatNumber(data?.annualSummary?.totalDue) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card class="section-card risk-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="danger-title"><el-icon><Warning /></el-icon> 风险预警</span>
            </div>
          </template>
          
          <div class="risk-list">
            <div v-if="!data?.risks?.length" class="empty-state">
              <el-empty description="暂无风险" :image-size="60" />
            </div>
            <div v-for="(risk, index) in data?.risks" :key="index" class="risk-item">
              <div class="risk-header">
                <span class="risk-tag high">高风险</span>
                <span class="risk-level">{{ risk.memberLevel }}</span>
              </div>
              <div class="risk-company">{{ risk.companyName }}</div>
              <div class="risk-desc">{{ risk.description }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card class="section-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon><List /></el-icon> 待办事项</span>
              <el-badge :value="data?.todos?.length || 0" :max="99" class="item" />
            </div>
          </template>
          
          <div class="todo-list">
            <div v-if="!data?.todos?.length" class="empty-state">
              <el-empty description="暂无待办" :image-size="60" />
            </div>
            <div v-for="(todo, index) in data?.todos" :key="index" class="todo-item">
              <div class="todo-icon" :class="todo.type === 'reduction' ? 'purple-bg' : 'orange-bg'">
                <el-icon v-if="todo.type === 'reduction'"><Discount /></el-icon>
                <el-icon v-else><Bell /></el-icon>
              </div>
              <div class="todo-content">
                <div class="todo-title">
                  <strong>{{ todo.companyName }}</strong>
                  <span class="badge-primary">{{ todo.memberLevel }}</span>
                  <span v-if="todo.type === 'reduction'" class="badge-warning">{{ todo.requestType }}</span>
                </div>
                <div class="todo-desc">
                  <template v-if="todo.type === 'reduction'">
                    {{ todo.reason }}
                  </template>
                  <template v-else>
                    {{ todo.description }}
                  </template>
                </div>
              </div>
              <div class="todo-action">
                <el-button 
                  v-if="todo.type === 'reduction'"
                  type="primary" 
                  size="small" 
                  link
                  @click="$router.push('/reductions')"
                >
                  去审批
                </el-button>
                <el-button 
                  v-else
                  type="warning" 
                  size="small" 
                  link
                  @click="$router.push('/members')"
                >
                  去催缴
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card class="section-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span><el-icon><Star /></el-icon> 高价值会员</span>
              <span class="sub-text">会费 ≥ ¥15,000</span>
            </div>
          </template>
          
          <el-table :data="data?.highValueMembers || []" size="small" stripe>
            <el-table-column prop="memberCode" label="编号" width="80" />
            <el-table-column prop="companyName" label="企业名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="memberLevel" label="等级" width="100" />
            <el-table-column prop="originalAmount" label="应收" width="120">
              <template #default="{ row }">
                ¥{{ formatNumber(row.originalAmount) }}
              </template>
            </el-table-column>
            <el-table-column prop="isPaid" label="状态" width="80">
              <template #default="{ row }">
                <span v-if="row.isPaid" class="badge-success">已交</span>
                <span v-else class="badge-danger">未交</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import request from '@/utils/request';

const data = ref(null);

function formatNumber(num) {
  if (num == null) return '0.00';
  return parseFloat(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadData() {
  data.value = await request.get('/reports/dashboard');
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  min-width: 180px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-icon.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon.green { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.stat-icon.purple { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.stat-icon.red { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 6px;
}

.section-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.completion-rate {
  font-size: 13px;
  color: #909399;
}

.completion-rate strong {
  color: #67c23a;
  font-size: 18px;
  margin-left: 4px;
}

.progress-section {
  margin-bottom: 10px;
}

.progress-bar-container {
  height: 24px;
  background: #f0f2f5;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #67c23a 0%, #85ce61 100%);
  border-radius: 12px;
  transition: width 0.3s ease;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #909399;
}

.amount-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.amount-item {
  text-align: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.amount-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.amount-value {
  font-size: 18px;
  font-weight: 600;
}

.amount-value.primary { color: #409eff; }
.amount-value.success { color: #67c23a; }
.amount-value.warning { color: #e6a23c; }
.amount-value.danger { color: #f56c6c; }

.danger-title {
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 4px;
}

.risk-list {
  max-height: 280px;
  overflow-y: auto;
}

.risk-item {
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  margin-bottom: 10px;
  border-left: 3px solid #f56c6c;
}

.risk-item:last-child {
  margin-bottom: 0;
}

.risk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.risk-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.risk-tag.high {
  background: #f56c6c;
  color: #fff;
}

.risk-level {
  font-size: 12px;
  color: #909399;
}

.risk-company {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.risk-desc {
  font-size: 13px;
  color: #606266;
}

.empty-state {
  padding: 20px;
}

.todo-list {
  max-height: 340px;
  overflow-y: auto;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 10px;
}

.todo-item:last-child {
  margin-bottom: 0;
}

.todo-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.todo-icon.purple-bg { background: #9b59b6; }
.todo-icon.orange-bg { background: #e67e22; }

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-size: 14px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.todo-desc {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-action {
  flex-shrink: 0;
}

.sub-text {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.mt-20 {
  margin-top: 0;
}
</style>
