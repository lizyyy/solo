<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">任务列表</h1>
      <div class="page-actions">
        <router-link to="/new" class="btn btn-primary">
          <span>+</span> 新建任务
        </router-link>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="missions.length === 0" class="card">
      <div class="card-body">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3 class="empty-title">暂无任务</h3>
          <p class="empty-description">
            点击"新建任务"按钮创建您的第一个无人机飞行任务
          </p>
          <router-link to="/new" class="btn btn-primary btn-lg" style="margin-top: 1rem;">
            创建第一个任务
          </router-link>
        </div>
      </div>
    </div>

    <div v-else class="mission-list">
      <router-link 
        v-for="mission in missions" 
        :key="mission.id" 
        :to="`/mission/${mission.id}`"
        class="mission-item"
      >
        <div class="mission-info">
          <h3 class="mission-name">{{ mission.name }}</h3>
          <p class="mission-description">
            {{ mission.description || '暂无描述' }}
          </p>
          <div class="mission-meta">
            <span class="mission-meta-item">
              <span>📍</span>
              {{ mission.waypointCount || 0 }} 个航点
            </span>
            <span class="mission-meta-item">
              <span>🚫</span>
              {{ mission.restrictedZoneCount || 0 }} 个限制区
            </span>
            <span class="mission-meta-item">
              <span>🔋</span>
              {{ mission.batteryCount || 0 }} 块电池
            </span>
            <span class="mission-meta-item">
              <span>📅</span>
              {{ formatDate(mission.createdAt) }}
            </span>
          </div>
        </div>
        <div class="mission-status">
          <span 
            class="status-badge" 
            :class="getStatusClass(mission.summary?.status || 'draft')"
          >
            {{ getStatusText(mission.summary?.status) }}
          </span>
          <span 
            class="status-badge status-draft"
          >
            {{ getMissionStatusText(mission.status) }}
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { missionApi } from '@/api';

const loading = ref(true);
const missions = ref([]);

const formatDate = (dateString) => {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusClass = (status) => {
  switch (status) {
    case 'ok': return 'status-ok';
    case 'warning': return 'status-warning';
    case 'critical': return 'status-critical';
    default: return 'status-draft';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'ok': return '检查通过';
    case 'warning': return '有警告';
    case 'critical': return '不通过';
    default: return '待检查';
  }
};

const getMissionStatusText = (status) => {
  switch (status) {
    case 'draft': return '草稿';
    case 'ready': return '已就绪';
    case 'needs_attention': return '需关注';
    case 'completed': return '已完成';
    case 'cancelled': return '已取消';
    default: return status;
  }
};

onMounted(async () => {
  try {
    missions.value = await missionApi.getAll();
  } catch (error) {
    console.error('加载任务列表失败:', error);
  } finally {
    loading.value = false;
  }
});
</script>
