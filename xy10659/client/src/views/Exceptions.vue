<template>
  <div class="exceptions">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>异常看板</span>
        </div>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="状态" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="已解决" value="resolved" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常类型">
          <el-select v-model="searchForm.exception_type" placeholder="异常类型" clearable>
            <el-option label="超里程" value="mileage_over" />
            <el-option label="超期" value="date_over" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border style="width: 100%">
        <el-table-column prop="exception_no" label="异常单号" width="150" />
        <el-table-column prop="related_type" label="关联类型" width="100" />
        <el-table-column prop="exception_type" label="异常类型" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.exception_type === 'mileage_over' ? 'danger' : 'warning'">
              {{ scope.row.exception_type === 'mileage_over' ? '超里程' : '超期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="exception_reason" label="异常原因" />
        <el-table-column prop="handler" label="经办人" width="100" />
        <el-table-column prop="old_value" label="原值" width="100" />
        <el-table-column prop="new_value" label="新值" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'pending' ? 'warning' : 'success'">
              {{ scope.row.status === 'pending' ? '待处理' : '已解决' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="corrected_by" label="修正人" width="100" />
        <el-table-column prop="corrected_at" label="修正时间" width="180" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right" v-if="searchForm.status !== 'resolved'">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleResolve(scope.row)">处理</el-button>
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

    <el-dialog v-model="dialogVisible" title="处理异常" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="修正人">
          <el-input v-model="form.corrected_by" />
        </el-form-item>
        <el-form-item label="新值">
          <el-input v-model="form.new_value" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">确认处理</el-button>
      </template>
    </el-dialog>
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
const dialogVisible = ref(false);
const currentId = ref(null);

const searchForm = reactive({
  status: '',
  exception_type: ''
});

const form = reactive({
  corrected_by: '',
  new_value: ''
});

const fetchData = async () => {
  try {
    const res = await axios.get('/api/exceptions', {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        ...searchForm
      }
    });
    tableData.value = res.data.data;
    total.value = res.data.total;
  } catch (err) {
    ElMessage.error('获取数据失败');
  }
};

const resetSearch = () => {
  searchForm.status = '';
  searchForm.exception_type = '';
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

const handleResolve = (row) => {
  currentId.value = row.id;
  form.corrected_by = '';
  form.new_value = row.new_value || '';
  dialogVisible.value = true;
};

const handleSave = async () => {
  try {
    await axios.put(`/api/exceptions/${currentId.value}/resolve`, form);
    ElMessage.success('处理成功');
    dialogVisible.value = false;
    fetchData();
  } catch (err) {
    ElMessage.error('处理失败');
  }
};

fetchData();
</script>

<style scoped>
.exceptions {
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
