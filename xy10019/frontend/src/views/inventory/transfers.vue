<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">门店调拨</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新建调拨
      </el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="filters.orderNo"
        placeholder="调拨单号"
        style="width: 200px"
        clearable
      />

      <el-select
        v-model="filters.sourceStoreId"
        placeholder="源门店"
        style="width: 180px"
        clearable
      >
        <el-option
          v-for="store in appStore.activeStores"
          :key="store.id"
          :label="store.name"
          :value="store.id"
        />
      </el-select>

      <el-select
        v-model="filters.targetStoreId"
        placeholder="目标门店"
        style="width: 180px"
        clearable
      >
        <el-option
          v-for="store in appStore.activeStores"
          :key="store.id"
          :label="store.name"
          :value="store.id"
        />
      </el-select>

      <el-select
        v-model="filters.status"
        placeholder="状态"
        style="width: 150px"
        clearable
      >
        <el-option label="待处理" value="PENDING" />
        <el-option label="进行中" value="IN_PROGRESS" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="已取消" value="CANCELLED" />
      </el-select>

      <el-button type="primary" @click="loadData">
        <el-icon><Search /></el-icon>
        查询
      </el-button>

      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="transfers" v-loading="loading" stripe>
      <el-table-column prop="orderNo" label="调拨单号" width="180" />
      <el-table-column label="源门店" width="150">
        <template #default="{ row }">
          {{ row.sourceStore?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="目标门店" width="150">
        <template #default="{ row }">
          {{ row.targetStore?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getTransferStatusLabel(row.status).type">
            {{ getTransferStatusLabel(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="商品" min-width="200">
        <template #default="{ row }">
          <div>
            <span
              v-for="item in row.items?.slice(0, 2)"
              :key="item.id"
              style="display: block"
            >
              {{ item.product?.name }} × {{ item.quantity }}
            </span>
            <span v-if="row.items?.length > 2" class="text-info">
              ...共 {{ row.items.length }} 种商品
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="totalQuantity" label="总数量" width="80" />
      <el-table-column prop="totalAmount" label="总金额" width="120">
        <template #default="{ row }">
          {{ formatCurrency(row.totalAmount) }}
        </template>
      </el-table-column>
      <el-table-column label="操作人" width="100">
        <template #default="{ row }">
          {{ row.operator?.name || '-' }}
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
            v-if="row.status === 'IN_PROGRESS'"
            type="success"
            link
            size="small"
            @click="completeTransfer(row)"
          >
            完成
          </el-button>
          <el-button
            v-if="row.status === 'PENDING' || row.status === 'IN_PROGRESS'"
            type="danger"
            link
            size="small"
            @click="cancelTransfer(row)"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            link
            size="small"
            @click="viewDetail(row)"
          >
            详情
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
      v-model="createDialogVisible"
      title="新建调拨单"
      width="900px"
      class="form-dialog"
    >
      <el-form :model="transferForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="源门店" required>
              <el-select
                v-model="transferForm.sourceStoreId"
                placeholder="选择源门店"
                style="width: 100%"
                @change="onSourceStoreChange"
              >
                <el-option
                  v-for="store in appStore.activeStores"
                  :key="store.id"
                  :label="store.name"
                  :value="store.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标门店" required>
              <el-select
                v-model="transferForm.targetStoreId"
                placeholder="选择目标门店"
                style="width: 100%"
              >
                <el-option
                  v-for="store in appStore.activeStores.filter(s => s.id !== transferForm.sourceStoreId)"
                  :key="store.id"
                  :label="store.name"
                  :value="store.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="商品列表" required>
          <el-button
            type="primary"
            link
            size="small"
            @click="addTransferItem"
            style="margin-bottom: 10px"
          >
            <el-icon><Plus /></el-icon>
            添加商品
          </el-button>

          <el-table :data="transferForm.items" border>
            <el-table-column label="商品" min-width="200">
              <template #default="{ row, $index }">
                <el-select
                  v-model="row.productId"
                  placeholder="选择商品"
                  filterable
                  style="width: 100%"
                  @change="onProductChange($index)"
                >
                  <el-option
                    v-for="product in availableProducts"
                    :key="product.id"
                    :label="product.name"
                    :value="product.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="库存" width="100">
              <template #default="{ row }">
                {{ getProductStock(row.productId) }}
              </template>
            </el-table-column>
            <el-table-column label="调拨数量" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :min="1"
                  :max="getProductStock(row.productId)"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="调拨单价" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.price"
                  :min="0.01"
                  :precision="2"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="金额" width="120">
              <template #default="{ row }">
                {{ formatCurrency(row.quantity * row.price) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="removeTransferItem($index)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <el-form-item label="合计">
          <div>
            商品数量: <strong>{{ totalQuantity }}</strong> 件
            <span class="ml-20">
              合计金额: <strong class="text-danger">{{ formatCurrency(totalAmount) }}</strong>
            </span>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="transferForm.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">
          创建调拨
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailDialogVisible"
      :title="`调拨单详情 - ${currentTransfer?.orderNo}`"
      width="800px"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="调拨单号">
          {{ currentTransfer?.orderNo }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getTransferStatusLabel(currentTransfer?.status).type">
            {{ getTransferStatusLabel(currentTransfer?.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="源门店">
          {{ currentTransfer?.sourceStore?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="目标门店">
          {{ currentTransfer?.targetStore?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="总数量">
          {{ currentTransfer?.totalQuantity }}
        </el-descriptions-item>
        <el-descriptions-item label="总金额">
          {{ formatCurrency(currentTransfer?.totalAmount) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ currentTransfer?.operator?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDate(currentTransfer?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ currentTransfer?.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <h3 class="mt-20" style="margin-bottom: 10px">商品明细</h3>
      <el-table :data="currentTransfer?.items || []" stripe>
        <el-table-column prop="product.name" label="商品" min-width="150" />
        <el-table-column prop="product.sku" label="SKU" width="120" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">
            {{ formatCurrency(row.price) }}
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">
            {{ formatCurrency(row.amount) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { inventoryApi } from '@/api';
import { formatDate, formatCurrency, getTransferStatusLabel } from '@/utils/format';

const appStore = useAppStore();

const loading = ref(false);
const submitting = ref(false);

const transfers = ref<any[]>([]);
const currentTransfer = ref<any>(null);

const filters = reactive({
  orderNo: '',
  sourceStoreId: '',
  targetStoreId: '',
  status: '',
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const createDialogVisible = ref(false);
const detailDialogVisible = ref(false);

const transferForm = reactive({
  sourceStoreId: '',
  targetStoreId: '',
  items: [] as any[],
  remark: '',
});

const sourceStoreInventory = ref<any[]>([]);

const availableProducts = computed(() => {
  if (!transferForm.sourceStoreId) return [];
  return sourceStoreInventory.value
    .filter((inv) => inv.availableQty > 0)
    .map((inv) => inv.product);
});

const totalQuantity = computed(() => {
  return transferForm.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
});

const totalAmount = computed(() => {
  return transferForm.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
});

const getProductStock = (productId: string) => {
  const inv = sourceStoreInventory.value.find((i) => i.productId === productId);
  return inv?.availableQty || 0;
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.getTransfers({
      orderNo: filters.orderNo || undefined,
      sourceStoreId: filters.sourceStoreId || undefined,
      targetStoreId: filters.targetStoreId || undefined,
      status: filters.status || undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });

    const data = res.data as any;
    transfers.value = data?.orders || [];
    pagination.total = data?.total || 0;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.orderNo = '';
  filters.sourceStoreId = '';
  filters.targetStoreId = '';
  filters.status = '';
  pagination.page = 1;
  loadData();
};

const openCreateDialog = () => {
  transferForm.sourceStoreId = '';
  transferForm.targetStoreId = '';
  transferForm.items = [];
  transferForm.remark = '';
  sourceStoreInventory.value = [];
  createDialogVisible.value = true;
};

const onSourceStoreChange = async (storeId: string) => {
  transferForm.targetStoreId = '';
  transferForm.items = [];

  const res = await inventoryApi.list({ storeId, limit: 1000 });
  sourceStoreInventory.value = (res.data as any)?.inventories || [];
};

const addTransferItem = () => {
  transferForm.items.push({
    productId: '',
    quantity: 1,
    price: 0,
  });
};

const removeTransferItem = (index: number) => {
  transferForm.items.splice(index, 1);
};

const onProductChange = (index: number) => {
  const item = transferForm.items[index];
  const inv = sourceStoreInventory.value.find((i) => i.productId === item.productId);
  if (inv) {
    item.price = Number(inv.price);
  }
};

const handleCreate = async () => {
  if (!transferForm.sourceStoreId || !transferForm.targetStoreId) {
    ElMessage.warning('请选择源门店和目标门店');
    return;
  }

  if (transferForm.items.length === 0) {
    ElMessage.warning('请至少添加一个商品');
    return;
  }

  for (const item of transferForm.items) {
    if (!item.productId) {
      ElMessage.warning('请选择商品');
      return;
    }
    if (item.quantity <= 0) {
      ElMessage.warning('调拨数量必须大于0');
      return;
    }
    if (item.quantity > getProductStock(item.productId)) {
      ElMessage.warning('调拨数量不能超过库存数量');
      return;
    }
    if (item.price <= 0) {
      ElMessage.warning('调拨单价必须大于0');
      return;
    }
  }

  submitting.value = true;
  try {
    await inventoryApi.createTransfer({
      sourceStoreId: transferForm.sourceStoreId,
      targetStoreId: transferForm.targetStoreId,
      items: transferForm.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      remark: transferForm.remark,
    });

    ElMessage.success('调拨单创建成功');
    createDialogVisible.value = false;
    loadData();
  } finally {
    submitting.value = false;
  }
};

const completeTransfer = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认完成调拨单 ${row.orderNo}？`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  try {
    await inventoryApi.completeTransfer(row.id);
    ElMessage.success('调拨完成');
    loadData();
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败');
  }
};

const cancelTransfer = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认取消调拨单 ${row.orderNo}？`,
      '确认',
      { type: 'warning' }
    );
  } catch {
    return;
  }

  try {
    await inventoryApi.cancelTransfer(row.id);
    ElMessage.success('调拨已取消');
    loadData();
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败');
  }
};

const viewDetail = async (row: any) => {
  const res = await inventoryApi.getTransferDetail(row.id);
  currentTransfer.value = res.data;
  detailDialogVisible.value = true;
};

onMounted(() => {
  appStore.init();
  loadData();
});
</script>

<style lang="scss" scoped>
.ml-20 {
  margin-left: 20px;
}
</style>
