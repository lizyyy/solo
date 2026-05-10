<template>
  <div class="treatments-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>诊疗项目管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon> 新建项目
          </el-button>
        </div>
      </template>

      <el-table :data="treatments" stripe>
        <el-table-column prop="code" label="项目编码" width="120" />
        <el-table-column prop="name" label="项目名称" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="duration_minutes" label="时长(分钟)" width="100" />
        <el-table-column label="绑定耗材数" width="120">
          <template #default="{ row }">
            <el-tag type="info">{{ row.materials?.length || 0 }}种</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="库存状态" width="150">
          <template #default="{ row }">
            <el-tag
              v-if="row._stockCheck"
              :type="row._stockCheck.can_perform ? 'success' : 'danger'"
              size="small"
            >
              {{ row._stockCheck.can_perform ? '可执行' : `缺${row._stockCheck.shortage_count}种` }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_active === 1"
              @change="toggleActive(row)"
              :active-color="#67c23a"
              :inactive-color="#909399"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="checkStock(row)">
              库存检查
            </el-button>
            <el-button type="success" link size="small" @click="openBindDialog(row)">
              绑定耗材
            </el-button>
            <el-button type="warning" link size="small" @click="viewSummary(row)">
              耗材明细
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="bindDialogVisible" title="绑定耗材" width="700px">
      <div v-if="currentTreatment">
        <el-alert
          v-if="currentTreatment.materials?.length > 0"
          :title="`已绑定 ${currentTreatment.materials.length} 种耗材`"
          type="info"
          show-icon
          :closable="false"
          style="margin-bottom: 15px;"
        />

        <div class="bind-materials">
          <div
            v-for="(m, idx) in bindMaterials"
            :key="idx"
            class="bind-row"
          >
            <el-select
              v-model="m.material_id"
              placeholder="选择耗材"
              filterable
              style="width: 250px;"
            >
              <el-option
                v-for="mat in allMaterials"
                :key="mat.id"
                :label="`${mat.name} (库存:${mat.current_stock}${mat.unit})`"
                :value="mat.id"
              />
            </el-select>
            <el-input-number
              v-model="m.quantity"
              :min="1"
              :max="999"
              style="width: 120px; margin: 0 10px;"
              placeholder="数量"
            />
            <el-input
              v-model="m.notes"
              placeholder="备注"
              style="width: 180px;"
            />
            <el-button
              type="danger"
              :icon="Delete"
              circle
              size="small"
              @click="removeBindItem(idx)"
            />
          </div>

          <el-button type="primary" text @click="addBindItem" style="margin-top: 10px;">
            <el-icon><Plus /></el-icon> 添加耗材
          </el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="bindDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBindMaterials" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="summaryDialogVisible" title="耗材明细" width="600px">
      <div v-if="currentTreatment?.materials">
        <el-table :data="currentTreatment.materials" stripe>
          <el-table-column prop="material_name" label="耗材名称" />
          <el-table-column prop="quantity" label="标准用量" width="100" />
          <el-table-column prop="current_stock" label="当前库存" width="100">
            <template #default="{ row }">
              <span :style="{ color: row.current_stock < row.quantity ? '#f56c6c' : '' }">
                {{ row.current_stock }}{{ row.unit }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="库存状态" width="100">
            <template #default="{ row }">
              <el-tag
                :type="row.current_stock >= row.quantity ? 'success' : 'danger'"
                size="small"
              >
                {{ row.current_stock >= row.quantity ? '充足' : '不足' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { treatmentApi, materialApi } from '../api';

const treatments = ref([]);
const allMaterials = ref([]);
const currentTreatment = ref(null);
const bindDialogVisible = ref(false);
const summaryDialogVisible = ref(false);
const bindMaterials = ref([]);
const saving = ref(false);

async function loadTreatments() {
  try {
    const res = await treatmentApi.list();
    treatments.value = res.data;
    
    for (const t of treatments.value) {
      const check = await treatmentApi.checkStock(t.id);
      t._stockCheck = check.data;
    }
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadMaterials() {
  try {
    const res = await materialApi.list();
    allMaterials.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function toggleActive(row) {
  try {
    await treatmentApi.update(row.id, {
      ...row,
      is_active: row.is_active ? 0 : 1
    });
    ElMessage.success('状态已更新');
    loadTreatments();
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function checkStock(row) {
  try {
    const res = await treatmentApi.checkStock(row.id);
    const check = res.data;
    
    if (check.can_perform) {
      ElMessage.success(`${row.name} 所有耗材库存充足，可执行`);
    } else {
      const shortage = check.issues.map(i => `${i.material_name}缺${i.shortage}`).join('、');
      ElMessage.warning(`${row.name} 库存不足：${shortage}`);
    }
    loadTreatments();
  } catch (error) {
    ElMessage.error(error.message);
  }
}

function openBindDialog(row) {
  currentTreatment.value = { ...row };
  bindMaterials.value = row.materials?.map(m => ({
    material_id: m.material_id,
    quantity: m.quantity,
    notes: m.notes || ''
  })) || [{ material_id: null, quantity: 1, notes: '' }];
  bindDialogVisible.value = true;
}

function addBindItem() {
  bindMaterials.value.push({ material_id: null, quantity: 1, notes: '' });
}

function removeBindItem(idx) {
  if (bindMaterials.value.length > 1) {
    bindMaterials.value.splice(idx, 1);
  }
}

async function saveBindMaterials() {
  const validMaterials = bindMaterials.value.filter(m => m.material_id);
  if (validMaterials.length === 0) {
    ElMessage.warning('请至少选择一种耗材');
    return;
  }
  
  saving.value = true;
  try {
    await treatmentApi.bindMaterials(currentTreatment.value.id, validMaterials);
    ElMessage.success('绑定成功');
    bindDialogVisible.value = false;
    loadTreatments();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    saving.value = false;
  }
}

async function viewSummary(row) {
  try {
    const res = await treatmentApi.get(row.id);
    currentTreatment.value = res.data;
    summaryDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

function openCreateDialog() {
  ElMessage.info('请在后端添加或通过API创建诊疗项目');
}

onMounted(() => {
  loadTreatments();
  loadMaterials();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.bind-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
</style>
