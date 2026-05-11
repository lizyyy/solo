<template>
  <div>
    <h2 class="page-title">配送批次管理</h2>

    <el-card class="card-section">
      <el-form :inline="true" :model="filters" class="mb-10">
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="filters.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择开始日期"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="filters.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择结束日期"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 150px;">
            <el-option label="待处理" value="pending" />
            <el-option label="配送中" value="in_progress" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadBatches">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="card-section">
      <template #header>
        <div class="flex-between">
          <span>批次列表</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建批次
          </el-button>
        </div>
      </template>

      <el-table :data="batches" v-loading="loading" stripe>
        <el-table-column prop="batch_no" label="批次号" width="200">
          <template #default="{ row }">
            <span class="batch-no">{{ row.batch_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="配送日期" width="120" />
        <el-table-column prop="meal_type" label="餐食类型" width="100">
          <template #default="{ row }">
            <el-tag>{{ row.meal_type === 'breakfast' ? '早餐' : row.meal_type === 'lunch' ? '午餐' : '晚餐' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配送情况" width="180">
          <template #default="{ row }">
            总数: {{ row.total_meals }}<br/>
            送达: {{ row.delivered_meals }} | 退回: {{ row.returned_meals }}
          </template>
        </el-table-column>
        <el-table-column prop="distributor" label="配送员" width="100" />
        <el-table-column prop="vehicle_no" label="车牌号" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewDetail(row)">详情</el-button>
            <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
            <el-button
              v-if="row.status !== 'completed'"
              type="success"
              size="small"
              link
              @click="completeBatch(row)"
            >
              完成
            </el-button>
            <el-button type="danger" size="small" link @click="deleteBatch(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑批次' : '新建批次'"
      width="600px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="批次号" prop="batch_no">
          <el-input v-model="form.batch_no" placeholder="如: BATCH-20240101-001" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="配送日期" prop="delivery_date">
          <el-date-picker
            v-model="form.delivery_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择配送日期"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="餐食类型" prop="meal_type">
          <el-select v-model="form.meal_type" placeholder="选择餐食类型" style="width: 100%;">
            <el-option label="早餐" value="breakfast" />
            <el-option label="午餐" value="lunch" />
            <el-option label="晚餐" value="dinner" />
          </el-select>
        </el-form-item>
        <el-form-item label="总份数" prop="total_meals">
          <el-input-number v-model="form.total_meals" :min="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="配送员">
          <el-input v-model="form.distributor" placeholder="配送员姓名" />
        </el-form-item>
        <el-form-item label="车牌号">
          <el-input v-model="form.vehicle_no" placeholder="配送车辆牌号" />
        </el-form-item>
        <el-form-item label="出发时间">
          <el-date-picker
            v-model="form.departure_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择出发时间"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { batchAPI } from '@/api';

const router = useRouter();
const loading = ref(false);
const batches = ref([]);
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref(null);

const filters = reactive({
  startDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD'),
  status: ''
});

const form = reactive({
  id: '',
  batch_no: '',
  delivery_date: '',
  meal_type: '',
  total_meals: 0,
  distributor: '',
  vehicle_no: '',
  departure_time: ''
});

const rules = {
  batch_no: [{ required: true, message: '请输入批次号', trigger: 'blur' }],
  delivery_date: [{ required: true, message: '请选择配送日期', trigger: 'change' }],
  meal_type: [{ required: true, message: '请选择餐食类型', trigger: 'change' }],
  total_meals: [{ required: true, message: '请输入总份数', trigger: 'blur' }]
};

const getStatusType = (status) => {
  const types = {
    pending: 'info',
    in_progress: 'warning',
    completed: 'success'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    pending: '待处理',
    in_progress: '配送中',
    completed: '已完成'
  };
  return texts[status] || status;
};

const loadBatches = async () => {
  loading.value = true;
  try {
    const res = await batchAPI.list(filters);
    batches.value = res.data;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.startDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
  filters.endDate = dayjs().format('YYYY-MM-DD');
  filters.status = '';
  loadBatches();
};

const openCreateDialog = () => {
  isEdit.value = false;
  Object.assign(form, {
    id: '',
    batch_no: `BATCH-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    delivery_date: dayjs().format('YYYY-MM-DD'),
    meal_type: 'lunch',
    total_meals: 10,
    distributor: '',
    vehicle_no: '',
    departure_time: ''
  });
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  dialogVisible.value = true;
};

const viewDetail = (row) => {
  router.push(`/batches/${row.id}`);
};

const submitForm = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate();
  
  try {
    if (isEdit.value) {
      await batchAPI.update(form.id, form);
      ElMessage.success('批次更新成功');
    } else {
      await batchAPI.create(form);
      ElMessage.success('批次创建成功');
    }
    dialogVisible.value = false;
    loadBatches();
  } catch (err) {
    // 错误已在API拦截器中处理
  }
};

const completeBatch = async (row) => {
  try {
    await ElMessageBox.confirm('确定要完成此批次吗？完成后系统将自动计算补偿和安全事件。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    const res = await batchAPI.complete(row.id);
    ElMessage.success(`批次完成! 已生成${res.data.compensations_created}条补偿记录，${res.data.incidents_created}条安全事件`);
    loadBatches();
  } catch {
    // 用户取消
  }
};

const deleteBatch = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除此批次吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await batchAPI.delete(row.id);
    ElMessage.success('批次删除成功');
    loadBatches();
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  loadBatches();
});
</script>
