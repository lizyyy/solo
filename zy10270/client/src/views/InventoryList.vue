<template>
  <div class="inventory-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>库存预警</span>
          <el-button type="success" @click="exportData">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </template>

      <el-alert
        title="库存预警提示"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px"
      >
        当某房源的某类布草在库数量低于安全库存时，将显示为预警状态。
      </el-alert>

      <el-table :data="inventory" style="width: 100%" v-loading="loading">
        <el-table-column prop="room_name" label="房源名称" width="200" />
        <el-table-column prop="type" label="布草类型" width="120" />
        <el-table-column prop="count" label="在库数量" width="120" />
        <el-table-column prop="safe_stock" label="安全库存" width="120" />
        <el-table-column prop="is_low" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.is_low ? 'danger' : 'success'">
              {{ row.is_low ? '库存不足' : '库存充足' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="缺口数量" width="120">
          <template #default="{ row }">
            <span :style="{ color: row.is_low ? '#f56c6c' : '#67c23a' }">
              {{ row.is_low ? row.safe_stock - row.count : 0 }}
            </span>
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
  name: 'InventoryList',
  components: { Download },
  setup() {
    const loading = ref(false);
    const inventory = ref([]);

    const fetchInventory = async () => {
      loading.value = true;
      try {
        const res = await axios.get('/api/inventory');
        inventory.value = res.data;
      } catch (err) {
        ElMessage.error('获取库存失败');
      } finally {
        loading.value = false;
      }
    };

    const exportData = () => {
      const data = inventory.value.map(i => ({
        '房源名称': i.room_name || '',
        '布草类型': i.type || '',
        '在库数量': i.count,
        '安全库存': i.safe_stock,
        '状态': i.is_low ? '库存不足' : '库存充足',
        '缺口数量': i.is_low ? i.safe_stock - i.count : 0
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '库存预警');
      XLSX.writeFile(wb, '库存预警.xlsx');
    };

    onMounted(() => {
      fetchInventory();
    });

    return {
      loading,
      inventory,
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
