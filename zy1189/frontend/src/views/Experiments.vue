<template>
  <a-layout class="experiments-layout">
    <a-layout-header class="experiments-header">
      <div class="header-content">
        <h2 class="page-title">
          <folder-outlined /> 实验管理
        </h2>
        <div class="header-actions">
          <a-button type="primary" @click="goToSimulator">
            <play-circle-outlined /> 新实验
          </a-button>
        </div>
      </div>
    </a-layout-header>

    <a-layout-content class="experiments-content">
      <a-card>
        <a-table 
          :columns="columns" 
          :data-source="experiments"
          :pagination="{ pageSize: 10 }"
          :row-key="'id'"
          :loading="loading"
        >
          <template #bodyCell="{ column, record }">
            <template v-else-if="column.key === 'name'">
              <a class="experiment-name" @click="openExperiment(record.id)">
                {{ record.name }}
              </a>
            </template>
            <template v-else-if="column.key === 'description'">
              {{ record.description || '-' }}
            </template>
            <template v-else-if="column.key === 'taskCount'">
              <a-badge :count="record.tasks?.length || 0" :showZero="true" />
            </template>
            <template v-else-if="column.key === 'eventCount'">
              {{ record.events?.length || 0 }}
            </template>
            <template v-else-if="column.key === 'lastTick'">
              {{ record.lastTick || 0 }}
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'updatedAt'">
              {{ formatDate(record.updatedAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="openExperiment(record.id)">
                  打开
                </a-button>
                <a-button size="small" @click="duplicateExperiment(record.id)">
                  复制
                </a-button>
                <a-popconfirm 
                  title="确定删除此实验?" 
                  @confirm="deleteExperiment(record.id)"
                >
                  <a-button size="small" danger type="link">
                    删除
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
        
        <a-empty v-if="experiments.length === 0 && !loading" description="暂无实验">
          <a-button type="primary" @click="goToSimulator">
            创建第一个实验
          </a-button>
        </a-empty>
      </a-card>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { FolderOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'
import type { Experiment } from '@/types'
import axios from 'axios'

const router = useRouter()
const experiments = ref<Experiment[]>([])
const loading = ref(false)

const columns = [
  { title: '名称', key: 'name', dataIndex: 'name', width: 200 },
  { title: '描述', key: 'description', dataIndex: 'description' },
  { title: '任务数', key: 'taskCount', width: 100 },
  { title: '事件数', key: 'eventCount', width: 100 },
  { title: '执行 Tick', key: 'lastTick', width: 100 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '更新时间', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const }
]

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const loadExperiments = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/experiments')
    if (response.data.success) {
      experiments.value = response.data.data
    }
  } catch (error) {
    console.error('Failed to load experiments:', error)
    experiments.value = []
  } finally {
    loading.value = false
  }
}

const goToSimulator = () => {
  router.push('/simulator')
}

const openExperiment = (id: string) => {
  router.push(`/simulator?experiment=${id}`)
}

const duplicateExperiment = async (id: string) => {
  try {
    const response = await axios.post(`/api/experiments/${id}/duplicate`)
    if (response.data.success) {
      message.success('实验已复制')
      loadExperiments()
    }
  } catch (error) {
    message.error('复制失败')
  }
}

const deleteExperiment = async (id: string) => {
  try {
    await axios.delete(`/api/experiments/${id}`)
    message.success('实验已删除')
    loadExperiments()
  } catch (error) {
    message.error('删除失败')
  }
}

onMounted(() => {
  loadExperiments()
})
</script>

<style scoped>
.experiments-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.experiments-header {
  background: #001529;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  color: white;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.experiments-content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

.experiment-name {
  color: #1890ff;
  cursor: pointer;
}

.experiment-name:hover {
  text-decoration: underline;
}
</style>
