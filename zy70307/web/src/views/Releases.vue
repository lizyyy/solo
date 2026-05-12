<template>
  <div>
    <div class="page-header">
      <h2>发布批次</h2>
      <el-button type="primary" @click="handleCreateRelease">
        <el-icon><Upload /></el-icon>
        创建发布批次
      </el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <div class="page-card">
          <h3 style="margin-bottom: 16px;">发布历史</h3>
          <el-table :data="releases" v-loading="loading">
            <el-table-column prop="name" label="策略名称" />
            <el-table-column prop="version" label="版本" width="120">
              <template #default="{ row }">
                <el-tag type="primary" size="small">{{ row.version }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <span :class="['status-tag', 'tag-' + row.status.toLowerCase()]">
                  {{ getStatusLabel(row.status) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="规则数量" width="100">
              <template #default="{ row }">
                {{ row.ruleIds?.length || 0 }} 条
              </template>
            </el-table-column>
            <el-table-column label="发布时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.releasedAt || row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'PENDING'"
                  type="success"
                  link
                  size="small"
                  @click="handlePublish(row)"
                >
                  发布
                </el-button>
                <el-button
                  v-if="row.status === 'ACTIVE'"
                  type="warning"
                  link
                  size="small"
                  @click="handlePause(row)"
                >
                  暂停
                </el-button>
                <el-button
                  v-if="row.status === 'ACTIVE'"
                  type="danger"
                  link
                  size="small"
                  @click="handleRollback(row)"
                >
                  回滚
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
        </div>
      </el-col>

      <el-col :span="8">
        <div class="page-card" style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">当前生效</h3>
          <el-empty v-if="!currentRelease" description="暂无激活策略" />
          <div v-else>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="策略名称">
                {{ currentRelease.name }}
              </el-descriptions-item>
              <el-descriptions-item label="版本">
                <el-tag type="success">{{ currentRelease.version }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="发布时间">
                {{ formatDate(currentRelease.releasedAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>

        <div class="page-card">
          <h3 style="margin-bottom: 16px;">可用规则</h3>
          <el-empty v-if="draftRules.length === 0" description="暂无草稿规则" />
          <div v-else>
            <div
              v-for="rule in draftRules"
              :key="rule.id"
              class="rule-card"
            >
              <div class="rule-header">
                <span class="rule-name">{{ rule.name }}</span>
                <el-tag size="small">优先级 {{ rule.priority }}</el-tag>
              </div>
              <div class="rule-meta">
                <span>{{ rule.type === 'GLOBAL' ? '全局' : '租户级' }}</span>
                <span v-if="rule.vipExempt">VIP豁免</span>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="createDialogVisible"
      title="创建发布批次"
      width="600px"
    >
      <el-form :model="releaseForm" :rules="releaseFormRules" ref="releaseFormRef" label-width="100px">
        <el-form-item label="策略名称" prop="name">
          <el-input v-model="releaseForm.name" placeholder="请输入策略名称" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="releaseForm.description"
            type="textarea"
            :rows="2"
            placeholder="请输入策略描述"
          />
        </el-form-item>
        <el-form-item label="选择规则" prop="ruleIds">
          <el-checkbox-group v-model="releaseForm.ruleIds">
            <div style="border: 1px solid #ebeef5; border-radius: 4px; padding: 12px; max-height: 300px; overflow-y: auto;">
              <div v-if="draftRules.length === 0" style="color: #909399; text-align: center; padding: 20px;">
                暂无可用的草稿规则
              </div>
              <el-checkbox
                v-for="rule in draftRules"
                :key="rule.id"
                :label="rule.id"
                style="display: block; margin: 8px 0;"
              >
                <strong>{{ rule.name }}</strong>
                <span style="color: #909399; margin-left: 8px;">
                  优先级 {{ rule.priority }}
                  <span v-if="rule.vipExempt"> | VIP豁免</span>
                </span>
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateRelease">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailDialogVisible"
      :title="`发布批次详情 - ${selectedRelease?.name || ''}`"
      width="700px"
    >
      <template v-if="selectedRelease">
        <el-descriptions :column="2" border style="margin-bottom: 20px;">
          <el-descriptions-item label="策略名称">
            {{ selectedRelease.name }}
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            <el-tag type="primary">{{ selectedRelease.version }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <span :class="['status-tag', 'tag-' + selectedRelease.status.toLowerCase()]">
              {{ getStatusLabel(selectedRelease.status) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="规则数量">
            {{ selectedRelease.ruleIds?.length || 0 }} 条
          </el-descriptions-item>
          <el-descriptions-item label="发布时间">
            {{ formatDate(selectedRelease.releasedAt) || '未发布' }}
          </el-descriptions-item>
          <el-descriptions-item label="回滚时间">
            {{ formatDate(selectedRelease.rolledBackAt) || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <h4>包含规则：</h4>
        <div
          v-for="rule in selectedReleaseRules"
          :key="rule.id"
          class="rule-card"
        >
          <div class="rule-header">
            <span class="rule-name">{{ rule.name }}</span>
            <span :class="['status-tag', 'tag-' + rule.status.toLowerCase()]">
              {{ getRuleStatusLabel(rule.status) }}
            </span>
          </div>
          <div class="rule-meta">
            <span>优先级 {{ rule.priority }}</span>
            <span>{{ rule.type === 'GLOBAL' ? '全局规则' : '租户级规则' }}</span>
            <span v-if="rule.vipExempt">VIP豁免</span>
            <span>{{ rule.limitType === 'QPS' ? 'QPS' : '总量' }}: {{ rule.limitValue }}/{{ rule.windowSeconds }}s</span>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import { releasesApi, rulesApi } from '../api';

const loading = ref(false);
const releases = ref([]);
const currentRelease = ref(null);
const allRules = ref([]);
const createDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const selectedRelease = ref(null);
const releaseFormRef = ref(null);

const releaseForm = reactive({
  name: '',
  description: '',
  ruleIds: [],
});

const releaseFormRules = {
  name: [{ required: true, message: '请输入策略名称', trigger: 'blur' }],
  ruleIds: [
    {
      validator: (rule, value, callback) => {
        if (!value || value.length === 0) {
          callback(new Error('请至少选择一条规则'));
        } else {
          callback();
        }
      },
      trigger: 'change',
    },
  ],
};

const draftRules = computed(() => {
  return allRules.value.filter(r => r.status === 'DRAFT');
});

const selectedReleaseRules = computed(() => {
  if (!selectedRelease.value) return [];
  return allRules.value.filter(r => selectedRelease.value.ruleIds?.includes(r.id));
});

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : null;
}

function getStatusLabel(status) {
  const map = {
    PENDING: '待发布',
    ACTIVE: '生效中',
    PAUSED: '已暂停',
    DEPRECATED: '已弃用',
    ROLLED_BACK: '已回滚',
  };
  return map[status] || status;
}

function getRuleStatusLabel(status) {
  const map = {
    DRAFT: '草稿',
    ACTIVE: '生效中',
    PAUSED: '已暂停',
    DEPRECATED: '已弃用',
    ROLLED_BACK: '已回滚',
  };
  return map[status] || status;
}

async function loadData() {
  loading.value = true;
  try {
    const [releasesRes, currentRes, rulesRes] = await Promise.all([
      releasesApi.list(),
      releasesApi.current(),
      rulesApi.list(),
    ]);
    releases.value = releasesRes.data?.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    ) || [];
    currentRelease.value = currentRes.data;
    allRules.value = rulesRes.data || [];
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loading.value = false;
  }
}

function handleCreateRelease() {
  if (draftRules.value.length === 0) {
    ElMessage.warning('没有可用的草稿规则，请先在规则管理中创建');
    return;
  }
  Object.assign(releaseForm, {
    name: '',
    description: '',
    ruleIds: [],
  });
  createDialogVisible.value = true;
}

async function submitCreateRelease() {
  try {
    await releaseFormRef.value.validate();
    await releasesApi.create(releaseForm);
    ElMessage.success('发布批次创建成功');
    createDialogVisible.value = false;
    loadData();
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message);
    }
  }
}

function viewDetail(row) {
  selectedRelease.value = row;
  detailDialogVisible.value = true;
}

async function handlePublish(row) {
  ElMessageBox.confirm(`确定要发布策略 "${row.name}" 吗？发布后将立即生效。`, '提示', {
    type: 'warning',
  })
    .then(async () => {
      try {
        await releasesApi.publish(row.id);
        ElMessage.success('发布成功');
        loadData();
      } catch (err) {
        ElMessage.error(err.message);
      }
    })
    .catch(() => {});
}

async function handlePause(row) {
  ElMessageBox.confirm(`确定要暂停策略 "${row.name}" 吗？暂停后所有规则将不再生效。`, '提示', {
    type: 'warning',
  })
    .then(async () => {
      try {
        await releasesApi.pause(row.id);
        ElMessage.success('已暂停');
        loadData();
      } catch (err) {
        ElMessage.error(err.message);
      }
    })
    .catch(() => {});
}

async function handleRollback(row) {
  ElMessageBox.confirm(`确定要回滚策略 "${row.name}" 吗？回滚后将恢复到上一个发布版本。`, '提示', {
    type: 'warning',
  })
    .then(async () => {
      try {
        const res = await releasesApi.rollback(row.id);
        if (res.data.previousRelease) {
          ElMessage.success(`已回滚到版本 ${res.data.previousRelease.version}`);
        } else {
          ElMessage.success('已回滚，当前无激活策略');
        }
        loadData();
      } catch (err) {
        ElMessage.error(err.message);
      }
    })
    .catch(() => {});
}

onMounted(() => {
  loadData();
});
</script>
