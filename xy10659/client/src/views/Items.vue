<template>
  <div class="items">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>保养项目管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增项目
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="项目编码/名称" clearable />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="searchForm.responsible_person" placeholder="负责人" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border style="width: 100%">
        <el-table-column prop="item_code" label="项目编码" width="120" />
        <el-table-column prop="item_name" label="项目名称" width="150" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="standard_mileage" label="标准里程" width="120" />
        <el-table-column prop="standard_days" label="标准天数" width="120" />
        <el-table-column prop="price" label="价格" width="100" />
        <el-table-column prop="responsible_person" label="负责人" width="100" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleViewLog(scope.row)">日志</el-button>
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" title="保养项目" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="项目编码">
          <el-input v-model="form.item_code" />
        </el-form-item>
        <el-form-item label="项目名称">
          <el-input v-model="form.item_name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
        <el-form-item label="标准里程">
          <el-input-number v-model="form.standard_mileage" :min="0" />
        </el-form-item>
        <el-form-item label="标准天数">
          <el-input-number v-model="form.standard_days" :min="0" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="form.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.responsible_person" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logDialogVisible" title="修改日志" width="700px">
      <el-table :data="logs" border style="width: 100%">
        <el-table-column prop="modified_by" label="操作人" width="100" />
        <el-table-column prop="old_value" label="原值">
          <template #default="scope">
            <pre style="white-space: pre-wrap; font-size: 12px">{{ scope.row.old_value }}</pre>
          </template>
        </el-table-column>
        <el-table-column prop="new_value" label="新值">
          <template #default="scope">
            <pre style="white-space: pre-wrap; font-size: 12px">{{ scope.row.new_value }}</pre>
          </template>
        </el-table-column>
        <el-table-column prop="modified_at" label="修改时间" width="180" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const tableData = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const dialogVisible = ref(false);
const logDialogVisible = ref(false);
const logs = ref([]);
const isEdit = ref(false);
const currentId = ref(null);

const searchForm = reactive({
  keyword: '',
  responsible_person: ''
});

const form = reactive({
  item_code: '',
  item_name: '',
  description: '',
  standard_mileage: 0,
  standard_days: 0,
  price: 0,
  responsible_person: ''
});

const fetchData = async () => {
  try {
    const res = await axios.get('/api/items', {
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
  searchForm.keyword = '';
  searchForm.responsible_person = '';
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

const handleAdd = () => {
  isEdit.value = false;
  currentId.value = null;
  Object.keys(form).forEach(key => {
    if (typeof form[key] === 'number') {
      form[key] = 0;
    } else {
      form[key] = '';
    }
  });
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  currentId.value = row.id;
  Object.assign(form, row);
  dialogVisible.value = true;
};

const handleViewLog = async (row) => {
  try {
    const res = await axios.get(`/api/items/${row.id}/logs`);
    logs.value = res.data;
    logDialogVisible.value = true;
  } catch (err) {
    ElMessage.error('获取日志失败');
  }
};

const handleSave = async () => {
  try {
    if (isEdit.value) {
      await axios.put(`/api/items/${currentId.value}`, { ...form, modified_by: '管理员' });
      ElMessage.success('编辑成功');
    } else {
      await axios.post('/api/items', form);
      ElMessage.success('新增成功');
    }
    dialogVisible.value = false;
    fetchData();
  } catch (err) {
    ElMessage.error('保存失败');
  }
};

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await axios.delete(`/api/items/${row.id}`);
      ElMessage.success('删除成功');
      fetchData();
    } catch (err) {
      ElMessage.error('删除失败');
    }
  });
};

fetchData();
</script>

<style scoped>
.items {
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
