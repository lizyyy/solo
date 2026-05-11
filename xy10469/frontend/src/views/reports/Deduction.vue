<template>
  <div class="deduction-report">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>扣款明细报表</span>
          <div style="display: flex; gap: 12px">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 320px"
            />
            <el-button type="primary" @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" style="margin-bottom: 20px">
        <el-col :span="6">
          <el-statistic title="扣款总金额">
            <template #default>
              <span style="color: #f5222d">{{ formatCurrency(summary.totalAmount || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="扣款笔数">
            <template #default>
              <span style="color: #fa8c16">{{ summary.totalCount || 0 }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="涉及商户数">
            <template #default>
              <span style="color: #1890ff">{{ summary.merchantCount || 0 }}</span>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="单笔最高">
            <template #default>
              <span style="color: #722ed1">{{ formatCurrency(summary.maxAmount || 0) }}</span>
            </template>
          </el-statistic>
        </el-col>
      </el-row>

      <el-table :data="deductionList" v-loading="loading" stripe>
        <el-table-column prop="transactionNo" label="交易编号" width="180" />
        <el-table-column label="商户" width="150">
          <template #default="{ row }">{{ row.merchantName }}</template>
        </el-table-column>
        <el-table-column label="申请编号" width="160">
          <template #default="{ row }">{{ row.applicationNo }}</template>
        </el-table-column>
        <el-table-column label="摊位" width="120">
          <template #default="{ row }">{{ row.boothCode }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="扣款金额" width="120" align="right">
          <template #default="{ row }">
            <span style="color: #f5222d; font-weight: 600">{{ formatCurrency(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="扣款来源" width="120">
          <template #default="{ row }">
            <el-tag type="warning">{{ row.source || '撤场验收' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="验收项明细" min-width="250">
          <template #default="{ row }">
            <div v-if="row.items && row.items.length" style="font-size: 12px">
              <div v-for="(item, idx) in row.items" :key="idx" style="margin-bottom: 4px">
                <el-tag size="small" :type="item.passed ? 'success' : 'danger'" style="margin-right: 6px">
                  {{ item.passed ? '通过' : '未通过' }}
                </el-tag>
                <span>{{ item.name }}</span>
                <span v-if="item.deductionAmount > 0" style="color: #f5222d; margin-left: 8px">
                  扣 {{ formatCurrency(item.deductionAmount) }}
                </span>
              </div>
            </div>
            <span v-else style="color: #999">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="transactionDate" label="扣款时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.transactionDate) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="showDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" title="扣款详情" width="550px">
      <el-form v-if="currentDetail" label-width="100px">
        <el-form-item label="交易编号">
          <el-tag>{{ currentDetail.transactionNo }}</el-tag>
        </el-form-item>
        <el-form-item label="商户">
          {{ currentDetail.merchantName }}
        </el-form-item>
        <el-form-item label="申请编号">
          {{ currentDetail.applicationNo }}
        </el-form-item>
        <el-form-item label="摊位">
          {{ currentDetail.boothCode }}
        </el-form-item>
        <el-form-item label="扣款金额">
          <span style="font-size: 20px; font-weight: 700; color: #f5222d">
            {{ formatCurrency(currentDetail.amount) }}
          </span>
        </el-form-item>
        <el-form-item label="扣款原因">
          <div style="background: #fff7e6; padding: 12px; border-radius: 4px; border-left: 4px solid #faad14">
            {{ currentDetail.notes || '撤场验收不合格扣款' }}
          </div>
        </el-form-item>
        <el-form-item label="验收项明细">
          <el-table :data="currentDetail.items" size="small" border>
            <el-table-column prop="category" label="类别" width="100" />
            <el-table-column prop="name" label="验收项" />
            <el-table-column prop="passed" label="结果" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.passed ? 'success' : 'danger'" size="small">
                  {{ row.passed ? '通过' : '未通过' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="deductionAmount" label="扣款" width="100" align="right">
              <template #default="{ row }">
                <span v-if="row.deductionAmount > 0" style="color: #f5222d">
                  {{ formatCurrency(row.deductionAmount) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="deductionReason" label="原因" min-width="150" show-overflow-tooltip />
          </el-table>
        </el-form-item>
        <el-form-item label="扣款时间">
          {{ formatDateTime(currentDetail.transactionDate) }}
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { reportApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils/format';
import dayjs from 'dayjs';

const loading = ref(false);
const summary = ref({});
const deductionList = ref([]);
const detailVisible = ref(false);
const currentDetail = ref(null);

const now = dayjs();
const dateRange = ref([
  now.subtract(90, 'day').format('YYYY-MM-DD'),
  now.format('YYYY-MM-DD')
]);

const loadData = async () => {
  if (!dateRange.value || dateRange.value.length < 2) {
    return;
  }
  
  loading.value = true;
  try {
    const res = await reportApi.getDeductionReport({
      startDate: dateRange.value[0],
      endDate: dateRange.value[1]
    });
    
    const records = res.data?.records || [];
    const merchantIds = new Set();
    let maxAmount = 0;
    
    deductionList.value = records.map(item => {
      merchantIds.add(item.merchantId?._id);
      if (item.amount > maxAmount) maxAmount = item.amount;
      
      return {
        ...item,
        merchantName: item.merchantId?.name || '-',
        applicationNo: item.applicationId?.applicationNo || '-',
        boothCode: item.applicationId?.boothId?.code || '-',
        source: item.acceptanceId ? '撤场验收' : '其他',
        items: item.deductionItems || item.acceptanceId?.items || []
      };
    });
    
    summary.value = {
      totalAmount: res.data?.totalAmount || deductionList.value.reduce((sum, d) => sum + d.amount, 0),
      totalCount: deductionList.value.length,
      merchantCount: merchantIds.size,
      maxAmount
    };
  } catch (error) {
    console.error('加载扣款明细失败:', error);
  } finally {
    loading.value = false;
  }
};

const showDetail = (row) => {
  currentDetail.value = row;
  detailVisible.value = true;
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.deduction-report {
  height: 100%;
}
</style>
