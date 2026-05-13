<template>
  <div class="reminders">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>下次保养提醒</span>
        </div>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="状态" clearable>
            <el-option label="待提醒" value="pending" />
            <el-option label="已提醒" value="reminded" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border style="width: 100%">
        <el-table-column prop="plate_number" label="车牌号" width="120" />
        <el-table-column prop="vehicle_model" label="车型" width="150" />
        <el-table-column prop="item_name" label="保养项目" />
        <el-table-column prop="reminder_mileage" label="提醒里程" width="120" />
        <el-table-column prop="reminder_date" label="提醒日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'pending' ? 'warning' : 'success'">
              {{ scope.row.status === 'pending' ? '待提醒' : '已提醒' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right" v-if="searchForm.status !== 'reminded'">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleMarkReminded(scope.row)">标记已提醒</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const tableData = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);

const searchForm = reactive({
  status: 'pending'
});

const fetchData = async () => {
  try {
    const res = await axios.get('/api/reminders', {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        status: searchForm.status
      }
    });
    tableData.value = res.data.data;
    total.value = res.data.total;
  } catch (err) {
    ElMessage.error('获取数据失败');
  }
};

const resetSearch = () => {
  searchForm.status = 'pending';
  fetchData();
};

const handleSizeChange = (val) => {
  pageSize.value = val;
  fetchData();
};

const handleCurrentChange = (val) => {
  currentPage.value = val;
  fetchData();
};

const handleMarkReminded = async (row) => {
  try {
    await axios.put(`/api/reminders/${row.id}/status`, { status: 'reminded' });
    ElMessage.success('标记成功');
    fetchData();
  } catch (err) {
    ElMessage.error('标记失败');
  }
};

fetchData();
</script>

<style scoped>
.reminders {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-form {
  margin-bottom: 20px;
}
.el-pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
