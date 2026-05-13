<template>
  <div class="orders">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>套餐订单管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增订单
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="订单号/车牌号/客户" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="状态" clearable>
            <el-option label="激活" value="active" />
            <el-option label="已过期" value="expired" />
          </el-select>
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
        <el-table-column prop="order_no" label="订单号" width="150" />
        <el-table-column prop="plate_number" label="车牌号" width="100" />
        <el-table-column prop="customer_name" label="客户姓名" width="100" />
        <el-table-column prop="package_name" label="套餐名称" />
        <el-table-column prop="total_amount" label="总金额" width="100" />
        <el-table-column prop="purchase_date" label="购买日期" width="120" />
        <el-table-column prop="remaining_times" label="剩余次数" width="100" />
        <el-table-column prop="used_times" label="已用次数" width="100" />
        <el-table-column prop="responsible_person" label="负责人" width="100" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '激活' : '过期' }}
            </el-tag>
          </template>
        </el-table-column>
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

    <el-dialog v-model="dialogVisible" title="订单信息" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="订单号">
          <el-input v-model="form.order_no" />
        </el-form-item>
        <el-form-item label="车牌号">
          <el-input v-model="form.plate_number" />
        </el-form-item>
        <el-form-item label="客户姓名">
          <el-input v-model="form.customer_name" />
        </el-form-item>
        <el-form-item label="套餐名称">
          <el-input v-model="form.package_name" />
        </el-form-item>
        <el-form-item label="总金额">
          <el-input-number v-model="form.total_amount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="购买日期">
          <el-date-picker v-model="form.purchase_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="过期日期">
          <el-date-picker v-model="form.expire_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="剩余次数">
          <el-input-number v-model="form.remaining_times" :min="0" />
        </el-form-item>
        <el-form-item label="已用次数">
          <el-input-number v-model="form.used_times" :min="0" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.responsible_person" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="激活" value="active" />
            <el-option label="已过期" value="expired" />
          </el-select>
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
  status: '',
  responsible_person: ''
});

const form = reactive({
  order_no: '',
  plate_number: '',
  customer_name: '',
  package_name: '',
  total_amount: 0,
  purchase_date: '',
  expire_date: '',
  remaining_times: 0,
  used_times: 0,
  responsible_person: '',
  status: 'active'
});

const fetchData = async () => {
  try {
    const res = await axios.get('/api/orders', {
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
  searchForm.status = '';
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
    } else if (key === 'status') {
      form[key] = 'active';
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
    const res = await axios.get(`/api/orders/${row.id}/logs`);
    logs.value = res.data;
    logDialogVisible.value = true;
  } catch (err) {
    ElMessage.error('获取日志失败');
  }
};

const handleSave = async () => {
  try {
    if (isEdit.value) {
      await axios.put(`/api/orders/${currentId.value}`, { ...form, modified_by: '管理员' });
      ElMessage.success('编辑成功');
    } else {
      await axios.post('/api/orders', form);
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
      await axios.delete(`/api/orders/${row.id}`);
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
.orders {
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
