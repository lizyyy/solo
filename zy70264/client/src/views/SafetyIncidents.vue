<template>
  <div>
    <h2 class="page-title">食品安全事件</h2>

    <el-card class="card-section">
      <template #header>
        <div class="flex-between">
          <span>事件列表</span>
          <el-button type="primary" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table :data="incidents" v-loading="loading" stripe>
        <el-table-column prop="batch_no" label="批次号" width="200">
          <template #default="{ row }">
            <span class="batch-no">{{ row.batch_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="配送日期" width="120" />
        <el-table-column prop="incident_type" label="事件类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.incident_type === 'temperature' ? 'warning' : 'danger'">
              {{ row.incident_type === 'temperature' ? '温度异常' : '食品安全' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="{ row }">
            <el-tag :type="row.severity === 'high' ? 'danger' : 'warning'">
              {{ row.severity === 'high' ? '高风险' : '中风险' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="事件描述" min-width="250" />
        <el-table-column prop="affected_count" label="受影响人数" width="100" />
        <el-table-column prop="reporter" label="报告人" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'open' ? 'danger' : 'info'">
              {{ row.status === 'open' ? '处理中' : '已关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="报告时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'open'"
              type="primary"
              size="small"
              link
              @click="closeIncident(row)"
            >
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && incidents.length === 0" description="暂无安全事件记录" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { reportAPI } from '@/api';

const loading = ref(false);
const incidents = ref([]);

const loadData = async () => {
  loading.value = true;
  try {
    const res = await reportAPI.incidents();
    incidents.value = res.data;
  } finally {
    loading.value = false;
  }
};

const closeIncident = async (row) => {
  try {
    await ElMessageBox.confirm('确定要关闭此事件吗？关闭后将不再显示在待处理列表中。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await reportAPI.closeIncident(row.id, { closed_by: '管理员' });
    ElMessage.success('事件已关闭');
    loadData();
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  loadData();
});
</script>
