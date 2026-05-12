<template>
  <div class="claim-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>赔付记录</span>
          <el-button type="success" @click="exportData">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </template>

      <el-table :data="claims" style="width: 100%" v-loading="loading">
        <el-table-column prop="linen_type" label="布草类型" width="120" />
        <el-table-column prop="barcode" label="条形码" width="150" />
        <el-table-column prop="batch_no" label="批次号" width="180" />
        <el-table-column prop="amount" label="赔付金额" width="120" />
        <el-table-column prop="reason" label="赔付原因" width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'info'">
              {{ row.status === 'completed' ? '已完成' : row.status === 'cancelled' ? '已取消' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Download } from '@element-plus/icons-vue';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default {
  name: 'ClaimList',
  components: { Download },
  setup() {
    const loading = ref(false);
    const claims = ref([]);

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleString('zh-CN');
    };

    const getStatusText = (status) => {
      const map = {
        completed: '已完成',
        cancelled: '已取消',
        pending: '待处理'
      };
      return map[status] || status;
    };

    const fetchClaims = async () => {
      loading.value = true;
      try {
        const res = await axios.get('/api/claims');
        claims.value = res.data;
      } catch (err) {
        ElMessage.error('获取赔付记录失败');
      } finally {
        loading.value = false;
      }
    };

    const exportData = () => {
      const data = claims.value.map(c => ({
        '布草类型': c.linen_type || '',
        '条形码': c.barcode || '',
        '批次号': c.batch_no || '',
        '赔付金额': c.amount,
        '赔付原因': c.reason || '',
        '状态': getStatusText(c.status),
        '创建时间': formatDate(c.created_at)
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '赔付记录');
      XLSX.writeFile(wb, '赔付记录.xlsx');
    };

    onMounted(() => {
      fetchClaims();
    });

    return {
      loading,
      claims,
      formatDate,
      exportData
    };
  }
};
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
