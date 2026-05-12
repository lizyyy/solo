<template>
  <div class="room-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>房源管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            添加房源
          </el-button>
        </div>
      </template>

      <el-table :data="rooms" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="房源名称" width="200" />
        <el-table-column prop="building" label="楼栋" width="150" />
        <el-table-column prop="floor" label="楼层" width="100" />
        <el-table-column prop="safe_stock" label="安全库存" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteRoom(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑房源' : '添加房源'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="房源名称" required>
          <el-input v-model="form.name" placeholder="请输入房源名称" />
        </el-form-item>
        <el-form-item label="楼栋">
          <el-input v-model="form.building" placeholder="请输入楼栋" />
        </el-form-item>
        <el-form-item label="楼层">
          <el-input-number v-model="form.floor" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="安全库存">
          <el-input-number v-model="form.safe_stock" :min="1" style="width: 100%" />
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
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import axios from 'axios';

export default {
  name: 'RoomList',
  components: { Plus },
  setup() {
    const loading = ref(false);
    const rooms = ref([]);
    const dialogVisible = ref(false);
    const isEdit = ref(false);
    const currentId = ref('');
    const form = ref({
      name: '',
      building: '',
      floor: 1,
      safe_stock: 5
    });

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleString('zh-CN');
    };

    const fetchRooms = async () => {
      loading.value = true;
      try {
        const res = await axios.get('/api/rooms');
        rooms.value = res.data;
      } catch (err) {
        ElMessage.error('获取房源失败');
      } finally {
        loading.value = false;
      }
    };

    const openCreateDialog = () => {
      isEdit.value = false;
      form.value = { name: '', building: '', floor: 1, safe_stock: 5 };
      dialogVisible.value = true;
    };

    const openEditDialog = (row) => {
      isEdit.value = true;
      currentId.value = row.id;
      form.value = {
        name: row.name,
        building: row.building || '',
        floor: row.floor || 1,
        safe_stock: row.safe_stock || 5
      };
      dialogVisible.value = true;
    };

    const submitForm = async () => {
      if (!form.value.name) {
        ElMessage.warning('请输入房源名称');
        return;
      }

      try {
        if (isEdit.value) {
          await axios.put(`/api/rooms/${currentId.value}`, form.value);
          ElMessage.success('更新成功');
        } else {
          await axios.post('/api/rooms', form.value);
          ElMessage.success('添加成功');
        }
        dialogVisible.value = false;
        fetchRooms();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '操作失败');
      }
    };

    const deleteRoom = async (row) => {
      try {
        await ElMessageBox.confirm('确定要删除该房源吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        });
        await axios.delete(`/api/rooms/${row.id}`);
        ElMessage.success('删除成功');
        fetchRooms();
      } catch {
      }
    };

    onMounted(() => {
      fetchRooms();
    });

    return {
      loading,
      rooms,
      dialogVisible,
      isEdit,
      form,
      formatDate,
      openCreateDialog,
      openEditDialog,
      submitForm,
      deleteRoom
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
