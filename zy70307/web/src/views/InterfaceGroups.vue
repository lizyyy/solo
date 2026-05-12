<template>
  <div>
    <div class="page-header">
      <h2>接口分组</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增分组
      </el-button>
    </div>

    <div class="page-card">
      <el-table :data="groups" v-loading="loading">
        <el-table-column prop="name" label="分组名称" width="200" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="interfaces" label="包含接口">
          <template #default="{ row }">
            <el-tag
              v-for="(iface, idx) in row.interfaces"
              :key="idx"
              size="small"
              style="margin: 2px;"
            >
              {{ iface }}
            </el-tag>
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
      width="600px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="分组名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分组名称" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="请输入分组描述"
          />
        </el-form-item>
        <el-form-item label="接口列表" prop="interfaces">
          <div style="margin-bottom: 8px;">
            <el-input
              v-model="newInterface"
              placeholder="输入接口路径，如 /api/order/create"
              style="width: 300px; margin-right: 8px;"
              @keyup.enter="addInterface"
            />
            <el-button @click="addInterface">添加</el-button>
          </div>
          <div style="min-height: 100px; border: 1px dashed #d9d9d9; padding: 12px; border-radius: 4px;">
            <el-tag
              v-for="(iface, idx) in form.interfaces"
              :key="idx"
              closable
              style="margin: 4px;"
              @close="removeInterface(idx)"
            >
              {{ iface }}
            </el-tag>
            <span v-if="form.interfaces.length === 0" style="color: #c0c4cc;">
              暂无接口，请添加
            </span>
          </div>
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
import { interfaceGroupsApi } from '../api';

const loading = ref(false);
const groups = ref([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增分组');
const formRef = ref(null);
const editingId = ref(null);
const newInterface = ref('');

const form = reactive({
  name: '',
  description: '',
  interfaces: [],
});

const rules = {
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入分组描述', trigger: 'blur' }],
};

async function loadData() {
  loading.value = true;
  try {
    const res = await interfaceGroupsApi.list();
    groups.value = res.data || [];
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
}

function addInterface() {
  if (!newInterface.value.trim()) return;
  if (form.interfaces.includes(newInterface.value.trim())) {
    ElMessage.warning('该接口已存在');
    return;
  }
  form.interfaces.push(newInterface.value.trim());
  newInterface.value = '';
}

function removeInterface(index) {
  form.interfaces.splice(index, 1);
}

function handleAdd() {
  editingId.value = null;
  dialogTitle.value = '新增分组';
  Object.assign(form, {
    name: '',
    description: '',
    interfaces: [],
  });
  dialogVisible.value = true;
}

function handleEdit(row) {
  editingId.value = row.id;
  dialogTitle.value = '编辑分组';
  Object.assign(form, {
    name: row.name,
    description: row.description,
    interfaces: [...row.interfaces],
  });
  dialogVisible.value = true;
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定要删除分组 "${row.name}" 吗？`, '提示', {
    type: 'warning',
  })
    .then(async () => {
      try {
        await interfaceGroupsApi.delete(row.id);
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
      await interfaceGroupsApi.update(editingId.value, form);
      ElMessage.success('更新成功');
    } else {
      await interfaceGroupsApi.create(form);
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
