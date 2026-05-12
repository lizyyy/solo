<template>
  <div>
    <div class="page-header">
      <h2>规则管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增规则
      </el-button>
    </div>

    <div class="page-card">
      <el-table :data="rules" v-loading="loading">
        <el-table-column prop="name" label="规则名称" width="220" />
        <el-table-column prop="type" label="规则类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'GLOBAL' ? 'primary' : 'warning'" size="small">
              {{ row.type === 'GLOBAL' ? '全局' : '租户级' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ row.priority }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配条件">
          <template #default="{ row }">
            <div>
              <el-tag v-if="row.tenantLevel" size="small" style="margin: 2px;">
                租户等级: {{ getTenantLevelLabel(row.tenantLevel) }}
              </el-tag>
              <el-tag v-if="row.regionCode" size="small" style="margin: 2px;">
                地区: {{ getRegionName(row.regionCode) }}
              </el-tag>
              <el-tag v-if="row.interfaceGroupId" size="small" style="margin: 2px;">
                接口组: {{ getGroupName(row.interfaceGroupId) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="限流配置" width="180">
          <template #default="{ row }">
            {{ row.limitType === 'QPS' ? 'QPS' : '总量' }}: {{ row.limitValue }} / {{ row.windowSeconds }}s
          </template>
        </el-table-column>
        <el-table-column prop="vipExempt" label="VIP豁免" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.vipExempt" type="success" size="small">开启</el-tag>
            <el-tag v-else type="info" size="small">关闭</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-tag', 'tag-' + row.status.toLowerCase()]">
              {{ getStatusLabel(row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'DRAFT'" type="primary" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button v-if="row.status === 'DRAFT'" type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="120px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规则类型" prop="type">
              <el-select v-model="form.type" style="width: 100%;">
                <el-option label="全局规则" value="GLOBAL" />
                <el-option label="租户级规则" value="COMBINED" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="租户等级" v-if="form.type === 'COMBINED'" prop="tenantLevel">
              <el-select v-model="form.tenantLevel" style="width: 100%;">
                <el-option label="黄金VIP" value="VIP_GOLD" />
                <el-option label="白银VIP" value="VIP_SILVER" />
                <el-option label="普通租户" value="NORMAL" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="接口分组" prop="interfaceGroupId">
              <el-select v-model="form.interfaceGroupId" placeholder="选择接口分组" style="width: 100%;">
                <el-option
                  v-for="group in interfaceGroups"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="地区" prop="regionCode">
              <el-select v-model="form.regionCode" style="width: 100%;">
                <el-option
                  v-for="region in regions"
                  :key="region.code"
                  :label="region.name"
                  :value="region.code"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="限制类型" prop="limitType">
              <el-select v-model="form.limitType" style="width: 100%;">
                <el-option label="QPS限制" value="QPS" />
                <el-option label="总量限制" value="TOTAL" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="限制值" prop="limitValue">
              <el-input-number v-model="form.limitValue" :min="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="时间窗口(秒)" prop="windowSeconds">
              <el-input-number v-model="form.windowSeconds" :min="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="优先级" prop="priority">
              <el-input-number
                v-model="form.priority"
                :min="1"
                :max="100"
                style="width: 100%;"
              />
              <div style="color: #909399; font-size: 12px;">数值越大优先级越高</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="VIP豁免" prop="vipExempt">
              <el-switch v-model="form.vipExempt" />
              <span style="margin-left: 8px; color: #909399; font-size: 12px;">
                VIP租户不受此规则限制
              </span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { rulesApi, interfaceGroupsApi, commonApi } from '../api';

const loading = ref(false);
const rules = ref([]);
const interfaceGroups = ref([]);
const regions = ref([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增规则');
const formRef = ref(null);
const editingId = ref(null);

const form = reactive({
  name: '',
  type: 'GLOBAL',
  tenantLevel: '',
  interfaceGroupId: '',
  regionCode: 'DEFAULT',
  limitType: 'QPS',
  limitValue: 100,
  windowSeconds: 60,
  priority: 50,
  vipExempt: false,
});

const formRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  interfaceGroupId: [{ required: true, message: '请选择接口分组', trigger: 'change' }],
  regionCode: [{ required: true, message: '请选择地区', trigger: 'change' }],
};

function getStatusLabel(status) {
  const map = {
    DRAFT: '草稿',
    ACTIVE: '生效中',
    PAUSED: '已暂停',
    DEPRECATED: '已弃用',
    ROLLED_BACK: '已回滚',
  };
  return map[status] || status;
}

function getTenantLevelLabel(level) {
  const map = {
    VIP_GOLD: '黄金VIP',
    VIP_SILVER: '白银VIP',
    NORMAL: '普通租户',
  };
  return map[level] || level;
}

function getRegionName(code) {
  const region = regions.value.find(r => r.code === code);
  return region ? region.name : code;
}

function getGroupName(id) {
  const group = interfaceGroups.value.find(g => g.id === id);
  return group ? group.name : id;
}

async function loadData() {
  loading.value = true;
  try {
    const [rulesRes, groupsRes, regionsRes] = await Promise.all([
      rulesApi.list(),
      interfaceGroupsApi.list(),
      commonApi.regions(),
    ]);
    rules.value = rulesRes.data || [];
    interfaceGroups.value = groupsRes.data || [];
    regions.value = regionsRes.data || [];
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
}

function handleAdd() {
  editingId.value = null;
  dialogTitle.value = '新增规则';
  Object.assign(form, {
    name: '',
    type: 'GLOBAL',
    tenantLevel: '',
    interfaceGroupId: interfaceGroups.value[0]?.id || '',
    regionCode: 'DEFAULT',
    limitType: 'QPS',
    limitValue: 100,
    windowSeconds: 60,
    priority: 50,
    vipExempt: false,
  });
  dialogVisible.value = true;
}

function handleEdit(row) {
  editingId.value = row.id;
  dialogTitle.value = '编辑规则';
  Object.assign(form, {
    name: row.name,
    type: row.type,
    tenantLevel: row.tenantLevel || '',
    interfaceGroupId: row.interfaceGroupId || '',
    regionCode: row.regionCode || 'DEFAULT',
    limitType: row.limitType,
    limitValue: row.limitValue,
    windowSeconds: row.windowSeconds,
    priority: row.priority,
    vipExempt: row.vipExempt,
  });
  dialogVisible.value = true;
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定要删除规则 "${row.name}" 吗？`, '提示', {
    type: 'warning',
  })
    .then(async () => {
      try {
        await rulesApi.delete(row.id);
        ElMessage.success('删除成功');
        loadData();
      } catch (err) {
        ElMessage.error(err.message);
      }
    })
    .catch(() => {});
}

async function handleSubmit() {
  try {
    await formRef.value.validate();
    
    if (editingId.value) {
      await rulesApi.update(editingId.value, form);
      ElMessage.success('更新成功');
    } else {
      await rulesApi.create(form);
      ElMessage.success('创建成功');
    }
    
    dialogVisible.value = false;
    loadData();
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message);
    }
  }
}

onMounted(() => {
  loadData();
});
</script>
