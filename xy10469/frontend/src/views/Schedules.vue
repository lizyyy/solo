<template>
  <div class="schedules-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="display: flex; gap: 16px; align-items: center">
            <el-select v-model="filters.status" placeholder="档期状态" style="width: 120px" clearable @change="loadData">
              <el-option label="规划中" value="planning" />
              <el-option label="进行中" value="active" />
              <el-option label="已结束" value="completed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-button @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新增档期
          </el-button>
        </div>
      </template>
      
      <el-table :data="schedules" v-loading="loading" stripe>
        <el-table-column prop="name" label="档期名称" min-width="200" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="时间" width="260">
          <template #default="{ row }">
            {{ formatDate(row.startDate) }} 至 {{ formatDate(row.endDate) }}
          </template>
        </el-table-column>
        <el-table-column label="摊位类型" width="200">
          <template #default="{ row }">
            <el-tag v-for="type in row.boothTypes" :key="type" class="mr-5" :type="getBoothTagType(type)" size="small">
              {{ boothTypeMap[type] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalSlots" label="总位数" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="档期名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入档期名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入档期描述" />
        </el-form-item>
        <el-form-item label="活动时间" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="摊位类型" prop="boothTypes">
              <el-select v-model="form.boothTypes" multiple placeholder="请选择摊位类型" style="width: 100%">
                <el-option 
                  v-for="option in boothTypeOptions" 
                  :key="option.value" 
                  :label="option.label" 
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="总位数" prop="totalSlots">
              <el-input-number v-model="form.totalSlots" :min="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="目标商户">
          <el-input v-model="form.targetMerchants" placeholder="请输入目标商户类型" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="规划中" value="planning" />
            <el-option label="进行中" value="active" />
            <el-option label="已结束" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { scheduleApi } from '@/api';
import { formatDate, boothTypeMap, boothTypeOptions } from '@/utils/format';

const loading = ref(false);
const schedules = ref([]);
const dialogVisible = ref(false);
const formRef = ref(null);
const isEdit = ref(false);

const filters = reactive({
  status: ''
});

const form = reactive({
  _id: '',
  name: '',
  description: '',
  dateRange: [],
  startDate: '',
  endDate: '',
  boothTypes: [],
  totalSlots: 10,
  targetMerchants: '',
  status: 'planning',
  notes: ''
});

const rules = {
  name: [{ required: true, message: '请输入档期名称', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择活动时间', trigger: 'change' }],
  boothTypes: [{ required: true, message: '请选择摊位类型', trigger: 'change' }],
  totalSlots: [{ required: true, message: '请输入总位数', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
};

const dialogTitle = ref('新增档期');

const getBoothTagType = (type) => {
  const map = { food: 'danger', cultural: 'success', promotion: 'primary' };
  return map[type] || 'info';
};

const getStatusTagType = (status) => {
  const map = { planning: 'warning', active: 'success', completed: 'info', cancelled: 'danger' };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = { planning: '规划中', active: '进行中', completed: '已结束', cancelled: '已取消' };
  return map[status] || status;
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await scheduleApi.getAll(filters);
    schedules.value = res.data;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const openDialog = (row = null) => {
  isEdit.value = !!row;
  dialogTitle.value = row ? '编辑档期' : '新增档期';
  
  if (row) {
    Object.assign(form, row);
    form.dateRange = [row.startDate, row.endDate];
  } else {
    Object.assign(form, {
      _id: '',
      name: '',
      description: '',
      dateRange: [],
      startDate: '',
      endDate: '',
      boothTypes: [],
      totalSlots: 10,
      targetMerchants: '',
      status: 'planning',
      notes: ''
    });
  }
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    const submitData = { ...form };
    if (form.dateRange && form.dateRange.length === 2) {
      submitData.startDate = form.dateRange[0];
      submitData.endDate = form.dateRange[1];
    }
    
    if (isEdit.value) {
      await scheduleApi.update(form._id, submitData);
      ElMessage.success('更新成功');
    } else {
      await scheduleApi.create(submitData);
      ElMessage.success('创建成功');
    }
    
    dialogVisible.value = false;
    loadData();
  } catch (error) {
    if (error !== 'validate') {
      console.error('保存失败:', error);
    }
  }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除档期 ${row.name} 吗？`, '提示', {
      type: 'warning'
    });
    
    await scheduleApi.delete(row._id);
    ElMessage.success('删除成功');
    loadData();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
    }
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.schedules-page {
  height: 100%;
}
.mr-5 {
  margin-right: 5px;
}
</style>