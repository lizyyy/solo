<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">报表导出</h2>
    </div>

    <el-card>
      <h3 class="mb-20" style="font-weight: 600">库存报表</h3>

      <el-form :model="exportForm" label-width="100px" style="max-width: 600px">
        <el-form-item label="门店">
          <el-select
            v-model="exportForm.storeId"
            placeholder="全部门店"
            style="width: 100%"
            clearable
          >
            <el-option
              v-for="store in appStore.activeStores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="时间范围">
          <el-date-picker
            v-model="exportForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="导出内容">
          <el-checkbox-group v-model="exportForm.include">
            <el-checkbox label="records">库存变动记录</el-checkbox>
            <el-checkbox label="transfers">调拨记录</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="导出格式">
          <el-radio-group v-model="exportForm.format">
            <el-radio-button value="excel">
              <el-icon><Document /></el-icon>
              Excel
            </el-radio-button>
            <el-radio-button value="markdown">
              <el-icon><Menu /></el-icon>
              Markdown
            </el-radio-button>
            <el-radio-button value="pdf">
              <el-icon><Picture /></el-icon>
              PDF
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="exporting"
            @click="handleExport"
          >
            <el-icon><Download /></el-icon>
            立即导出
          </el-button>

          <el-button
            type="success"
            size="large"
            @click="handleAsyncExport"
          >
            <el-icon><Timer /></el-icon>
            异步导出
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mt-20">
      <div class="flex-between" style="margin-bottom: 20px">
        <h3 style="font-weight: 600">导出任务记录</h3>
        <el-button link @click="loadTasks">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <el-table :data="tasks" v-loading="tasksLoading" stripe>
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="taskType" label="任务类型" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getTaskStatusLabel(row.status).type">
              {{ getTaskStatusLabel(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.priority === 'CRITICAL'" type="danger">高</el-tag>
            <el-tag v-else-if="row.priority === 'HIGH'" type="warning">中高</el-tag>
            <el-tag v-else-if="row.priority === 'NORMAL'" type="info">普通</el-tag>
            <el-tag v-else type="info">低</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="row.status === 'COMPLETED' ? 100 : row.status === 'FAILED' ? 0 : 50"
              :status="
                row.status === 'COMPLETED'
                  ? 'success'
                  : row.status === 'FAILED'
                  ? 'exception'
                  : undefined
              "
            />
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试次数" width="100">
          <template #default="{ row }">
            {{ row.retryCount }} / {{ row.maxRetryCount }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="completedAt" label="完成时间" width="180">
          <template #default="{ row }">
            {{ row.completedAt ? formatDate(row.completedAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PENDING' || row.status === 'PROCESSING'"
              type="danger"
              link
              size="small"
              @click="cancelTask(row)"
            >
              取消
            </el-button>
            <el-button
              v-if="row.status === 'COMPLETED' && row.result"
              type="primary"
              link
              size="small"
              @click="viewResult(row)"
            >
              结果
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { exportApi } from '@/api';
import { formatDate, getTaskStatusLabel } from '@/utils/format';

const appStore = useAppStore();

const exporting = ref(false);
const tasksLoading = ref(false);
const tasks = ref<any[]>([]);

const exportForm = reactive({
  storeId: '',
  dateRange: [] as string[],
  include: ['records', 'transfers'],
  format: 'excel' as 'excel' | 'markdown' | 'pdf',
});

const loadTasks = async () => {
  tasksLoading.value = true;
  try {
    const res = await exportApi.getTasks(50, 0);
    tasks.value = (res.data as any)?.tasks || [];
  } finally {
    tasksLoading.value = false;
  }
};

const handleExport = async () => {
  exporting.value = true;
  try {
    await exportApi.exportInventory(exportForm.format, {
      storeId: exportForm.storeId || undefined,
      startTime: exportForm.dateRange?.[0],
      endTime: exportForm.dateRange?.[1],
      includeRecords: exportForm.include.includes('records'),
      includeTransfers: exportForm.include.includes('transfers'),
    });

    ElMessage.success('导出成功');
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败');
  } finally {
    exporting.value = false;
  }
};

const handleAsyncExport = async () => {
  try {
    const res = await exportApi.exportInventoryAsync(exportForm.format, {
      storeId: exportForm.storeId || undefined,
      startTime: exportForm.dateRange?.[0],
      endTime: exportForm.dateRange?.[1],
      includeRecords: exportForm.include.includes('records'),
      includeTransfers: exportForm.include.includes('transfers'),
    });

    const data = res.data as any;
    ElMessage.success(
      `导出任务已提交 (任务ID: ${data.taskId})，请在下方查看进度`
    );
    loadTasks();
  } catch (error: any) {
    ElMessage.error(error.message || '提交失败');
  }
};

const cancelTask = async (row: any) => {
  try {
    await exportApi.getTaskStatus(row.id);
    ElMessage.success('任务已取消');
    loadTasks();
  } catch (error: any) {
    ElMessage.error(error.message || '取消失败');
  }
};

const viewResult = (row: any) => {
  ElMessage.info(`任务结果: ${JSON.stringify(row.result)}`);
};

onMounted(() => {
  appStore.init();
  loadTasks();
});
</script>

<style lang="scss" scoped>
.mb-20 {
  margin-bottom: 20px;
}

.mt-20 {
  margin-top: 20px;
}
</style>
