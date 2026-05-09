<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">商品管理</h2>
      <el-button
        v-if="userStore.isManager"
        type="primary"
        @click="openFormDialog(null)"
      >
        <el-icon><Plus /></el-icon>
        新增商品
      </el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索商品名称/SKU/条码"
        style="width: 250px"
        clearable
        @keyup.enter="loadData"
      />

      <el-select
        v-model="filters.category"
        placeholder="选择分类"
        style="width: 180px"
        clearable
      >
        <el-option
          v-for="cat in appStore.categories"
          :key="cat"
          :label="cat"
          :value="cat"
        />
      </el-select>

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

    <el-table :data="products" v-loading="loading" stripe>
      <el-table-column prop="sku" label="SKU" width="120" />
      <el-table-column prop="name" label="商品名称" min-width="180" />
      <el-table-column prop="barcode" label="条码" width="150">
        <template #default="{ row }">
          {{ row.barcode || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="120">
        <template #default="{ row }">
          {{ row.category || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="unit" label="单位" width="80" />
      <el-table-column prop="spec" label="规格" width="120">
        <template #default="{ row }">
          {{ row.spec || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="basePrice" label="基准价" width="120">
        <template #default="{ row }">
          {{ formatCurrency(row.basePrice) }}
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
      :title="formData.id ? '编辑商品' : '新增商品'"
      width="600px"
      class="form-dialog"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="商品编码" required>
          <el-input
            v-model="formData.sku"
            placeholder="请输入商品编码(SKU)"
            :disabled="!!formData.id"
          />
        </el-form-item>

        <el-form-item label="商品名称" required>
          <el-input v-model="formData.name" placeholder="请输入商品名称" />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="条码">
              <el-input v-model="formData.barcode" placeholder="请输入条码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select
                v-model="formData.category"
                placeholder="请输入或选择分类"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option
                  v-for="cat in appStore.categories"
                  :key="cat"
                  :label="cat"
                  :value="cat"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="单位" required>
              <el-select v-model="formData.unit" placeholder="请选择单位" style="width: 100%">
                <el-option label="个" value="个" />
                <el-option label="件" value="件" />
                <el-option label="箱" value="箱" />
                <el-option label="盒" value="盒" />
                <el-option label="瓶" value="瓶" />
                <el-option label="袋" value="袋" />
                <el-option label="kg" value="kg" />
                <el-option label="g" value="g" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="基准价" required>
              <el-input-number
                v-model="formData.basePrice"
                :min="0.01"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="规格">
          <el-input v-model="formData.spec" placeholder="请输入规格" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入商品描述"
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
import { productApi } from '@/api';
import { formatDate, formatCurrency } from '@/utils/format';

const appStore = useAppStore();
const userStore = useUserStore();

const loading = ref(false);
const submitting = ref(false);
const products = ref<any[]>([]);

const filters = reactive({
  keyword: '',
  category: '',
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
  sku: '',
  name: '',
  barcode: '',
  category: '',
  unit: '个',
  basePrice: 0,
  spec: '',
  description: '',
});

const loadData = async () => {
  loading.value = true;
  try {
    const res = await productApi.list({
      keyword: filters.keyword || undefined,
      category: filters.category || undefined,
      isActive: filters.isActive,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });

    const data = res.data as any;
    products.value = data?.products || [];
    pagination.total = data?.total || 0;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.keyword = '';
  filters.category = '';
  filters.isActive = undefined;
  pagination.page = 1;
  loadData();
};

const openFormDialog = (row: any) => {
  if (row) {
    Object.assign(formData, {
      id: row.id,
      sku: row.sku,
      name: row.name,
      barcode: row.barcode || '',
      category: row.category || '',
      unit: row.unit,
      basePrice: Number(row.basePrice),
      spec: row.spec || '',
      description: row.description || '',
    });
  } else {
    Object.assign(formData, {
      id: '',
      sku: '',
      name: '',
      barcode: '',
      category: '',
      unit: '个',
      basePrice: 0,
      spec: '',
      description: '',
    });
  }
  formDialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formData.sku) {
    ElMessage.warning('请输入商品编码');
    return;
  }
  if (!formData.name) {
    ElMessage.warning('请输入商品名称');
    return;
  }
  if (!formData.unit) {
    ElMessage.warning('请选择单位');
    return;
  }
  if (!formData.basePrice || formData.basePrice <= 0) {
    ElMessage.warning('基准价必须大于0');
    return;
  }

  submitting.value = true;
  try {
    if (formData.id) {
      await productApi.update(formData.id, {
        name: formData.name,
        barcode: formData.barcode || null,
        category: formData.category || null,
        unit: formData.unit,
        basePrice: formData.basePrice,
        spec: formData.spec || null,
        description: formData.description || null,
      });
      ElMessage.success('更新成功');
    } else {
      await productApi.create({
        sku: formData.sku,
        name: formData.name,
        barcode: formData.barcode || null,
        category: formData.category || null,
        unit: formData.unit,
        basePrice: formData.basePrice,
        spec: formData.spec || null,
        description: formData.description || null,
      });
      ElMessage.success('创建成功');
    }

    formDialogVisible.value = false;
    appStore.loadProducts();
    loadData();
  } finally {
    submitting.value = false;
  }
};

const toggleActive = async (row: any) => {
  try {
    await productApi.toggle(row.id);
    ElMessage.success(row.isActive ? '已禁用' : '已启用');
    loadData();
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败');
  }
};

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认删除商品 ${row.name}？删除后不可恢复。`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  try {
    await productApi.delete(row.id);
    ElMessage.success('删除成功');
    appStore.loadProducts();
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
