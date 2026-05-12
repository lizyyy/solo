<template>
  <div>
    <div class="page-header">
      <h2>租户管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增租户
      </el-button>
    </div>

    <div class="page-card">
      <el-table :data="tenants" v-loading="loading">
        <el-table-column prop="name" label="租户名称" />
        <el-table-column prop="level" label="租户等级">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)" size="small">
              {{ getLevelLabel(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="vipExempt" label="VIP豁免" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.vipExempt" type="success" size="small">开启</el-tag>
            <el-tag v-else type="info" size="small">关闭</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="200">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="租户名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入租户名称" />
        </el-form-item>
        <el-form-item label="租户等级" prop="level">
          <el-select v-model="form.level" placeholder="请选择租户等级" style="width: 100%;">
            <el-option label="黄金VIP" value="VIP_GOLD" />
            <el-option label="白银VIP" value="VIP_SILVER" />
            <el-option label="普通租户" value="NORMAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="VIP豁免" prop="vipExempt">
          <el-switch v-model="form.vipExempt" />
          <span style="margin-left: 8px; color: #909399; font-size: 12px;">
            开启后该租户将不受VIP豁免规则的限制
          </span>
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
import dayjs from 'dayjs';
import { tenantsApi } from '../api';

const loading = ref(false);
const tenants = ref([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增租户');
const formRef = ref(null);
const editingId = ref(null);

const form = reactive({
  name: '',
  level: 'NORMAL',
  vipExempt: false,
});

const rules = {
  name: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
  level: [{ required: true, message: '请选择租户等级', trigger: 'change' }],
};

function getLevelLabel(level) {
  const map = {
    VIP_GOLD: '黄金VIP',
    VIP_SILVER: '白银VIP',
    NORMAL: '普通租户',
  };
  return map[level] || level;
}

function getLevelTagType(level) {
  const map = {
    VIP_GOLD: 'warning',
    VIP_SILVER: 'primary',
    NORMAL: 'info',
  };
  return map[level] || 'info';
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
}

async function loadData() {
  loading.value = true;
  try {
    const res = await tenantsApi.list();
    tenants.value = res.data || [];
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
}

function handleAdd() {
  editingId.value = null;
  dialogTitle.value = '新增租户';
  Object.assign(form, {
    name: '',
    level: 'NORMAL',
    vipExempt: false,
  });
  dialogVisible.value = true;
}

function handleEdit(row) {
  editingId.value = row.id;
  dialogTitle.value = '编辑租户';
  Object.assign(form, {
    name: row.name,
    level: row.level,
    vipExempt: row.vipExempt,
  });
  dialogVisible.value = true;
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定要删除租户 "${row.name}" 吗？`, '提示', {
    type: 'warning',
  })
    .then(async () => {
      try {
        await tenantsApi.delete(row.id);
        ElMessage.success('删除成功');
        loadData();
      } catch (err) {
        ElMessage.error(err.message);
      }
    })
    .catch(() => {});
}

async function handleSubmit() {
  try {
    await formRef.value.validate();
    
    if (editingId.value) {
      await tenantsApi.update(editingId.value, form);
      ElMessage.success('更新成功');
    } else {
      await tenantsApi.create(form);
      ElMessage.success('创建成功');
    }
    
    dialogVisible.value = false;
    loadData();
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message);
    }
  }
}

onMounted(() => {
  loadData();
});
</script>
