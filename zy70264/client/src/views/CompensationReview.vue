<template>
  <div>
    <h2 class="page-title">补偿审核</h2>

    <el-card class="card-section">
      <template #header>
        <div class="flex-between">
          <span>待审批补偿记录</span>
          <el-button type="primary" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table :data="pendingCompensations" v-loading="loading" stripe>
        <el-table-column prop="batch_no" label="批次号" width="200">
          <template #default="{ row }">
            <span class="batch-no">{{ row.batch_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="配送日期" width="120" />
        <el-table-column prop="elderly_name" label="涉及老人" width="100">
          <template #default="{ row }">
            {{ row.elderly_name || '整批次' }}
          </template>
        </el-table-column>
        <el-table-column prop="compensation_type" label="补偿类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.compensation_type === 'fixed' ? '固定金额' : '比例计算' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="compensation_amount" label="补偿金额" width="120">
          <template #default="{ row }">
            <span style="color: #e6a23c; font-weight: bold; font-size: 16px;">
              ¥{{ row.compensation_amount.toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="补偿原因" min-width="250" />
        <el-table-column prop="created_at" label="生成时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="approveCompensation(row)">
              <el-icon><Check /></el-icon>
              通过
            </el-button>
            <el-button type="danger" size="small" @click="rejectCompensation(row)">
              <el-icon><Close /></el-icon>
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && pendingCompensations.length === 0" description="暂无待审批补偿" />
    </el-card>

    <el-card class="card-section">
      <template #header>
        <span>补偿审批历史</span>
      </template>
      <el-table :data="allCompensations" v-loading="loadingAll" stripe>
        <el-table-column prop="batch_no" label="批次号" width="200">
          <template #default="{ row }">
            <span class="batch-no">{{ row.batch_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="compensation_amount" label="金额" width="100">
          <template #default="{ row }">
            <span style="color: #e6a23c;">¥{{ row.compensation_amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'info'">
              {{ row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已拒绝' : '人工录入' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approved_by" label="审批人" width="100" />
        <el-table-column prop="approval_time" label="审批时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { compensationAPI } from '@/api';

const loading = ref(false);
const loadingAll = ref(false);
const pendingCompensations = ref([]);
const allCompensations = ref([]);

const loadData = async () => {
  loading.value = true;
  try {
    const res = await compensationAPI.pending();
    pendingCompensations.value = res.data;
  } finally {
    loading.value = false;
  }
};

const loadHistory = async () => {
  loadingAll.value = true;
  try {
    const res = await compensationAPI.list();
    allCompensations.value = res.data.filter(c => c.status !== 'pending');
  } finally {
    loadingAll.value = false;
  }
};

const approveCompensation = async (row) => {
  try {
    await ElMessageBox.confirm(`确定审批通过此补偿吗？金额: ¥${row.compensation_amount.toFixed(2)}`, '审批确认', {
      confirmButtonText: '确定通过',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await compensationAPI.approve(row.id, { approved_by: '管理员' });
    ElMessage.success('补偿已审批通过');
    loadData();
    loadHistory();
  } catch {
    // 用户取消
  }
};

const rejectCompensation = async (row) => {
  try {
    await ElMessageBox.confirm(`确定拒绝此补偿吗？`, '审批确认', {
      confirmButtonText: '确定拒绝',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await compensationAPI.reject(row.id, { rejected_by: '管理员' });
    ElMessage.success('补偿已拒绝');
    loadData();
    loadHistory();
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  loadData();
  loadHistory();
});
</script>
