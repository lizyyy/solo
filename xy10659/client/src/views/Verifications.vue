<template>
  <div class="verifications">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>核销记录</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增核销
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="核销单号/车牌号" clearable />
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="searchForm.handler" placeholder="经办人" clearable />
        </el-form-item>
        <el-form-item label="仅显示异常">
          <el-checkbox v-model="has_exception" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border style="width: 100%">
        <el-table-column prop="verification_no" label="核销单号" width="150" />
        <el-table-column prop="plate_number" label="车牌号" width="100" />
        <el-table-column prop="vehicle_model" label="车型" width="120" />
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column prop="item_name" label="保养项目" />
        <el-table-column prop="mileage_at" label="核销日期" width="120" />
        <el-table-column prop="actual_mileage" label="实际里程" width="120" />
        <el-table-column prop="supplement_amount" label="补差金额" width="100" />
        <el-table-column prop="total_amount" label="总金额" width="100" />
        <el-table-column prop="handler" label="经办人" width="100" />
        <el-table-column prop="exception_reason" label="异常原因" width="150">
          <template #default="scope">
            <el-tag v-if="scope.row.exception_reason" type="danger" size="small">
              {{ scope.row.exception_reason }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
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

    <el-dialog v-model="dialogVisible" title="新增核销" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="选择订单">
          <el-select v-model="form.order_id" placeholder="请选择订单" style="width: 100%">
            <el-option
              v-for="order in orders"
              :key="order.id"
              :label="`${order.order_no} - ${order.plate_number}`"
              :value="order.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="选择车辆">
          <el-select v-model="form.vehicle_id" placeholder="请选择车辆" style="width: 100%">
            <el-option
              v-for="vehicle in vehicles"
              :key="vehicle.id"
              :label="`${vehicle.plate_number} - ${vehicle.vehicle_model}`"
              :value="vehicle.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="保养项目">
          <el-select v-model="form.item_id" placeholder="请选择项目" style="width: 100%">
            <el-option
              v-for="item in items"
              :key="item.id"
              :label="`${item.item_name} - ¥${item.price}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="实际里程">
          <el-input-number v-model="form.actual_mileage" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="form.handler" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const tableData = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const dialogVisible = ref(false);
const has_exception = ref(false);
const orders = ref([]);
const vehicles = ref([]);
const items = ref([]);

const searchForm = reactive({
  keyword: '',
  handler: ''
});

const form = reactive({
  order_id: null,
  vehicle_id: null,
  item_id: null,
  actual_mileage: 0,
  handler: '',
  remarks: ''
});

const fetchData = async () => {
  try {
    const res = await axios.get('/api/verifications', {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        has_exception: has_exception.value,
        ...searchForm
      }
    });
    tableData.value = res.data.data;
    total.value = res.data.total;
  } catch (err) {
    ElMessage.error('获取数据失败');
  }
};

const fetchOrders = async () => {
  try {
    const res = await axios.get('/api/orders', { params: { pageSize: 100 } });
    orders.value = res.data.data;
  } catch (err) {
    console.error(err);
  }
};

const fetchVehicles = async () => {
  try {
    const res = await axios.get('/api/vehicles', { params: { pageSize: 100 } });
    vehicles.value = res.data.data;
  } catch (err) {
    console.error(err);
  }
};

const fetchItems = async () => {
  try {
    const res = await axios.get('/api/items', { params: { pageSize: 100 } });
    items.value = res.data.data;
  } catch (err) {
    console.error(err);
  }
};

const resetSearch = () => {
  searchForm.keyword = '';
  searchForm.handler = '';
  has_exception.value = false;
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
  Object.keys(form).forEach(key => {
    if (typeof form[key] === 'number') {
      form[key] = 0;
    } else {
      form[key] = '';
    }
  });
  dialogVisible.value = true;
};

const handleSave = async () => {
  try {
    await axios.post('/api/verifications', form);
    ElMessage.success('核销成功');
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
      await axios.delete(`/api/verifications/${row.id}`);
      ElMessage.success('删除成功');
      fetchData();
    } catch (err) {
      ElMessage.error('删除失败');
    }
  });
};

onMounted(() => {
  fetchData();
  fetchOrders();
  fetchVehicles();
  fetchItems();
});
</script>

<style scoped>
.verifications {
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
