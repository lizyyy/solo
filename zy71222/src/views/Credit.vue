<template>
  <div class="credit">
    <div class="page-title">授信额度</div>

    <el-row :gutter="20" class="credit-overview">
      <el-col :span="8">
        <div class="credit-card credit-limit">
          <div class="card-icon">
            <el-icon :size="40"><Wallet /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-label">授信总额度</div>
            <div class="card-value">{{ formatMoney(creditStore.totalCreditLimit) }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="credit-card credit-used">
          <div class="card-icon">
            <el-icon :size="40"><TrendCharts /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-label">已使用额度</div>
            <div class="card-value">{{ formatMoney(creditStore.usedCredit) }}</div>
            <div class="card-rate">使用率 {{ creditStore.creditUtilizationRate }}%</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="credit-card credit-available">
          <div class="card-icon">
            <el-icon :size="40"><CircleCheck /></el-icon>
          </div>
          <div class="card-info">
            <div class="card-label">可用额度</div>
            <div class="card-value">{{ formatMoney(creditStore.availableCredit) }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="page-container">
      <div class="chart-title">额度使用进度</div>
      <el-progress 
        :percentage="Number(creditStore.creditUtilizationRate)" 
        :stroke-width="20"
        :color="progressColor"
        :format="(percentage) => `${percentage}%`"
      />
    </div>

    <div class="page-container">
      <div class="chart-title">额度变动历史</div>
      <el-table :data="sortedCreditHistory" stripe border>
        <el-table-column prop="id" label="记录编号" width="100" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'release' ? 'success' : 'warning'" size="small">
              {{ row.type === 'release' ? '回补' : '占用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="130">
          <template #default="{ row }">
            <span :class="row.type === 'release' ? 'amount-release' : 'amount-occupy'">
              {{ row.type === 'release' ? '+' : '-' }}{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="关联单据" width="160">
          <template #default="{ row }">
            <span v-if="row.invoiceId">发票: {{ row.invoiceId }}</span>
            <span v-if="row.redemptionId">红冲: {{ row.redemptionId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="140" />
        <el-table-column prop="operateTime" label="操作时间" width="180">
          <template #default="{ row }">{{ formatTime(row.operateTime) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCreditStore } from '@/stores/credit'
import dayjs from 'dayjs'

const creditStore = useCreditStore()

const sortedCreditHistory = computed(() => {
  return [...creditStore.creditHistory].sort((a, b) => new Date(b.operateTime) - new Date(a.operateTime))
})

const progressColor = computed(() => {
  const rate = Number(creditStore.creditUtilizationRate)
  if (rate >= 90) return '#f56c6c'
  if (rate >= 70) return '#e6a23c'
  return '#67c23a'
})

function formatMoney(value) {
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<style lang="scss" scoped>
.credit {
  .credit-overview {
    margin-bottom: 20px;
  }

  .credit-card {
    background: #fff;
    border-radius: 8px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);

    .card-icon {
      width: 72px;
      height: 72px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-info {
      flex: 1;

      .card-label {
        font-size: 14px;
        color: #909399;
        margin-bottom: 8px;
      }

      .card-value {
        font-size: 24px;
        font-weight: 600;
        color: #303133;
      }

      .card-rate {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }

    &.credit-limit {
      .card-icon {
        background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
        color: #fff;
      }
    }

    &.credit-used {
      .card-icon {
        background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
        color: #fff;
      }
    }

    &.credit-available {
      .card-icon {
        background: linear-gradient(135deg, #67c23a 0%, #95d475 100%);
        color: #fff;
      }
    }
  }

  .chart-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 16px;
  }

  .amount-release {
    color: #67c23a;
    font-weight: 500;
  }

  .amount-occupy {
    color: #e6a23c;
    font-weight: 500;
  }
}
</style>
