<template>
  <div>
    <h2 class="page-title">退餐审核</h2>

    <el-card class="card-section">
      <template #header>
        <div class="flex-between">
          <span>待审核退餐记录</span>
          <el-button type="primary" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table :data="pendingReturns" v-loading="loading" stripe>
        <el-table-column prop="batch_no" label="批次号" width="200">
          <template #default="{ row }">
            <span class="batch-no">{{ row.batch_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="配送日期" width="120" />
        <el-table-column prop="elderly_name" label="老人姓名" width="100" />
        <el-table-column prop="reason_name" label="退餐原因" width="150">
          <template #default="{ row }">
            <el-tag :type="row.risk_level === 'high' ? 'danger' : 'warning'">
              {{ row.reason_name }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="row.risk_level === 'high' ? 'danger' : 'warning'">
              {{ row.risk_level === 'high' ? '高风险' : row.risk_level === 'medium' ? '中风险' : '低风险' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason_detail" label="详细说明" min-width="200" />
        <el-table-column prop="meals_returned" label="退回份数" width="100" />
        <el-table-column prop="created_at" label="提交时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="approveReturn(row)">
              <el-icon><Check /></el-icon>
              通过
            </el-button>
            <el-button type="danger" size="small" @click="rejectReturn(row)">
              <el-icon><Close /></el-icon>
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && pendingReturns.length === 0" description="暂无待审核记录" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { returnAPI } from '@/api';

const loading = ref(false);
const pendingReturns = ref([]);

const loadData = async () => {
  loading.value = true;
  try {
    const res = await returnAPI.pending();
    pendingReturns.value = res.data;
  } finally {
    loading.value = false;
  }
};

const approveReturn = async (row) => {
  try {
    await ElMessageBox.confirm(`确定通过此退餐申请吗？老人: ${row.elderly_name}, 原因: ${row.reason_name}`, '审核确认', {
      confirmButtonText: '确定通过',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await returnAPI.approve(row.id, { approved_by: '管理员' });
    ElMessage.success('退餐申请已通过');
    loadData();
  } catch {
    // 用户取消
  }
};

const rejectReturn = async (row) => {
  try {
    await ElMessageBox.confirm(`确定拒绝此退餐申请吗？`, '审核确认', {
      confirmButtonText: '确定拒绝',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await returnAPI.reject(row.id, { rejected_by: '管理员' });
    ElMessage.success('退餐申请已拒绝');
    loadData();
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  loadData();
});
</script>
