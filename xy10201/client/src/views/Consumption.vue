<template>
  <div class="consumption-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>按诊疗项目消耗</span>
          </template>
          
          <el-form :model="treatmentForm" label-width="100px">
            <el-form-item label="选择科室">
              <el-select v-model="treatmentForm.departmentId" placeholder="请选择科室" style="width: 100%;">
                <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="诊疗项目">
              <el-select
                v-model="treatmentForm.treatmentId"
                placeholder="请选择诊疗项目"
                style="width: 100%;"
                filterable
                @change="onTreatmentChange"
              >
                <el-option
                  v-for="t in activeTreatments"
                  :key="t.id"
                  :label="t.name"
                  :value="t.id"
                />
              </el-select>
            </el-form-item>

            <el-alert
              v-if="selectedTreatment"
              :title="stockCheckTitle"
              :type="stockCheckCanPerform ? 'success' : 'error'"
              show-icon
              :closable="false"
              style="margin-bottom: 15px;"
            >
              <template #default>
                <div v-if="stockCheck?.issues?.length">
                  <el-tag
                    v-for="i in stockCheck.issues"
                    :key="i.material_id"
                    type="danger"
                    size="small"
                    style="margin-right: 5px;"
                  >
                    {{ i.material_name }} 缺{{ i.shortage }}
                  </el-tag>
                </div>
              </template>
            </el-alert>
            
            <el-form-item label="患者姓名">
              <el-input v-model="treatmentForm.patientName" placeholder="可选" />
            </el-form-item>
            
            <el-form-item label="消耗数量">
              <el-input-number v-model="treatmentForm.quantity" :min="1" :max="99" />
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                @click="submitTreatmentConsumption"
                :loading="submitting"
                :disabled="!stockCheckCanPerform"
              >
                确认消耗
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <span>手动消耗</span>
          </template>
          
          <el-form :model="manualForm" label-width="100px">
            <el-form-item label="选择科室">
              <el-select v-model="manualForm.departmentId" placeholder="请选择科室" style="width: 100%;">
                <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="选择耗材">
              <el-select
                v-model="manualForm.materialId"
                placeholder="请选择耗材"
                style="width: 100%;"
                filterable
              >
                <el-option
                  v-for="m in materials"
                  :key="m.id"
                  :label="`${m.name} (库存:${m.current_stock}${m.unit})`"
                  :value="m.id"
                />
              </el-select>
            </el-form-item>
            
            <el-form-item label="消耗数量">
              <el-input-number v-model="manualForm.quantity" :min="1" :max="999" />
            </el-form-item>
            
            <el-form-item label="患者姓名">
              <el-input v-model="manualForm.patientName" placeholder="可选" />
            </el-form-item>
            
            <el-form-item label="备注">
              <el-input v-model="manualForm.notes" type="textarea" :rows="2" />
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                @click="submitManualConsumption"
                :loading="submitting"
              >
                确认消耗
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>消耗记录</span>
          <el-button type="primary" text @click="loadRecords">刷新</el-button>
        </div>
      </template>
      
      <el-table :data="records" stripe style="width: 100%">
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.consumption_type === 'TREATMENT' ? 'primary' : 'info'" size="small">
              {{ row.consumption_type === 'TREATMENT' ? '诊疗' : '手动' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="department_name" label="科室" width="100" />
        <el-table-column prop="treatment_name" label="诊疗项目" width="120" />
        <el-table-column prop="material_name" label="耗材" />
        <el-table-column prop="quantity" label="数量" width="80">
          <template #default="{ row }">
            {{ row.quantity }}{{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">
            ¥{{ row.total_amount.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="patient_name" label="患者" width="100" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { consumptionApi, treatmentApi, materialApi } from '../api';

const props = defineProps(['operator']);

const departments = ref([]);
const activeTreatments = ref([]);
const materials = ref([]);
const records = ref([]);
const selectedTreatment = ref(null);
const stockCheck = ref(null);
const submitting = ref(false);

const treatmentForm = ref({
  departmentId: null,
  treatmentId: null,
  patientName: '',
  quantity: 1
});

const manualForm = ref({
  departmentId: null,
  materialId: null,
  quantity: 1,
  patientName: '',
  notes: ''
});

const stockCheckCanPerform = computed(() => !stockCheck.value || stockCheck.value.can_perform);
const stockCheckTitle = computed(() => {
  if (!stockCheck.value) return '请先选择诊疗项目';
  return stockCheck.value.can_perform
    ? `该项目绑定 ${stockCheck.value.issues?.length || 0} 种耗材，库存充足`
    : `缺少 ${stockCheck.value.shortage_count} 种耗材，无法执行`;
});

async function loadDepartments() {
  try {
    const res = await consumptionApi.getDepartments();
    departments.value = res.data;
    if (departments.value.length > 0) {
      treatmentForm.value.departmentId = departments.value[0].id;
      manualForm.value.departmentId = departments.value[0].id;
    }
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadTreatments() {
  try {
    const res = await treatmentApi.list(true);
    activeTreatments.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadMaterials() {
  try {
    const res = await materialApi.list();
    materials.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function loadRecords() {
  try {
    const res = await consumptionApi.getRecords({ limit: 20 });
    records.value = res.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function onTreatmentChange(treatmentId) {
  if (!treatmentId) {
    selectedTreatment.value = null;
    stockCheck.value = null;
    return;
  }
  
  try {
    const [tRes, cRes] = await Promise.all([
      treatmentApi.get(treatmentId),
      treatmentApi.checkStock(treatmentId)
    ]);
    selectedTreatment.value = tRes.data;
    stockCheck.value = cRes.data;
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function submitTreatmentConsumption() {
  if (!treatmentForm.value.departmentId || !treatmentForm.value.treatmentId) {
    ElMessage.warning('请选择科室和诊疗项目');
    return;
  }
  
  submitting.value = true;
  try {
    const res = await consumptionApi.byTreatment({
      ...treatmentForm.value,
      operator: props.operator
    });
    ElMessage.success(res.message || '消耗记录成功');
    loadRecords();
    loadMaterials();
    loadTreatments();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    submitting.value = false;
  }
}

async function submitManualConsumption() {
  if (!manualForm.value.departmentId || !manualForm.value.materialId || !manualForm.value.quantity) {
    ElMessage.warning('请完善消耗信息');
    return;
  }
  
  submitting.value = true;
  try {
    const res = await consumptionApi.manual({
      ...manualForm.value,
      operator: props.operator
    });
    ElMessage.success('消耗记录成功');
    loadRecords();
    loadMaterials();
    manualForm.value.quantity = 1;
    manualForm.value.notes = '';
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadDepartments();
  loadTreatments();
  loadMaterials();
  loadRecords();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
