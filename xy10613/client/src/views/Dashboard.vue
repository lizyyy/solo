<template>
  <div>
    <h2 style="margin-bottom: 20px">异常看板</h2>
    
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 36px; color: #409EFF; font-weight: bold">{{ stats.totalArticles }}</div>
            <div style="color: #666; margin-top: 10px">文章总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 36px; color: #67C23A; font-weight: bold">{{ stats.publishedArticles }}</div>
            <div style="color: #666; margin-top: 10px">已发布</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 36px; color: #E6A23C; font-weight: bold">{{ stats.reviewingArticles }}</div>
            <div style="color: #666; margin-top: 10px">审核中</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 36px; color: #F56C6C; font-weight: bold">{{ stats.indexErrors + stats.publishErrors }}</div>
            <div style="color: #666; margin-top: 10px">异常数量</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold; font-size: 16px">异常列表</span>
          <el-button type="primary" size="small" @click="loadData">刷新</el-button>
        </div>
      </template>
      
      <el-table :data="anomalies" style="width: 100%">
        <el-table-column prop="id" label="文章ID" width="100" />
        <el-table-column prop="title" label="文章标题" min-width="200" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="search_index_status" label="索引状态" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.search_index_status === 'failed' ? 'danger' : 'success'">
              {{ scope.row.search_index_status === 'failed' ? '失败' : '成功' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="200" />
        <el-table-column prop="error_time" label="发生时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="goToDetail(scope.row.id)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const stats = ref({
  totalArticles: 0,
  publishedArticles: 0,
  reviewingArticles: 0,
  indexErrors: 0,
  publishErrors: 0
});
const anomalies = ref([]);

const loadStats = async () => {
  try {
    const response = await axios.get('/api/articles/stats');
    if (response.data.success) {
      stats.value = response.data.data;
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
};

const loadAnomalies = async () => {
  try {
    const response = await axios.get('/api/articles/anomalies');
    if (response.data.success) {
      anomalies.value = response.data.data;
    }
  } catch (error) {
    console.error('加载异常数据失败:', error);
  }
};

const loadData = () => {
  loadStats();
  loadAnomalies();
};

const getStatusType = (status) => {
  const map = {
    draft: 'info',
    reviewing: 'warning',
    approved: 'success',
    published: 'success',
    archived: 'info'
  };
  return map[status] || 'info';
};

const getStatusText = (status) => {
  const map = {
    draft: '草稿',
    reviewing: '审核中',
    approved: '已通过',
    published: '已发布',
    archived: '已归档'
  };
  return map[status] || status;
};

const goToDetail = (id) => {
  router.push(`/article/${id}`);
};

onMounted(() => {
  loadData();
});
</script>
