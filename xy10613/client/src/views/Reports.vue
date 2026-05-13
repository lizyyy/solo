<template>
  <div>
    <h2 style="margin-bottom: 20px">发布记录报表</h2>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters" label-width="80px">
        <el-form-item label="操作人">
          <el-select v-model="filters.operator" placeholder="请选择操作人" clearable>
            <el-option v-for="op in operators" :key="op" :label="op" :value="op" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filters.type" placeholder="请选择类型" clearable>
            <el-option label="首次发布" value="first_publish" />
            <el-option label="更新发布" value="update" />
            <el-option label="回滚" value="rollback" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="filters.startTime" type="date" placeholder="选择开始日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="filters.endTime" type="date" placeholder="选择结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRecords">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" @click="exportExcel">导出Excel</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <span style="font-weight: bold; font-size: 16px">发布记录列表</span>
      </template>
      
      <el-table :data="records" style="width: 100%" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="文章标题" min-width="200" />
        <el-table-column prop="publish_type" label="发布类型" width="120">
          <template #default="scope">
            <el-tag size="small">
              {{ scope.row.publish_type === 'first_publish' ? '首次发布' : scope.row.publish_type === 'update' ? '更新发布' : '回滚' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="before_value" label="变更前值" min-width="150" />
        <el-table-column prop="after_value" label="变更后值" min-width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ scope.row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="150" />
        <el-table-column prop="created_at" label="操作时间" width="180" />
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="loadRecords"
        @current-change="loadRecords"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const records = ref([]);
const operators = ref([]);
const filters = ref({
  operator: '',
  type: '',
  startTime: '',
  endTime: ''
});
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const loadOperators = async () => {
  try {
    const response = await axios.get('/api/reports/operators');
    if (response.data.success) {
      operators.value = response.data.data;
    }
  } catch (error) {
    console.error('加载操作人失败:', error);
  }
};

const loadRecords = async () => {
  try {
    const response = await axios.get('/api/reports/publishes', {
      params: {
        ...filters.value,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize
      }
    });
    if (response.data.success) {
      records.value = response.data.data;
      pagination.value.total = response.data.total;
    }
  } catch (error) {
    console.error('加载发布记录失败:', error);
  }
};

const resetFilters = () => {
  filters.value = {
    operator: '',
    type: '',
    startTime: '',
    endTime: ''
  };
  pagination.value.page = 1;
  loadRecords();
};

const exportExcel = async () => {
  try {
    const response = await axios.get('/api/reports/export', {
      params: filters.value,
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '发布记录报表.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    ElMessage.success('导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败');
  }
};

onMounted(() => {
  loadOperators();
  loadRecords();
});
</script>
