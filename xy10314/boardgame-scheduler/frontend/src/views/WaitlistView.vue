<template>
  <div class="waitlist-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="handleDateChange"
        />
        <el-button type="primary" @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-button type="success" @click="handleAddWaitlist">
          <el-icon><Plus /></el-icon>
          添加候补
        </el-button>
      </div>
    </div>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="12">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fff7e6">
              <el-icon size="32" color="#fa8c16"><UserFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ store.waitlist.length }}</div>
              <div class="stat-label">候补排队人数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e6f7ff">
              <el-icon size="32" color="#1890ff"><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ topScript }}</div>
              <div class="stat-label">最热门剧本</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="waitlist-card" shadow="hover">
      <template #header>
        <span>候补队列 - {{ selectedDate }}</span>
      </template>

      <el-table
        v-loading="store.loading"
        :data="store.waitlist"
        style="width: 100%"
        row-key="id"
      >
        <el-table-column
          type="index"
          label="序号"
          width="60"
        />
        <el-table-column
          prop="priority"
          label="优先级"
          width="80"
        >
          <template #default="{ row }">
            <el-tag v-if="row.priority > 0" type="warning" effect="dark">
              高优
            </el-tag>
            <el-tag v-else type="info">
              普通
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="customer_name"
          label="顾客姓名"
          width="120"
        />
        <el-table-column
          prop="customer_phone"
          label="联系电话"
          width="140"
        />
        <el-table-column
          prop="script_name"
          label="目标剧本"
          width="200"
        />
        <el-table-column
          prop="start_time"
          label="期望时间"
          width="100"
        />
        <el-table-column
          prop="player_count"
          label="人数"
          width="80"
        />
        <el-table-column
          label="操作"
          width="240"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="handleConvert(row)"
            >
              <el-icon><Check /></el-icon>
              转正
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleDelete(row)"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="store.waitlist.length === 0" description="暂无候补记录" />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      title="添加候补"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="waitlistForm"
        :rules="waitlistRules"
        label-width="100px"
      >
        <el-form-item label="顾客姓名" prop="customer_name">
          <el-input v-model="waitlistForm.customer_name" placeholder="请输入顾客姓名" />
        </el-form-item>
        <el-form-item label="联系电话" prop="customer_phone">
          <el-input v-model="waitlistForm.customer_phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="目标剧本" prop="script_id">
          <el-select 
            v-model="waitlistForm.script_id" 
            placeholder="请选择剧本"
            style="width: 100%"
          >
            <el-option
              v-for="script in store.scripts"
              :key="script.id"
              :label="`${script.name} (${script.min_players}-${script.max_players}人)`"
              :value="script.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="期望日期" prop="date">
          <el-date-picker
            v-model="waitlistForm.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="期望时间" prop="start_time">
          <el-time-picker
            v-model="waitlistForm.start_time"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="人数" prop="player_count">
          <el-input-number 
            v-model="waitlistForm.player_count" 
            :min="1" 
            :max="20"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="优先级">
          <el-switch
            v-model="waitlistForm.priority"
            :active-value="1"
            :inactive-value="0"
            active-text="高优先级"
            inactive-text="普通"
          />
        </el-form-item>
        <el-form-item label="幂等键">
          <el-input
            v-model="idempotencyKey"
            placeholder="用于重复操作去重"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveWaitlist">
          确认添加
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="convertDialogVisible"
      title="候补转正"
      width="500px"
    >
      <div v-if="currentWaitlist" class="convert-info">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="顾客">
            {{ currentWaitlist.customer_name }}
          </el-descriptions-item>
          <el-descriptions-item label="电话">
            {{ currentWaitlist.customer_phone }}
          </el-descriptions-item>
          <el-descriptions-item label="剧本">
            {{ currentWaitlist.script_name }}
          </el-descriptions-item>
          <el-descriptions-item label="人数">
            {{ currentWaitlist.player_count }}人
          </el-descriptions-item>
        </el-descriptions>

        <el-form
          ref="convertFormRef"
          :model="convertForm"
          :rules="convertRules"
          label-width="100px"
          style="margin-top: 20px"
        >
          <el-form-item label="分配桌位" prop="table_id">
            <el-select 
              v-model="convertForm.table_id" 
              placeholder="请选择桌位"
              style="width: 100%"
            >
              <el-option
                v-for="table in store.tables"
                :key="table.id"
                :label="`${table.name} (容纳${table.capacity}人)`"
                :value="table.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="主持人">
            <el-select 
              v-model="convertForm.host_id" 
              placeholder="请选择主持人"
              clearable
              style="width: 100%"
            >
              <el-option
                v-for="host in store.hosts"
                :key="host.id"
                :label="host.name"
                :value="host.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="幂等键">
            <el-input
              v-model="convertIdempotencyKey"
              placeholder="用于重复操作去重"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="convertDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="converting" @click="handleConvertConfirm">
          确认转正
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSchedulerStore } from '../stores/scheduler'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useSchedulerStore()
const selectedDate = ref(store.selectedDate)
const dialogVisible = ref(false)
const convertDialogVisible = ref(false)
const currentWaitlist = ref(null)
const saving = ref(false)
const converting = ref(false)
const formRef = ref(null)
const convertFormRef = ref(null)
const idempotencyKey = ref('')
const convertIdempotencyKey = ref('')

const waitlistForm = ref({
  customer_name: '',
  customer_phone: '',
  script_id: '',
  date: '',
  start_time: '14:00',
  player_count: 1,
  priority: 0
})

const convertForm = ref({
  table_id: '',
  host_id: ''
})

const waitlistRules = {
  customer_name: [{ required: true, message: '请输入顾客姓名', trigger: 'blur' }],
  customer_phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  script_id: [{ required: true, message: '请选择剧本', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  start_time: [{ required: true, message: '请选择时间', trigger: 'change' }],
  player_count: [{ required: true, message: '请输入人数', trigger: 'blur' }]
}

const convertRules = {
  table_id: [{ required: true, message: '请选择桌位', trigger: 'change' }]
}

const topScript = computed(() => {
  if (store.waitlist.length === 0) return '-'
  const counts = {}
  store.waitlist.forEach(w => {
    counts[w.script_name] = (counts[w.script_name] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return entries[0] ? entries[0][0] : '-'
})

function handleDateChange() {
  store.selectedDate = selectedDate.value
  store.loadWaitlist()
}

function handleRefresh() {
  store.loadWaitlist()
}

function handleAddWaitlist() {
  waitlistForm.value = {
    customer_name: '',
    customer_phone: '',
    script_id: '',
    date: selectedDate.value,
    start_time: '14:00',
    player_count: 1,
    priority: 0
  }
  idempotencyKey.value = ''
  dialogVisible.value = true
}

async function handleSaveWaitlist() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    await store.addToWaitlist(waitlistForm.value, idempotencyKey.value || undefined)
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    saving.value = false
  }
}

function handleConvert(row) {
  currentWaitlist.value = row
  convertForm.value = {
    table_id: '',
    host_id: ''
  }
  convertIdempotencyKey.value = ''
  convertDialogVisible.value = true
}

async function handleConvertConfirm() {
  try {
    await convertFormRef.value.validate()
  } catch {
    return
  }

  converting.value = true
  try {
    const data = {
      table_id: convertForm.value.table_id,
      host_id: convertForm.value.host_id || undefined,
      date: currentWaitlist.value.date,
      start_time: currentWaitlist.value.start_time,
      player_count: currentWaitlist.value.player_count,
      script_id: currentWaitlist.value.script_id
    }
    await store.convertWaitlist(currentWaitlist.value.id, data, convertIdempotencyKey.value || undefined)
    convertDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    converting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${row.customer_name} 的候补记录吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await store.waitlist.length
    store.loadWaitlist()
    ElMessage.success('已删除')
  } catch {
  }
}

onMounted(() => {
  store.loadWaitlist()
})
</script>

<style scoped>
.waitlist-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left, .toolbar-right {
  display: flex;
  gap: 12px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  border-radius: 12px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.waitlist-card {
  border-radius: 12px;
}

.convert-info {
  padding: 10px 0;
}
</style>
