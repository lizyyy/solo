<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">库存管理</h2>
      <div class="flex gap-10">
        <el-button type="primary" @click="openAdjustDialog(null)">
          <el-icon><Plus /></el-icon>
          调整库存
        </el-button>
        <el-button type="success" @click="openChangePriceDialog(null)">
          <el-icon><PriceTag /></el-icon>
          变更价格
        </el-button>
        <el-button @click="refresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="search-bar">
      <el-select
        v-model="filters.storeId"
        placeholder="选择门店"
        style="width: 200px"
        clearable
      >
        <el-option
          v-for="store in appStore.activeStores"
          :key="store.id"
          :label="store.name"
          :value="store.id"
        />
      </el-select>

      <el-input
        v-model="filters.keyword"
        placeholder="搜索商品名称/SKU/条码"
        style="width: 250px"
        clearable
        @keyup.enter="loadData"
      />

      <el-select
        v-model="filters.lowStock"
        placeholder="库存状态"
        style="width: 150px"
        clearable
      >
        <el-option label="低库存" :value="true" />
      </el-select>

      <el-button type="primary" @click="loadData">
        <el-icon><Search /></el-icon>
        查询
      </el-button>

      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table
      :data="inventories"
      v-loading="loading"
      stripe
      :row-class-name="tableRowClassName"
    >
      <el-table-column prop="store.name" label="门店" width="120" />
      <el-table-column label="商品信息" min-width="200">
        <template #default="{ row }">
          <div>
            <div><strong>{{ row.product.name }}</strong></div>
            <div class="text-info" style="font-size: 12px">
              SKU: {{ row.product.sku }}
              <span v-if="row.product.barcode">| 条码: {{ row.product.barcode }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="product.category" label="分类" width="100" />
      <el-table-column label="库存信息" width="220">
        <template #default="{ row }">
          <div>
            <div>
              总数: <strong>{{ row.quantity }}</strong>
              <span class="text-info ml-10">可用: {{ row.availableQty }}</span>
            </div>
            <div v-if="row.lockedQty > 0" class="text-warning" style="font-size: 12px">
              锁定: {{ row.lockedQty }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="价格" width="180">
        <template #default="{ row }">
          <div>
            <div>当前价: <strong class="text-danger">{{ formatCurrency(row.price) }}</strong></div>
            <div class="text-info" style="font-size: 12px">
              基准价: {{ formatCurrency(row.product.basePrice) }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="库存价值" width="120">
        <template #default="{ row }">
          {{ formatCurrency(row.quantity * Number(row.price)) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.availableQty <= 10" type="danger">低库存</el-tag>
          <el-tag v-else-if="row.availableQty <= 50" type="warning">预警</el-tag>
          <el-tag v-else type="success">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastUpdated" label="最后更新" width="180">
        <template #default="{ row }">
          {{ formatDate(row.lastUpdated) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openAdjustDialog(row)">
            调整
          </el-button>
          <el-button type="success" link size="small" @click="openChangePriceDialog(row)">
            改价
          </el-button>
          <el-button
            type="primary"
            link
            size="small"
            @click="viewRecords(row)"
          >
            记录
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
      v-model="adjustDialogVisible"
      title="调整库存"
      width="500px"
      class="form-dialog"
    >
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="门店" required>
          <el-select
            v-model="adjustForm.storeId"
            placeholder="选择门店"
            style="width: 100%"
            :disabled="!!adjustForm.inventoryId"
          >
            <el-option
              v-for="store in appStore.activeStores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="商品" required>
          <el-select
            v-model="adjustForm.productId"
            placeholder="选择商品"
            filterable
            style="width: 100%"
            :disabled="!!adjustForm.inventoryId"
          >
            <el-option
              v-for="product in appStore.activeProducts"
              :key="product.id"
              :label="product.name"
              :value="product.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="调整数量" required>
          <el-input-number
            v-model="adjustForm.quantity"
            :min="-999999"
            :max="999999"
            style="width: 100%"
          />
          <div class="text-info" style="font-size: 12px; margin-top: 5px">
            正数为入库，负数为出库
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="adjustForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入调整原因"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdjust">
          确认调整
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="changePriceDialogVisible"
      title="变更价格"
      width="500px"
      class="form-dialog"
    >
      <el-form :model="priceForm" label-width="100px">
        <el-form-item label="门店" required>
          <el-select
            v-model="priceForm.storeId"
            placeholder="选择门店"
            style="width: 100%"
            :disabled="!!priceForm.inventoryId"
          >
            <el-option
              v-for="store in appStore.activeStores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="商品" required>
          <el-select
            v-model="priceForm.productId"
            placeholder="选择商品"
            filterable
            style="width: 100%"
            :disabled="!!priceForm.inventoryId"
          >
            <el-option
              v-for="product in appStore.activeProducts"
              :key="product.id"
              :label="product.name"
              :value="product.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="原价格">
          <el-input :model-value="currentPrice" disabled />
        </el-form-item>

        <el-form-item label="新价格" required>
          <el-input-number
            v-model="priceForm.newPrice"
            :min="0.01"
            :precision="2"
            :step="1"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="变更原因" required>
          <el-input
            v-model="priceForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入价格变更原因"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="changePriceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleChangePrice">
          确认变更
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="recordsDialogVisible"
      :title="`库存变动记录 - ${currentProduct?.product?.name || ''}`"
      width="900px"
    >
      <el-table :data="currentRecords" v-loading="recordsLoading" stripe>
        <el-table-column label="操作类型" width="100">
          <template #default="{ row }">
            <span :class="{
              'text-success': row.changeQuantity > 0,
              'text-danger': row.changeQuantity < 0,
            }">
              {{ getOperationTypeLabel(row.operationType) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="数量变动" width="150">
          <template #default="{ row }">
            <span :class="{
              'text-success': row.changeQuantity > 0,
              'text-danger': row.changeQuantity < 0,
            }">
              {{ row.quantityBefore }}
              →
              {{ row.quantityAfter }}
              ({{ row.changeQuantity > 0 ? '+' : '' }}{{ row.changeQuantity }})
            </span>
          </template>
        </el-table-column>
        <el-table-column label="价格变动" width="150">
          <template #default="{ row }">
            <span v-if="row.priceBefore !== row.priceAfter">
              {{ formatCurrency(row.priceBefore) }}
              →
              <span class="text-danger">{{ formatCurrency(row.priceAfter) }}</span>
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作人" width="100" />
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { inventoryApi, auditApi } from '@/api';
import { formatDate, formatCurrency, getOperationTypeLabel } from '@/utils/format';
import { AuditEntity } from '@prisma/client';

const appStore = useAppStore();

const loading = ref(false);
const submitting = ref(false);
const recordsLoading = ref(false);

const inventories = ref<any[]>([]);
const currentProduct = ref<any>(null);
const currentRecords = ref<any[]>([]);

const filters = reactive({
  storeId: '',
  keyword: '',
  lowStock: undefined as boolean | undefined,
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const adjustDialogVisible = ref(false);
const changePriceDialogVisible = ref(false);
const recordsDialogVisible = ref(false);

const adjustForm = reactive({
  inventoryId: '',
  storeId: '',
  productId: '',
  quantity: 0,
  remark: '',
});

const priceForm = reactive({
  inventoryId: '',
  storeId: '',
  productId: '',
  newPrice: 0,
  reason: '',
});

const currentPrice = computed(() => {
  if (priceForm.inventoryId) {
    const inv = inventories.value.find((i) => i.id === priceForm.inventoryId);
    return inv ? formatCurrency(inv.price) : '-';
  }
  return '-';
});

const tableRowClassName = ({ row }: any) => {
  if (row.availableQty <= 10) return 'danger-row';
  if (row.availableQty <= 50) return 'warning-row';
  return '';
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.list({
      storeId: filters.storeId || undefined,
      keyword: filters.keyword || undefined,
      lowStock: filters.lowStock,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });

    const data = res.data as any;
    inventories.value = data?.inventories || [];
    pagination.total = data?.total || 0;
  } finally {
    loading.value = false;
  }
};

const refresh = () => {
  pagination.page = 1;
  loadData();
};

const resetFilters = () => {
  filters.storeId = '';
  filters.keyword = '';
  filters.lowStock = undefined;
  pagination.page = 1;
  loadData();
};

const openAdjustDialog = (row: any) => {
  adjustForm.inventoryId = row?.id || '';
  adjustForm.storeId = row?.storeId || '';
  adjustForm.productId = row?.productId || '';
  adjustForm.quantity = 0;
  adjustForm.remark = '';
  adjustDialogVisible.value = true;
};

const openChangePriceDialog = (row: any) => {
  priceForm.inventoryId = row?.id || '';
  priceForm.storeId = row?.storeId || '';
  priceForm.productId = row?.productId || '';
  priceForm.newPrice = row?.price ? Number(row.price) : 0;
  priceForm.reason = '';
  changePriceDialogVisible.value = true;
};

const handleAdjust = async () => {
  if (!adjustForm.storeId || !adjustForm.productId) {
    ElMessage.warning('请选择门店和商品');
    return;
  }

  if (adjustForm.quantity === 0) {
    ElMessage.warning('请输入调整数量');
    return;
  }

  const action = adjustForm.quantity > 0 ? '入库' : '出库';
  try {
    await ElMessageBox.confirm(
      `确认${action} ${Math.abs(adjustForm.quantity)} 件商品？`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  submitting.value = true;
  try {
    await inventoryApi.adjust({
      storeId: adjustForm.storeId,
      productId: adjustForm.productId,
      quantity: adjustForm.quantity,
      remark: adjustForm.remark,
    });

    ElMessage.success('库存调整成功');
    adjustDialogVisible.value = false;
    loadData();
  } finally {
    submitting.value = false;
  }
};

const handleChangePrice = async () => {
  if (!priceForm.storeId || !priceForm.productId) {
    ElMessage.warning('请选择门店和商品');
    return;
  }

  if (!priceForm.newPrice) {
    ElMessage.warning('请输入新价格');
    return;
  }

  if (!priceForm.reason) {
    ElMessage.warning('请输入价格变更原因');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确认将价格变更为 ${formatCurrency(priceForm.newPrice)}？`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  submitting.value = true;
  try {
    await inventoryApi.changePrice({
      storeId: priceForm.storeId,
      productId: priceForm.productId,
      newPrice: priceForm.newPrice,
      reason: priceForm.reason,
    });

    ElMessage.success('价格变更成功');
    changePriceDialogVisible.value = false;
    loadData();
  } finally {
    submitting.value = false;
  }
};

const viewRecords = async (row: any) => {
  currentProduct.value = row;
  recordsDialogVisible.value = true;
  recordsLoading.value = true;

  try {
    const res = await auditApi.getByEntity(AuditEntity.INVENTORY, row.id, 50, 0);
    currentRecords.value = (res.data as any)?.logs || [];
  } finally {
    recordsLoading.value = false;
  }
};

onMounted(() => {
  appStore.init();
  loadData();
});
</script>
