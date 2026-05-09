<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">门店管理</h2>
      <el-button
        v-if="userStore.isAdmin"
        type="primary"
        @click="openFormDialog(null)"
      >
        <el-icon><Plus /></el-icon>
        新增门店
      </el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索门店编码/名称/负责人"
        style="width: 280px"
        clearable
        @keyup.enter="loadData"
      />

      <el-select
        v-model="filters.isActive"
        placeholder="状态"
        style="width: 120px"
        clearable
      >
        <el-option label="启用" :value="true" />
        <el-option label="禁用" :value="false" />
      </el-select>

      <el-button type="primary" @click="loadData">
        <el-icon><Search /></el-icon>
        查询
      </el-button>

      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="stores" v-loading="loading" stripe>
      <el-table-column prop="code" label="门店编码" width="120" />
      <el-table-column prop="name" label="门店名称" width="200" />
      <el-table-column prop="manager" label="负责人" width="120">
        <template #default="{ row }">
          {{ row.manager || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="联系电话" width="140">
        <template #default="{ row }">
          {{ row.phone || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="address" label="地址" min-width="250">
        <template #default="{ row }">
          {{ row.address || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.isActive" type="success">启用</el-tag>
          <el-tag v-else type="info">禁用</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="userStore.isManager"
            type="primary"
            link
            size="small"
            @click="openFormDialog(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="userStore.isAdmin"
            type="warning"
            link
            size="small"
            @click="toggleActive(row)"
          >
            {{ row.isActive ? '禁用' : '启用' }}
          </el-button>
          <el-button
            v-if="userStore.isAdmin"
            type="danger"
            link
            size="small"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="flex-between mt-20">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </div>

    <el-dialog
      v-model="formDialogVisible"
      :title="formData.id ? '编辑门店' : '新增门店'"
      width="500px"
      class="form-dialog"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="门店编码" required>
          <el-input
            v-model="formData.code"
            placeholder="请输入门店编码"
            :disabled="!!formData.id"
          />
        </el-form-item>

        <el-form-item label="门店名称" required>
          <el-input v-model="formData.name" placeholder="请输入门店名称" />
        </el-form-item>

        <el-form-item label="负责人">
          <el-input v-model="formData.manager" placeholder="请输入负责人" />
        </el-form-item>

        <el-form-item label="联系电话">
          <el-input v-model="formData.phone" placeholder="请输入联系电话" />
        </el-form-item>

        <el-form-item label="地址">
          <el-input
            v-model="formData.address"
            type="textarea"
            :rows="2"
            placeholder="请输入地址"
          />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="2"
            placeholder="请输入描述"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { storeApi } from '@/api';
import { formatDate } from '@/utils/format';

const appStore = useAppStore();
const userStore = useUserStore();

const loading = ref(false);
const submitting = ref(false);
const stores = ref<any[]>([]);

const filters = reactive({
  keyword: '',
  isActive: undefined as boolean | undefined,
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const formDialogVisible = ref(false);

const formData = reactive({
  id: '',
  code: '',
  name: '',
  manager: '',
  phone: '',
  address: '',
  description: '',
});

const loadData = async () => {
  loading.value = true;
  try {
    const res = await storeApi.list({
      keyword: filters.keyword || undefined,
      isActive: filters.isActive,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });

    const data = res.data as any;
    stores.value = data?.stores || [];
    pagination.total = data?.total || 0;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.keyword = '';
  filters.isActive = undefined;
  pagination.page = 1;
  loadData();
};

const openFormDialog = (row: any) => {
  if (row) {
    Object.assign(formData, {
      id: row.id,
      code: row.code,
      name: row.name,
      manager: row.manager || '',
      phone: row.phone || '',
      address: row.address || '',
      description: row.description || '',
    });
  } else {
    Object.assign(formData, {
      id: '',
      code: '',
      name: '',
      manager: '',
      phone: '',
      address: '',
      description: '',
    });
  }
  formDialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formData.code) {
    ElMessage.warning('请输入门店编码');
    return;
  }
  if (!formData.name) {
    ElMessage.warning('请输入门店名称');
    return;
  }

  submitting.value = true;
  try {
    if (formData.id) {
      await storeApi.update(formData.id, {
        name: formData.name,
        manager: formData.manager || null,
        phone: formData.phone || null,
        address: formData.address || null,
        description: formData.description || null,
      });
      ElMessage.success('更新成功');
    } else {
      await storeApi.create({
        code: formData.code,
        name: formData.name,
        manager: formData.manager || null,
        phone: formData.phone || null,
        address: formData.address || null,
        description: formData.description || null,
      });
      ElMessage.success('创建成功');
    }

    formDialogVisible.value = false;
    appStore.loadStores();
    loadData();
  } finally {
    submitting.value = false;
  }
};

const toggleActive = async (row: any) => {
  try {
    await storeApi.toggle(row.id);
    ElMessage.success(row.isActive ? '已禁用' : '已启用');
    appStore.loadStores();
    loadData();
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败');
  }
};

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认删除门店 ${row.name}？删除后不可恢复。`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  try {
    await storeApi.delete(row.id);
    ElMessage.success('删除成功');
    appStore.loadStores();
    loadData();
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败');
  }
};

onMounted(() => {
  appStore.init();
  loadData();
});
</script>
