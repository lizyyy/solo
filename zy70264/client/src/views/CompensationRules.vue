<template>
  <div>
    <h2 class="page-title">补偿规则配置</h2>

    <el-card class="card-section">
      <template #header>
        <div class="flex-between">
          <span>补偿规则列表</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建规则
          </el-button>
        </div>
      </template>

      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column prop="rule_name" label="规则名称" width="200" />
        <el-table-column prop="trigger_type" label="触发类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.trigger_type === 'temperature' ? 'warning' : 'danger'">
              {{ row.trigger_type === 'temperature' ? '温度异常' : '退餐异常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="trigger_condition" label="触发条件" min-width="250" />
        <el-table-column prop="compensation_type" label="补偿方式" width="120">
          <template #default="{ row }">
            {{ row.compensation_type === 'fixed' ? '固定金额' : '比例' }}
          </template>
        </el-table-column>
        <el-table-column label="补偿值" width="150">
          <template #default="{ row }">
            <span v-if="row.compensation_type === 'fixed'" style="color: #e6a23c; font-weight: bold;">
              ¥{{ row.compensation_amount }}
            </span>
            <span v-else style="color: #e6a23c; font-weight: bold;">
              {{ row.compensation_percent }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.is_active"
              :active-value="1"
              :inactive-value="0"
              @change="toggleRule(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" size="small" link @click="deleteRule(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑规则' : '新建规则'"
      width="600px"
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="120px">
        <el-form-item label="规则名称" prop="rule_name">
          <el-input v-model="form.rule_name" placeholder="规则名称" />
        </el-form-item>
        <el-form-item label="触发类型" prop="trigger_type">
          <el-select v-model="form.trigger_type" style="width: 100%;">
            <el-option label="温度异常" value="temperature" />
            <el-option label="退餐异常" value="return" />
          </el-select>
        </el-form-item>
        <el-form-item label="触发条件" prop="trigger_condition">
          <el-input
            v-model="form.trigger_condition"
            type="textarea"
            :rows="2"
            placeholder="描述触发此规则的条件"
          />
        </el-form-item>
        <el-form-item label="补偿方式" prop="compensation_type">
          <el-select v-model="form.compensation_type" style="width: 100%;">
            <el-option label="固定金额" value="fixed" />
            <el-option label="比例计算" value="percent" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.compensation_type === 'fixed'" label="固定金额" prop="compensation_amount">
          <el-input-number v-model="form.compensation_amount" :min="0" :precision="2" style="width: 100%;" />
        </el-form-item>
        <el-form-item v-else label="比例(%)" prop="compensation_percent">
          <el-input-number v-model="form.compensation_percent" :min="0" :max="100" :precision="2" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { compensationAPI } from '@/api';

const loading = ref(false);
const rules = ref([]);
const dialogVisible = ref(false);
const isEdit = ref(false);
const formRef = ref(null);

const form = reactive({
  id: '',
  rule_name: '',
  trigger_type: 'temperature',
  trigger_condition: '',
  compensation_type: 'fixed',
  compensation_amount: 0,
  compensation_percent: 0
});

const formRules = {
  rule_name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  trigger_type: [{ required: true, message: '请选择触发类型', trigger: 'change' }],
  trigger_condition: [{ required: true, message: '请输入触发条件', trigger: 'blur' }],
  compensation_type: [{ required: true, message: '请选择补偿方式', trigger: 'change' }]
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await compensationAPI.rules();
    rules.value = res.data;
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  isEdit.value = false;
  Object.assign(form, {
    id: '',
    rule_name: '',
    trigger_type: 'temperature',
    trigger_condition: '',
    compensation_type: 'fixed',
    compensation_amount: 0,
    compensation_percent: 0
  });
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  dialogVisible.value = true;
};

const toggleRule = async (row) => {
  await compensationAPI.updateRule(row.id, { is_active: row.is_active });
  ElMessage.success('规则状态已更新');
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate();

  try {
    if (isEdit.value) {
      await compensationAPI.updateRule(form.id, form);
      ElMessage.success('规则更新成功');
    } else {
      await compensationAPI.createRule(form);
      ElMessage.success('规则创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (err) {
    // 错误已在API拦截器中处理
  }
};

const deleteRule = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除此规则吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await compensationAPI.deleteRule(row.id);
    ElMessage.success('规则删除成功');
    loadData();
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  loadData();
});
</script>
