<template>
  <div class="linen-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>布草管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            添加布草
          </el-button>
        </div>
      </template>

      <el-row :gutter="20" class="filter-row">
        <el-col :span="6">
          <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 100%">
            <el-option label="在库" value="in_stock" />
            <el-option label="洗涤中" value="washing" />
            <el-option label="丢失" value="missing" />
            <el-option label="已赔付" value="claimed" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filterType" placeholder="类型筛选" clearable style="width: 100%">
            <el-option v-for="type in linenTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filterRoom" placeholder="房源筛选" clearable style="width: 100%">
            <el-option v-for="room in rooms" :key="room.id" :label="room.name" :value="room.id" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-button type="success" @click="exportData">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </el-col>
      </el-row>

      <el-table :data="filteredLinens" style="width: 100%" v-loading="loading">
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="barcode" label="条形码" width="150" />
        <el-table-column prop="room_name" label="所属房源" width="150" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="wash_count" label="洗涤次数" width="100" />
        <el-table-column prop="price" label="价格" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'claimed'"
              link
              type="success"
              @click="restoreLinen(row)"
            >
              恢复入库
            </el-button>
            <el-button link type="danger" @click="deleteLinen(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑布草' : '添加布草'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="类型" required>
          <el-select v-model="form.type" placeholder="请选择类型" style="width: 100%">
            <el-option v-for="type in linenTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-form-item>
        <el-form-item label="条形码">
          <el-input v-model="form.barcode" placeholder="请输入条形码" />
        </el-form-item>
        <el-form-item label="所属房源">
          <el-select v-model="form.room_id" placeholder="请选择房源" clearable style="width: 100%">
            <el-option v-for="room in rooms" :key="room.id" :label="room.name" :value="room.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="form.price" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download } from '@element-plus/icons-vue';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default {
  name: 'LinenList',
  components: { Plus, Download },
  setup() {
    const loading = ref(false);
    const linens = ref([]);
    const rooms = ref([]);
    const linenTypes = ref([]);
    const filterStatus = ref('');
    const filterType = ref('');
    const filterRoom = ref('');
    const dialogVisible = ref(false);
    const isEdit = ref(false);
    const currentId = ref('');
    const form = ref({
      type: '',
      barcode: '',
      room_id: '',
      price: 0
    });

    const filteredLinens = computed(() => {
      let result = linens.value;
      if (filterStatus.value) {
        result = result.filter(l => l.status === filterStatus.value);
      }
      if (filterType.value) {
        result = result.filter(l => l.type === filterType.value);
      }
      if (filterRoom.value) {
        result = result.filter(l => l.room_id === filterRoom.value);
      }
      return result;
    });

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleString('zh-CN');
    };

    const getStatusType = (status) => {
      const map = {
        in_stock: 'success',
        washing: 'warning',
        missing: 'danger',
        claimed: 'info'
      };
      return map[status] || 'info';
    };

    const getStatusText = (status) => {
      const map = {
        in_stock: '在库',
        washing: '洗涤中',
        missing: '丢失',
        claimed: '已赔付'
      };
      return map[status] || status;
    };

    const fetchLinens = async () => {
      loading.value = true;
      try {
        const res = await axios.get('/api/linens');
        linens.value = res.data;
      } catch (err) {
        ElMessage.error('获取布草失败');
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

    const openCreateDialog = () => {
      isEdit.value = false;
      form.value = { type: '', barcode: '', room_id: '', price: 0 };
      dialogVisible.value = true;
    };

    const openEditDialog = (row) => {
      isEdit.value = true;
      currentId.value = row.id;
      form.value = {
        type: row.type,
        barcode: row.barcode || '',
        room_id: row.room_id || '',
        price: row.price || 0
      };
      dialogVisible.value = true;
    };

    const submitForm = async () => {
      if (!form.value.type) {
        ElMessage.warning('请选择类型');
        return;
      }

      try {
        if (isEdit.value) {
          await axios.put(`/api/linens/${currentId.value}`, form.value);
          ElMessage.success('更新成功');
        } else {
          await axios.post('/api/linens', form.value);
          ElMessage.success('添加成功');
        }
        dialogVisible.value = false;
        fetchLinens();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '操作失败');
      }
    };

    const deleteLinen = async (row) => {
      try {
        await ElMessageBox.confirm('确定要删除该布草吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        });
        await axios.delete(`/api/linens/${row.id}`);
        ElMessage.success('删除成功');
        fetchLinens();
      } catch {
      }
    };

    const restoreLinen = async (row) => {
      try {
        await ElMessageBox.confirm('确定要恢复该布草入库吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        });
        await axios.post(`/api/linens/${row.id}/restore`);
        ElMessage.success('恢复成功');
        fetchLinens();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '恢复失败');
      }
    };

    const exportData = () => {
      const data = filteredLinens.value.map(l => ({
        '类型': l.type,
        '条形码': l.barcode || '',
        '所属房源': l.room_name || '',
        '状态': getStatusText(l.status),
        '洗涤次数': l.wash_count,
        '价格': l.price,
        '创建时间': formatDate(l.created_at)
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '布草清单');
      XLSX.writeFile(wb, '布草清单.xlsx');
    };

    onMounted(() => {
      fetchLinens();
      fetchRooms();
      fetchLinenTypes();
    });

    return {
      loading,
      linens,
      rooms,
      linenTypes,
      filterStatus,
      filterType,
      filterRoom,
      filteredLinens,
      dialogVisible,
      isEdit,
      form,
      formatDate,
      getStatusType,
      getStatusText,
      openCreateDialog,
      openEditDialog,
      submitForm,
      deleteLinen,
      restoreLinen,
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
</style>
