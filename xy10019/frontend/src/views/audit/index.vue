<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">审计日志</h2>
    </div>

    <div class="search-bar">
      <el-select
        v-model="filters.operation"
        placeholder="操作类型"
        style="width: 150px"
        clearable
      >
        <el-option label="创建" value="CREATE" />
        <el-option label="更新" value="UPDATE" />
        <el-option label="删除" value="DELETE" />
        <el-option label="调拨" value="TRANSFER" />
        <el-option label="改价" value="PRICE_CHANGE" />
        <el-option label="调整" value="ADJUST" />
        <el-option label="批量" value="BATCH" />
        <el-option label="导出" value="EXPORT" />
      </el-select>

      <el-select
        v-model="filters.entity"
        placeholder="实体类型"
        style="width: 150px"
        clearable
      >
        <el-option label="用户" value="USER" />
        <el-option label="门店" value="STORE" />
        <el-option label="商品" value="PRODUCT" />
        <el-option label="库存" value="INVENTORY" />
        <el-option label="调拨单" value="TRANSFER_ORDER" />
      </el-select>

      <el-input
        v-model="filters.keyword"
        placeholder="搜索操作人/备注/实体名"
        style="width: 250px"
        clearable
        @keyup.enter="loadData"
      />

      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="width: 320px"
      />

      <el-button type="primary" @click="loadData">
        <el-icon><Search /></el-icon>
        查询
      </el-button>

      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="logs" v-loading="loading" stripe>
      <el-table-column prop="timestamp" label="时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-tag :type="getOperationTagType(row.operation)">
            {{ getAuditOperationLabel(row.operation) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="实体" width="100">
        <template #default="{ row }">
          {{ getAuditEntityLabel(row.entity) }}
        </template>
      </el-table-column>
      <el-table-column label="实体信息" width="200">
        <template #default="{ row }">
          <div>
            <div><strong>{{ row.entityName || '-' }}</strong></div>
            <div class="text-info" style="font-size: 12px">
              ID: {{ row.entityId || '-' }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="变更字段" min-width="180">
        <template #default="{ row }">
          <el-tag
            v-for="field in (row.changedFields || []).slice(0, 3)"
            :key="field"
            size="small"
            style="margin-right: 5px"
          >
            {{ field }}
          </el-tag>
          <span v-if="row.changedFields?.length > 3" class="text-info">
            ...共 {{ row.changedFields.length }} 个
          </span>
          <span v-if="!row.changedFields || row.changedFields.length === 0" class="text-info">
            -
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="operatorName" label="操作人" width="100" />
      <el-table-column prop="requestId" label="请求ID" width="200">
        <template #default="{ row }">
          <el-tag
            v-if="row.requestId"
            size="small"
            type="info"
            @click="replayRequest(row.requestId)"
            style="cursor: pointer"
          >
            {{ row.requestId.substring(0, 20) }}...
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150">
        <template #default="{ row }">
          {{ row.remark || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            type="primary"
            link
            size="small"
            @click="viewDetail(row)"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="flex-between mt-20">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </div>

    <el-dialog
      v-model="detailDialogVisible"
      title="审计日志详情"
      width="900px"
    >
      <el-descriptions :column="2" border v-if="currentLog">
        <el-descriptions-item label="日志ID">
          {{ currentLog.id }}
        </el-descriptions-item>
        <el-descriptions-item label="操作时间">
          {{ formatDate(currentLog.timestamp) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作类型">
          <el-tag :type="getOperationTagType(currentLog.operation)">
            {{ getAuditOperationLabel(currentLog.operation) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="实体类型">
          {{ getAuditEntityLabel(currentLog.entity) }}
        </el-descriptions-item>
        <el-descriptions-item label="实体ID">
          {{ currentLog.entityId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="实体名称">
          {{ currentLog.entityName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ currentLog.operatorName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="请求ID">
          {{ currentLog.requestId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="变更字段" :span="2">
          <el-tag
            v-for="field in (currentLog.changedFields || [])"
            :key="field"
            size="small"
            style="margin-right: 5px"
          >
            {{ field }}
          </el-tag>
          <span v-if="!currentLog.changedFields || currentLog.changedFields.length === 0" class="text-info">
            无
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ currentLog.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <h3 class="mt-20" style="margin-bottom: 10px">数据快照对比</h3>
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="snapshot-title text-warning">变更前 (Before)</div>
          <el-card class="snapshot-card">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">
{{ formatJson(currentLog?.beforeSnapshot) }}
            </pre>
          </el-card>
        </el-col>
        <el-col :span="12">
          <div class="snapshot-title text-success">变更后 (After)</div>
          <el-card class="snapshot-card">
            <pre style="white-space: pre-wrap; word-break: break-all; margin: 0">
{{ formatJson(currentLog?.afterSnapshot) }}
            </pre>
          </el-card>
        </el-col>
      </el-row>

      <div class="mt-20 flex-center" style="justify-content: flex-end">
        <el-button type="primary" @click="replayCurrentLog">
          <el-icon><VideoPlay /></el-icon>
          回放操作
        </el-button>
      </div>
    </el-dialog>

    <el-dialog
      v-model="replayDialogVisible"
      title="请求操作回放"
      width="800px"
    >
      <div class="mb-20">
        <strong>请求ID:</strong> {{ currentRequestId }}
      </div>

      <el-timeline>
        <el-timeline-item
          v-for="log in requestLogs"
          :key="log.id"
          :timestamp="formatDate(log.timestamp)"
          placement="top"
          :type="getTimelineType(log.operation)"
        >
          <el-card>
            <h4>
              <el-tag :type="getOperationTagType(log.operation)">
                {{ getAuditOperationLabel(log.operation) }}
              </el-tag>
              {{ getAuditEntityLabel(log.entity) }}
            </h4>
            <p><strong>实体:</strong> {{ log.entityName || log.entityId }}</p>
            <p><strong>操作人:</strong> {{ log.operatorName }}</p>
            <p v-if="log.remark"><strong>备注:</strong> {{ log.remark }}</p>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { auditApi } from '@/api';
import { formatDate, getAuditOperationLabel, getAuditEntityLabel } from '@/utils/format';

const loading = ref(false);
const logs = ref<any[]>([]);
const currentLog = ref<any>(null);
const currentRequestId = ref('');
const requestLogs = ref<any[]>([]);

const filters = reactive({
  operation: '',
  entity: '',
  keyword: '',
});

const dateRange = ref<string[]>([]);

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const detailDialogVisible = ref(false);
const replayDialogVisible = ref(false);

const loadData = async () => {
  loading.value = true;
  try {
    const params: any = {
      operation: filters.operation || undefined,
      entity: filters.entity || undefined,
      keyword: filters.keyword || undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    };

    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0];
      params.endTime = dateRange.value[1];
    }

    const res = await auditApi.list(params);
    const data = res.data as any;
    logs.value = data?.logs || [];
    pagination.total = data?.total || 0;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.operation = '';
  filters.entity = '';
  filters.keyword = '';
  dateRange.value = [];
  pagination.page = 1;
  loadData();
};

const viewDetail = (row: any) => {
  currentLog.value = row;
  detailDialogVisible.value = true;
};

const replayCurrentLog = async () => {
  if (!currentLog.value?.requestId) return;

  const res = await auditApi.getByRequestId(currentLog.value.requestId);
  currentRequestId.value = currentLog.value.requestId;
  requestLogs.value = (res.data as any[]) || [];
  detailDialogVisible.value = false;
  replayDialogVisible.value = true;
};

const replayRequest = async (requestId: string) => {
  const res = await auditApi.getByRequestId(requestId);
  currentRequestId.value = requestId;
  requestLogs.value = (res.data as any[]) || [];
  replayDialogVisible.value = true;
};

const formatJson = (data: any) => {
  if (!data) return '-';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

const getOperationTagType = (operation: string) => {
  const map: Record<string, string> = {
    CREATE: 'success',
    UPDATE: 'primary',
    DELETE: 'danger',
    TRANSFER: 'warning',
    PRICE_CHANGE: 'warning',
    ADJUST: 'info',
    BATCH: 'warning',
    EXPORT: 'info',
  };
  return map[operation] || 'info';
};

const getTimelineType = (operation: string) => {
  const map: Record<string, string> = {
    CREATE: 'success',
    UPDATE: 'primary',
    DELETE: 'danger',
    TRANSFER: 'warning',
    PRICE_CHANGE: 'warning',
  };
  return map[operation] || '';
};

onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
.snapshot-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.snapshot-card {
  max-height: 400px;
  overflow: auto;
  background: #f5f7fa;

  pre {
    font-family: monospace;
    font-size: 12px;
    color: #606266;
  }
}

.mb-20 {
  margin-bottom: 20px;
}
</style>
