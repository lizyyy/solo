<template>
  <div class="merchants-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="display: flex; gap: 16px; align-items: center">
            <el-input 
              v-model="filters.keyword" 
              placeholder="搜索商户名称/联系人/电话" 
              style="width: 280px"
              clearable
              @clear="loadData"
            />
            <el-select v-model="filters.status" placeholder="商户状态" style="width: 120px" clearable @change="loadData">
              <el-option label="正常" value="active" />
              <el-option label="暂停" value="suspended" />
              <el-option label="黑名单" value="blacklisted" />
            </el-select>
            <el-button @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </div>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新增商户
          </el-button>
        </div>
      </template>
      
      <el-table :data="merchants" v-loading="loading" stripe>
        <el-table-column prop="name" label="商户名称" min-width="180" />
        <el-table-column prop="contactPerson" label="联系人" width="100" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column prop="businessType" label="经营类型" width="120" />
        <el-table-column prop="licenseNumber" label="营业执照号" width="150" />
        <el-table-column prop="creditScore" label="信用分" width="100">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.creditScore" 
              :color="getCreditColor(row.creditScore)"
              :stroke-width="10"
              :show-text="true"
            />
          </template>
        </el-table-column>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商户名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入商户名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人" prop="contactPerson">
              <el-input v-model="form.contactPerson" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="form.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经营类型" prop="businessType">
              <el-input v-model="form.businessType" placeholder="请输入经营类型" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="营业执照号" prop="licenseNumber">
              <el-input v-model="form.licenseNumber" placeholder="请输入营业执照号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入经营地址" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="信用分">
              <el-input-number v-model="form.creditScore" :min="0" :max="100" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="正常" value="active" />
                <el-option label="暂停" value="suspended" />
                <el-option label="黑名单" value="blacklisted" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
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
import { merchantApi } from '@/api';

const loading = ref(false);
const merchants = ref([]);
const dialogVisible = ref(false);
const formRef = ref(null);
const isEdit = ref(false);

const filters = reactive({
  keyword: '',
  status: ''
});

const form = reactive({
  _id: '',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  businessType: '',
  licenseNumber: '',
  address: '',
  status: 'active',
  creditScore: 100,
  notes: ''
});

const rules = {
  name: [{ required: true, message: '请输入商户名称', trigger: 'blur' }],
  contactPerson: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  businessType: [{ required: true, message: '请输入经营类型', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
};

const dialogTitle = ref('新增商户');

const getStatusTagType = (status) => {
  const map = { active: 'success', suspended: 'warning', blacklisted: 'danger' };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = { active: '正常', suspended: '暂停', blacklisted: '黑名单' };
  return map[status] || status;
};

const getCreditColor = (score) => {
  if (score >= 90) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#f5222d';
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await merchantApi.getAll(filters);
    merchants.value = res.data;
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const openDialog = (row = null) => {
  isEdit.value = !!row;
  dialogTitle.value = row ? '编辑商户' : '新增商户';
  
  if (row) {
    Object.assign(form, row);
  } else {
    Object.assign(form, {
      _id: '',
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      businessType: '',
      licenseNumber: '',
      address: '',
      status: 'active',
      creditScore: 100,
      notes: ''
    });
  }
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    if (isEdit.value) {
      await merchantApi.update(form._id, form);
      ElMessage.success('更新成功');
    } else {
      await merchantApi.create(form);
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
    await ElMessageBox.confirm(`确定删除商户 ${row.name} 吗？`, '提示', {
      type: 'warning'
    });
    
    await merchantApi.delete(row._id);
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
.merchants-page {
  height: 100%;
}
</style>