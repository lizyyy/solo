<template>
  <div class="batch-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>洗涤批次</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            创建送洗批次
          </el-button>
        </div>
      </template>

      <el-row :gutter="20" class="filter-row">
        <el-col :span="6">
          <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 100%">
            <el-option label="送洗中" value="sent" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-button type="success" @click="exportData">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
        </el-col>
      </el-row>

      <el-table :data="filteredBatches" style="width: 100%" v-loading="loading">
        <el-table-column prop="batch_no" label="批次号" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'sent' ? 'warning' : 'success'">
              {{ row.status === 'sent' ? '送洗中' : '已完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="send_quantity" label="送洗数量" width="100" />
        <el-table-column prop="receive_quantity" label="回库数量" width="100" />
        <el-table-column prop="send_at" label="送洗时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.send_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="receive_at" label="回库时间" width="180">
          <template #default="{ row }">
            {{ row.receive_at ? formatDate(row.receive_at) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">查看详情</el-button>
            <el-button v-if="row.status === 'sent'" link type="success" @click="openReceiveDialog(row)">验收入库</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="创建送洗批次" width="80%">
      <el-row :gutter="20" class="mb-4">
        <el-col :span="8">
          <el-select v-model="createFilterRoom" placeholder="按房源筛选" clearable style="width: 100%" @change="onFilterChange" @clear="onFilterChange">
            <el-option v-for="room in rooms" :key="room.id" :label="room.name" :value="room.id" />
          </el-select>
        </el-col>
        <el-col :span="8">
          <el-select v-model="createFilterType" placeholder="按类型筛选" clearable style="width: 100%" @change="onFilterChange" @clear="onFilterChange">
            <el-option v-for="type in linenTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-col>
      </el-row>

      <el-table
        :data="availableLinens"
        style="width: 100%; margin-bottom: 20px"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="barcode" label="条形码" width="150" />
        <el-table-column prop="room_name" label="所属房源" width="150" />
        <el-table-column prop="wash_count" label="洗涤次数" width="100" />
      </el-table>

      <div>已选择: {{ selectedLinens.length }} 件</div>

      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="selectedLinens.length === 0" @click="createBatch">确认创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="receiveDialogVisible" title="验收入库" width="80%">
      <div class="mb-4">批次号: {{ currentBatch?.batch_no }}</div>
      <div class="mb-4">送洗数量: {{ batchItems.length }} 件</div>

      <el-table
        :data="batchItems"
        style="width: 100%; margin-bottom: 20px"
        @selection-change="handleReceiveSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="linen_type" label="类型" width="120" />
        <el-table-column prop="linen_id" label="布草ID" width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'received' ? 'success' : 'info'">
              {{ row.status === 'received' ? '已回库' : '送洗中' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div>已选择回库: {{ receivedItems.length }} 件</div>
      <div v-if="batchItems.length - receivedItems.length > 0" class="text-danger">
        未回库: {{ batchItems.length - receivedItems.length }} 件 (将标记为丢失)
      </div>

      <template #footer>
        <el-button @click="receiveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="receiveBatch">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Download } from '@element-plus/icons-vue';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default {
  name: 'BatchList',
  components: { Plus, Download },
  setup() {
    const router = useRouter();
    const loading = ref(false);
    const batches = ref([]);
    const filterStatus = ref('');
    const createDialogVisible = ref(false);
    const receiveDialogVisible = ref(false);
    const currentBatch = ref(null);
    const batchItems = ref([]);
    const selectedLinens = ref([]);
    const receivedItems = ref([]);
    const availableLinens = ref([]);
    const rooms = ref([]);
    const linenTypes = ref([]);
    const createFilterRoom = ref('');
    const createFilterType = ref('');

    const filteredBatches = computed(() => {
      if (!filterStatus.value) return batches.value;
      return batches.value.filter(b => b.status === filterStatus.value);
    });

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleString('zh-CN');
    };

    const fetchBatches = async () => {
      loading.value = true;
      try {
        const res = await axios.get('/api/batches');
        batches.value = res.data;
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '获取批次失败');
      } finally {
        loading.value = false;
      }
    };

    const fetchRooms = async () => {
      try {
        const res = await axios.get('/api/rooms');
        rooms.value = res.data;
      } catch (err) {
        ElMessage.error('获取房源失败');
      }
    };

    const fetchLinenTypes = async () => {
      try {
        const res = await axios.get('/api/linen-types');
        linenTypes.value = res.data;
      } catch (err) {
        ElMessage.error('获取类型失败');
      }
    };

    const fetchAvailableLinens = async () => {
      try {
        const params = { status: 'in_stock' };
        if (createFilterRoom.value) params.room_id = createFilterRoom.value;
        if (createFilterType.value) params.type = createFilterType.value;
        
        const res = await axios.get('/api/linens', { params });
        availableLinens.value = res.data;
      } catch (err) {
        ElMessage.error('获取布草失败');
      }
    };

    const openCreateDialog = async () => {
      selectedLinens.value = [];
      createFilterRoom.value = '';
      createFilterType.value = '';
      await fetchAvailableLinens();
      createDialogVisible.value = true;
    };

    const handleSelectionChange = (selection) => {
      selectedLinens.value = selection;
    };

    const onFilterChange = async () => {
      selectedLinens.value = [];
      await fetchAvailableLinens();
    };

    const createBatch = async () => {
      if (selectedLinens.value.length === 0) {
        ElMessage.warning('请选择要送洗的布草');
        return;
      }

      try {
        await axios.post('/api/batches', {
          items: selectedLinens.value.map(l => ({
            linen_id: l.id,
            type: l.type,
            room_id: l.room_id
          })),
          created_by: 'admin'
        });
        ElMessage.success('批次创建成功');
        createDialogVisible.value = false;
        fetchBatches();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '创建失败');
      }
    };

    const viewDetail = (row) => {
      router.push(`/batches/${row.id}`);
    };

    const openReceiveDialog = async (row) => {
      currentBatch.value = row;
      try {
        const res = await axios.get(`/api/batches/${row.id}`);
        batchItems.value = res.data.items.filter(i => i.status !== 'received');
        receivedItems.value = [];
        receiveDialogVisible.value = true;
      } catch (err) {
        ElMessage.error('获取批次详情失败');
      }
    };

    const handleReceiveSelectionChange = (selection) => {
      receivedItems.value = selection.map(item => item.linen_id);
    };

    const receiveBatch = async () => {
      try {
        await axios.post(`/api/batches/${currentBatch.value.id}/receive`, {
          received_items: receivedItems.value,
          created_by: 'admin'
        });
        ElMessage.success('入库完成');
        receiveDialogVisible.value = false;
        fetchBatches();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '入库失败');
      }
    };

    const exportData = () => {
      const data = batches.value.map(b => ({
        '批次号': b.batch_no,
        '状态': b.status === 'sent' ? '送洗中' : '已完成',
        '送洗数量': b.send_quantity,
        '回库数量': b.receive_quantity,
        '送洗时间': formatDate(b.send_at),
        '回库时间': formatDate(b.receive_at)
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '洗涤批次');
      XLSX.writeFile(wb, '洗涤批次.xlsx');
    };

    onMounted(() => {
      fetchBatches();
      fetchRooms();
      fetchLinenTypes();
    });

    return {
      loading,
      batches,
      filterStatus,
      filteredBatches,
      createDialogVisible,
      receiveDialogVisible,
      currentBatch,
      batchItems,
      selectedLinens,
      receivedItems,
      availableLinens,
      rooms,
      linenTypes,
      createFilterRoom,
      createFilterType,
      formatDate,
      openCreateDialog,
      handleSelectionChange,
      onFilterChange,
      createBatch,
      viewDetail,
      openReceiveDialog,
      handleReceiveSelectionChange,
      receiveBatch,
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
.filter-row {
  margin-bottom: 20px;
}
.mb-4 {
  margin-bottom: 16px;
}
.text-danger {
  color: #f56c6c;
}
</style>
