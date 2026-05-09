<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">库存变动记录</h2>
    </div>

    <div class="search-bar">
      <el-select
        v-model="filters.storeId"
        placeholder="选择门店"
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
        v-model="filters.operationType"
        placeholder="操作类型"
        style="width: 150px"
        clearable
      >
        <el-option label="入库" value="IN" />
        <el-option label="出库" value="OUT" />
        <el-option label="调整" value="ADJUST" />
        <el-option label="改价" value="PRICE_CHANGE" />
        <el-option label="调拨入" value="TRANSFER_IN" />
        <el-option label="调拨出" value="TRANSFER_OUT" />
      </el-select>

      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="width: 320px"
      />

      <el-button type="primary" @click="loadData">
        <el-icon><Search /></el-icon>
        查询
      </el-button>

      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="records" v-loading="loading" stripe>
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="商品" min-width="180">
        <template #default="{ row }">
          <div>
            <div><strong>{{ row.product?.name || '-' }}</strong></div>
            <div class="text-info" style="font-size: 12px">
              {{ row.product?.sku || '-' }}
            </div>
          </div>
        </template>
      </el-table-column>
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
      <el-table-column label="数量变动" width="200">
        <template #default="{ row }">
          <div>
            <span>{{ row.quantityBefore }}</span>
            <el-icon style="margin: 0 8px"><ArrowRight /></el-icon>
            <span>{{ row.quantityAfter }}</span>
          </div>
          <div>
            变动:
            <span :class="{
              'text-success': row.changeQuantity > 0,
              'text-danger': row.changeQuantity < 0,
            }">
              {{ row.changeQuantity > 0 ? '+' : '' }}{{ row.changeQuantity }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="价格变动" width="200">
        <template #default="{ row }">
          <span v-if="row.priceBefore !== undefined && row.priceAfter !== undefined && row.priceBefore !== row.priceAfter">
            <div>
              <span>{{ formatCurrency(row.priceBefore) }}</span>
              <el-icon style="margin: 0 8px"><ArrowRight /></el-icon>
              <span class="text-danger">{{ formatCurrency(row.priceAfter) }}</span>
            </div>
          </span>
          <span v-else class="text-info">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="operatorName" label="操作人" width="100" />
      <el-table-column prop="remark" label="备注" min-width="150">
        <template #default="{ row }">
          {{ row.remark || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="关联单号" width="180">
        <template #default="{ row }">
          {{ row.referenceId || '-' }}
          <el-tag v-if="row.referenceType" size="small" type="info" class="ml-10">
            {{ row.referenceType }}
          </el-tag>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { inventoryApi } from '@/api';
import { formatDate, formatCurrency, getOperationTypeLabel } from '@/utils/format';

const appStore = useAppStore();

const loading = ref(false);
const records = ref<any[]>([]);

const filters = reactive({
  storeId: '',
  operationType: '',
});

const dateRange = ref<string[]>([]);

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
});

const loadData = async () => {
  loading.value = true;
  try {
    const params: any = {
      storeId: filters.storeId || undefined,
      operationType: filters.operationType || undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    };

    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0];
      params.endTime = dateRange.value[1];
    }

    const res = await inventoryApi.getRecords(params);
    const data = res.data as any;
    records.value = data?.records || [];
    pagination.total = data?.total || 0;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.storeId = '';
  filters.operationType = '';
  dateRange.value = [];
  pagination.page = 1;
  loadData();
};

onMounted(() => {
  appStore.init();
  loadData();
});
</script>

<style lang="scss" scoped>
.ml-10 {
  margin-left: 10px;
}
</style>
