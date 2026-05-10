<template>
  <div class="materials-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="filter-bar">
            <el-select v-model="filters.category" placeholder="按分类筛选" clearable style="width: 150px;">
              <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
            </el-select>
            <el-input
              v-model="filters.keyword"
              placeholder="搜索耗材名称/编码"
              style="width: 200px; margin-left: 10px;"
              clearable
            />
            <el-button type="primary" @click="loadMaterials">查询</el-button>
          </div>
          <el-button type="success" @click="loadLowStock">
            <el-icon><Warning /></el-icon> 库存不足 ({{ lowStockCount }})
          </el-button>
        </div>
      </template>

      <el-table :data="materials" stripe>
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="name" label="耗材名称" min-width="150" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column label="库存状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStockTagType(row.stock_status)" size="small">
              {{ getStockLabel(row.stock_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前库存" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, (row.current_stock / row.max_stock) * 100)"
              :status="row.current_stock < row.min_stock ? 'exception' : ''"
              :format="() => `${row.current_stock}/${row.max_stock}${row.unit}`"
            />
          </template>
        </el-table-column>
        <el-table-column prop="min_stock" label="预警值" width="80">
          <template #default="{ row }">
            {{ row.min_stock }}{{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="单价" width="100">
          <template #default="{ row }">
            ¥{{ row.price.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewHistory(row)">
              历史
            </el-button>
            <el-button type="warning" link size="small" @click="openAdjustDialog(row)">
              调库存
            </el-button>
            <el-button type="success" link size="small" @click="quickReplenish(row)">
              申请补货
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="historyDialogVisible" title="库存历史记录" width="700px">
      <div v-if="selectedMaterial">
        <el-descriptions :column="3" border style="margin-bottom: 15px;">
          <el-descriptions-item label="耗材">{{ selectedMaterial.name }}</el-descriptions-item>
          <el-descriptions-item label="编码">{{ selectedMaterial.code }}</el-descriptions-item>
          <el-descriptions-item label="当前库存">
            <el-tag :type="getStockTagType(selectedMaterial.stock_status)" size="small">
              {{ selectedMaterial.current_stock }}{{ selectedMaterial.unit }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        
        <el-table :data="history" stripe size="small">
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.change_quantity > 0 ? 'success' : 'danger'" size="small">
                {{ getSnapshotLabel(row.snapshot_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="变化" width="120">
            <template #default="{ row }">
              <span :style="{ color: row.change_quantity > 0 ? '#67c23a' : '#f56c6c' }">
                {{ row.change_quantity > 0 ? '+' : '' }}{{ row.change_quantity }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="变更前" width="100">
            <template #default="{ row }">{{ row.before_quantity }}</template>
          </el-table-column>
          <el-table-column label="变更后" width="100">
            <template #default="{ row }">{{ row.after_quantity }}</template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="100" />
          <el-table-column prop="notes" label="备注" />
          <el-table-column prop="created_at" label="时间" width="180" />
        </el-table>
      </div>
    </el-dialog>

    <el-dialog v-model="adjustDialogVisible" title="调整库存" width="450px">
      <el-form v-if="selectedMaterial" label-width="100px">
        <el-form-item label="当前库存">
          <span>{{ selectedMaterial.current_stock }}{{ selectedMaterial.unit }}</span>
        </el-form-item>
        <el-form-item label="调整数量">
          <el-input-number v-model="adjustForm.quantity" :min="-9999" :max="9999" />
          <span style="margin-left: 10px; color: #909399;">(负数为扣减，正数为增加)</span>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="adjustForm.notes" type="textarea" :rows="2" placeholder="请说明调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdjust" :loading="adjusting">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { materialApi } from '../api';
import { useRouter } from 'vue-router';

const props = defineProps(['operator']);
const router = useRouter();

const materials = ref([]);
const categories = ref([]);
const selectedMaterial = ref(null);
const history = ref([]);
const historyDialogVisible = ref(false);
const adjustDialogVisible = ref(false);
const adjusting = ref(false);

const filters = ref({
  category: '',
  keyword: ''
});

const adjustForm = ref({
  quantity: 0,
  notes: ''
});

const lowStockCount = computed(() => 
  materials.value.filter(m => m.stock_status !== 'NORMAL').length
);

function getStockTagType(status) {
  const map = { NORMAL: 'success', LOW_STOCK: 'warning', OUT_OF_STOCK: 'danger', OVER_STOCK: 'info' };
  return map[status] || 'info';
}

function getStockLabel(status) {
  const map = { NORMAL: '正常', LOW_STOCK: '库存不足', OUT_OF_STOCK: '已断货', OVER_STOCK: '过量' };
  return map[status] || status;
}

function getSnapshotLabel(type) {
  const map = {
    CONSUMPTION: '消耗',
    REPLENISHMENT: '补货',
    MANUAL_ADD: '手动入库',
    MANUAL_DEDUCT: '手动出库'
  };
  return map[type] || type;
}

async function loadMaterials() {
  try {
    const res = await materialApi.list(filters.value);
    materials.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadLowStock() {
  try {
    const res = await materialApi.getLowStock();
    materials.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadCategories() {
  try {
    const res = await materialApi.getCategories();
    categories.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function viewHistory(row) {
  selectedMaterial.value = row;
  try {
    const res = await materialApi.getHistory(row.id, 20);
    history.value = res.data;
    historyDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

function openAdjustDialog(row) {
  selectedMaterial.value = row;
  adjustForm.value = { quantity: 0, notes: '' };
  adjustDialogVisible.value = true;
}

async function submitAdjust() {
  if (adjustForm.value.quantity === 0) {
    ElMessage.warning('请输入调整数量');
    return;
  }
  
  adjusting.value = true;
  try {
    await materialApi.adjustStock(selectedMaterial.value.id, {
      change_quantity: adjustForm.value.quantity,
      operator: props.operator,
      notes: adjustForm.value.notes
    });
    ElMessage.success('库存调整成功');
    adjustDialogVisible.value = false;
    loadMaterials();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    adjusting.value = false;
  }
}

function quickReplenish(row) {
  localStorage.setItem('preSelectMaterial', row.id);
  localStorage.setItem('preQuantity', Math.max(row.min_stock - row.current_stock, 10));
  router.push('/replenishment');
}

onMounted(() => {
  loadMaterials();
  loadCategories();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
