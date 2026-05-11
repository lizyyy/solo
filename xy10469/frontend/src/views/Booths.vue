<template>
  <div class="booths-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="display: flex; gap: 16px; align-items: center">
            <el-input 
              v-model="filters.keyword" 
              placeholder="搜索摊位编号/名称" 
              style="width: 200px"
              clearable
              @clear="loadData"
            />
            <el-select v-model="filters.type" placeholder="摊位类型" style="width: 150px" clearable @change="loadData">
              <el-option 
                v-for="option in boothTypeOptions" 
                :key="option.value" 
                :label="option.label" 
                :value="option.value"
              />
            </el-select>
            <el-select v-model="filters.status" placeholder="状态" style="width: 120px" clearable @change="loadData">
              <el-option label="可用" value="available" />
              <el-option label="已占用" value="occupied" />
              <el-option label="维护中" value="maintenance" />
              <el-option label="已停用" value="disabled" />
            </el-select>
            <el-button @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新增摊位
          </el-button>
        </div>
      </template>
      
      <el-table :data="booths" v-loading="loading" stripe>
        <el-table-column prop="code" label="摊位编号" width="120" />
        <el-table-column prop="name" label="摊位名称" min-width="180" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getBoothTagType(row.type)">{{ boothTypeMap[row.type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="位置" min-width="150" />
        <el-table-column prop="area" label="面积(㎡)" width="100" />
        <el-table-column prop="standardElectricity" label="标准用电(kW)" width="120" />
        <el-table-column prop="standardRental" label="日租金(元)" width="110">
          <template #default="{ row }">{{ formatCurrency(row.standardRental) }}</template>
        </el-table-column>
        <el-table-column prop="standardDeposit" label="押金(元)" width="110">
          <template #default="{ row }">{{ formatCurrency(row.standardDeposit) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="摊位编号" prop="code">
              <el-input v-model="form.code" placeholder="请输入摊位编号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="摊位类型" prop="type">
              <el-select v-model="form.type" placeholder="请选择类型" style="width: 100%">
                <el-option 
                  v-for="option in boothTypeOptions" 
                  :key="option.value" 
                  :label="option.label" 
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="摊位名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入摊位名称" />
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="form.location" placeholder="请输入摊位位置" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="面积(㎡)" prop="area">
              <el-input-number v-model="form.area" :min="1" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="标准用电" prop="standardElectricity">
              <el-input-number v-model="form.standardElectricity" :min="0" :precision="1" style="width: 100%">
                <template #suffix>kW</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="可用" value="available" />
                <el-option label="维护中" value="maintenance" />
                <el-option label="已停用" value="disabled" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="日租金" prop="standardRental">
              <el-input-number v-model="form.standardRental" :min="0" :precision="2" style="width: 100%">
                <template #prefix>¥</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金" prop="standardDeposit">
              <el-input-number v-model="form.standardDeposit" :min="0" :precision="2" style="width: 100%">
                <template #prefix>¥</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入摊位描述" />
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
import { boothApi } from '@/api';
import { formatCurrency, boothTypeMap, boothTypeOptions } from '@/utils/format';

const loading = ref(false);
const booths = ref([]);
const dialogVisible = ref(false);
const formRef = ref(null);
const isEdit = ref(false);

const filters = reactive({
  keyword: '',
  type: '',
  status: ''
});

const form = reactive({
  _id: '',
  code: '',
  name: '',
  type: '',
  location: '',
  area: 10,
  standardElectricity: 5,
  standardRental: 500,
  standardDeposit: 2000,
  status: 'available',
  description: ''
});

const rules = {
  code: [{ required: true, message: '请输入摊位编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入摊位名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择摊位类型', trigger: 'change' }],
  location: [{ required: true, message: '请输入摊位位置', trigger: 'blur' }],
  area: [{ required: true, message: '请输入面积', trigger: 'blur' }],
  standardRental: [{ required: true, message: '请输入日租金', trigger: 'blur' }],
  standardDeposit: [{ required: true, message: '请输入押金', trigger: 'blur' }]
};

const dialogTitle = ref('新增摊位');

const getBoothTagType = (type) => {
  const map = { food: 'danger', cultural: 'success', promotion: 'primary' };
  return map[type] || 'info';
};

const getStatusTagType = (status) => {
  const map = { available: 'success', occupied: 'danger', maintenance: 'warning', disabled: 'info' };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = { available: '可用', occupied: '已占用', maintenance: '维护中', disabled: '已停用' };
  return map[status] || status;
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await boothApi.getAll(filters);
    booths.value = res.data;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const openDialog = (row = null) => {
  isEdit.value = !!row;
  dialogTitle.value = row ? '编辑摊位' : '新增摊位';
  
  if (row) {
    Object.assign(form, row);
  } else {
    Object.assign(form, {
      _id: '',
      code: '',
      name: '',
      type: '',
      location: '',
      area: 10,
      standardElectricity: 5,
      standardRental: 500,
      standardDeposit: 2000,
      status: 'available',
      description: ''
    });
  }
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    if (isEdit.value) {
      await boothApi.update(form._id, form);
      ElMessage.success('更新成功');
    } else {
      await boothApi.create(form);
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
    await ElMessageBox.confirm(`确定删除摊位 ${row.name} 吗？`, '提示', {
      type: 'warning'
    });
    
    await boothApi.delete(row._id);
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
.booths-page {
  height: 100%;
}
</style>