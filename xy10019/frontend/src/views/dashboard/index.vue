<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <div class="stat-card card-1">
          <div class="flex-between">
            <div>
              <div class="stat-label">商品种类</div>
              <div class="stat-value">{{ statistics.totalProducts || 0 }}</div>
            </div>
            <el-icon class="stat-icon"><Box /></el-icon>
          </div>
        </div>
      </el-col>

      <el-col :span="6">
        <div class="stat-card card-2">
          <div class="flex-between">
            <div>
              <div class="stat-label">总库存数量</div>
              <div class="stat-value">{{ formatNumber(statistics.totalQuantity) }}</div>
            </div>
            <el-icon class="stat-icon"><Goods /></el-icon>
          </div>
        </div>
      </el-col>

      <el-col :span="6">
        <div class="stat-card card-3">
          <div class="flex-between">
            <div>
              <div class="stat-label">库存总价值</div>
              <div class="stat-value">{{ formatCurrency(statistics.totalInventoryValue) }}</div>
            </div>
            <el-icon class="stat-icon"><Money /></el-icon>
          </div>
        </div>
      </el-col>

      <el-col :span="6">
        <div class="stat-card card-4">
          <div class="flex-between">
            <div>
              <div class="stat-label">低库存商品</div>
              <div class="stat-value">{{ statistics.lowStockCount || 0 }}</div>
            </div>
            <el-icon class="stat-icon"><Warning /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="flex-between">
              <span class="page-title">库存概览</span>
              <el-select
                v-model="selectedStoreId"
                placeholder="全部门店"
                style="width: 200px"
                @change="loadStatistics"
                clearable
              >
                <el-option
                  v-for="store in appStore.activeStores"
                  :key="store.id"
                  :label="store.name"
                  :value="store.id"
                />
              </el-select>
            </div>
          </template>

          <el-table :data="recentInventory" v-loading="loading" stripe>
            <el-table-column prop="store.name" label="门店" width="120" />
            <el-table-column prop="product.name" label="商品" min-width="150" />
            <el-table-column prop="product.sku" label="SKU" width="120" />
            <el-table-column label="库存" width="200">
              <template #default="{ row }">
                <div>
                  总数: <strong>{{ row.quantity }}</strong>
                  <span class="text-info ml-10">可用: {{ row.availableQty }}</span>
                  <span v-if="row.lockedQty > 0" class="text-warning ml-10">
                    锁定: {{ row.lockedQty }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="price" label="单价" width="100">
              <template #default="{ row }">
                {{ formatCurrency(row.price) }}
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
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span class="page-title">最近变动</span>
          </template>

          <el-table :data="recentRecords" v-loading="loading" stripe>
            <el-table-column label="商品" min-width="120">
              <template #default="{ row }">
                {{ row.product?.name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <span :class="{
                  'text-success': row.changeQuantity > 0,
                  'text-danger': row.changeQuantity < 0,
                }">
                  {{ getOperationTypeLabel(row.operationType) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="80">
              <template #default="{ row }">
                <span :class="{
                  'text-success': row.changeQuantity > 0,
                  'text-danger': row.changeQuantity < 0,
                }">
                  {{ row.changeQuantity > 0 ? '+' : '' }}{{ row.changeQuantity }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作人" width="80">
              <template #default="{ row }">
                {{ row.operatorName }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="mt-20">
          <template #header>
            <span class="page-title">待处理调拨</span>
          </template>

          <el-empty v-if="pendingTransfers.length === 0" description="暂无待处理调拨" />

          <el-table
            v-else
            :data="pendingTransfers"
            v-loading="loading"
            stripe
          >
            <el-table-column prop="orderNo" label="单号" width="150" />
            <el-table-column label="门店" min-width="120">
              <template #default="{ row }">
                {{ row.sourceStore?.name }} → {{ row.targetStore?.name }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag type="warning">进行中</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { inventoryApi } from '@/api';
import { formatNumber, formatCurrency, getOperationTypeLabel } from '@/utils/format';

const appStore = useAppStore();
const loading = ref(false);
const selectedStoreId = ref<string>('');

const statistics = ref<any>({});
const recentInventory = ref<any[]>([]);
const recentRecords = ref<any[]>([]);
const pendingTransfers = ref<any[]>([]);

const loadStatistics = async () => {
  try {
    const res = await inventoryApi.getStatistics(selectedStoreId.value || undefined);
    statistics.value = res.data || {};
  } catch (error) {
    console.error('加载统计数据失败', error);
  }
};

const loadInventory = async () => {
  try {
    const res = await inventoryApi.list({
      storeId: selectedStoreId.value || undefined,
      limit: 10,
    });
    recentInventory.value = (res.data as any)?.inventories || [];
  } catch (error) {
    console.error('加载库存数据失败', error);
  }
};

const loadRecords = async () => {
  try {
    const res = await inventoryApi.getRecords({ limit: 10 });
    recentRecords.value = (res.data as any)?.records || [];
  } catch (error) {
    console.error('加载变动记录失败', error);
  }
};

const loadTransfers = async () => {
  try {
    const res = await inventoryApi.getTransfers({ status: 'IN_PROGRESS', limit: 5 });
    pendingTransfers.value = (res.data as any)?.orders || [];
  } catch (error) {
    console.error('加载调拨单失败', error);
  }
};

const loadAll = async () => {
  loading.value = true;
  try {
    await Promise.all([
      appStore.init(),
      loadStatistics(),
      loadInventory(),
      loadRecords(),
      loadTransfers(),
    ]);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadAll();
});
</script>

<style lang="scss" scoped>
.dashboard {
  .ml-10 {
    margin-left: 10px;
  }
}
</style>
