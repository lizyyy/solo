<template>
  <div class="manage-view">
    <el-tabs v-model="activeTab" class="manage-tabs">
      <el-tab-pane label="桌位管理" name="tables">
        <div class="tab-toolbar">
          <el-button type="primary" @click="showTableDialog()">
            <el-icon><Plus /></el-icon>
            新增桌位
          </el-button>
        </div>
        <el-table :data="store.tables" style="width: 100%">
          <el-table-column prop="name" label="桌位名称" width="150" />
          <el-table-column prop="capacity" label="容纳人数" width="120">
            <template #default="{ row }">
              <el-tag>{{ row.capacity }}人</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="location" label="位置" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button type="primary" link @click="showTableDialog(row)">编辑</el-button>
              <el-button type="danger" link @click="deleteTable(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="剧本管理" name="scripts">
        <div class="tab-toolbar">
          <el-button type="primary" @click="showScriptDialog()">
            <el-icon><Plus /></el-icon>
            新增剧本
          </el-button>
        </div>
        <el-table :data="store.scripts" style="width: 100%">
          <el-table-column prop="name" label="剧本名称" width="180" />
          <el-table-column prop="duration_minutes" label="时长" width="100">
            <template #default="{ row }">
              {{ row.duration_minutes }}分钟
            </template>
          </el-table-column>
          <el-table-column label="人数范围" width="120">
            <template #default="{ row }">
              {{ row.min_players }}-{{ row.max_players }}人
            </template>
          </el-table-column>
          <el-table-column prop="difficulty" label="难度" width="100">
            <template #default="{ row }">
              <el-tag :type="getDifficultyType(row.difficulty)">
                {{ getDifficultyLabel(row.difficulty) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="价格" width="100">
            <template #default="{ row }">
              ¥{{ row.price }}
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button type="primary" link @click="showScriptDialog(row)">编辑</el-button>
              <el-button type="danger" link @click="deleteScript(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="主持人管理" name="hosts">
        <div class="tab-toolbar">
          <el-button type="primary" @click="showHostDialog()">
            <el-icon><Plus /></el-icon>
            新增主持人
          </el-button>
          <el-button type="warning" @click="showLeaveDialog()">
            <el-icon><Calendar /></el-icon>
            添加请假
          </el-button>
        </div>
        <el-table :data="store.hosts" style="width: 100%">
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column prop="phone" label="电话" width="140" />
          <el-table-column prop="email" label="邮箱" width="200" />
          <el-table-column prop="skills" label="擅长类型" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button type="primary" link @click="showHostDialog(row)">编辑</el-button>
              <el-button type="danger" link @click="deleteHost(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="tableDialogVisible"
      :title="currentTable ? '编辑桌位' : '新增桌位'"
      width="500px"
    >
      <el-form :model="tableForm" label-width="80px">
        <el-form-item label="桌位名称">
          <el-input v-model="tableForm.name" placeholder="请输入桌位名称" />
        </el-form-item>
        <el-form-item label="容纳人数">
          <el-input-number v-model="tableForm.capacity" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="tableForm.location" placeholder="请输入位置信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tableDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTable">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="scriptDialogVisible"
      :title="currentScript ? '编辑剧本' : '新增剧本'"
      width="600px"
    >
      <el-form :model="scriptForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="剧本名称">
              <el-input v-model="scriptForm.name" placeholder="请输入剧本名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="时长(分钟)">
              <el-input-number 
                v-model="scriptForm.duration_minutes" 
                :min="30" 
                :max="480"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最少人数">
              <el-input-number 
                v-model="scriptForm.min_players" 
                :min="1" 
                :max="20"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最多人数">
              <el-input-number 
                v-model="scriptForm.max_players" 
                :min="1" 
                :max="20"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="难度">
              <el-select v-model="scriptForm.difficulty" style="width: 100%">
                <el-option label="简单" value="easy" />
                <el-option label="中等" value="medium" />
                <el-option label="困难" value="hard" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="价格">
              <el-input-number 
                v-model="scriptForm.price" 
                :min="0" 
                :precision="2"
                style="width: 100%"
              >
                <template #prepend>¥</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述">
          <el-input 
            v-model="scriptForm.description" 
            type="textarea" 
            :rows="2"
            placeholder="请输入剧本描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scriptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveScript">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="hostDialogVisible"
      :title="currentHost ? '编辑主持人' : '新增主持人'"
      width="500px"
    >
      <el-form :model="hostForm" label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="hostForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="hostForm.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="hostForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="擅长类型">
          <el-input v-model="hostForm.skills" placeholder="如：情感本、硬核本" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="hostDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveHost">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="leaveDialogVisible"
      title="添加主持人请假"
      width="500px"
    >
      <el-form :model="leaveForm" label-width="100px">
        <el-form-item label="主持人">
          <el-select v-model="leaveForm.host_id" style="width: 100%">
            <el-option
              v-for="host in store.hosts"
              :key="host.id"
              :label="host.name"
              :value="host.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="请假日期">
          <el-date-picker
            v-model="leaveForm.leave_date"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="leaveForm.start_time"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="leaveForm.end_time"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="原因">
          <el-input 
            v-model="leaveForm.reason" 
            type="textarea" 
            :rows="2"
            placeholder="请输入请假原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="leaveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLeave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSchedulerStore } from '../stores/scheduler'
import { tablesApi, scriptsApi, hostsApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useSchedulerStore()
const activeTab = ref('tables')

const tableDialogVisible = ref(false)
const scriptDialogVisible = ref(false)
const hostDialogVisible = ref(false)
const leaveDialogVisible = ref(false)

const currentTable = ref(null)
const currentScript = ref(null)
const currentHost = ref(null)

const tableForm = ref({ name: '', capacity: 6, location: '' })
const scriptForm = ref({
  name: '', duration_minutes: 180, min_players: 4, max_players: 8,
  difficulty: 'medium', price: 128, description: ''
})
const hostForm = ref({ name: '', phone: '', email: '', skills: '' })
const leaveForm = ref({
  host_id: '', leave_date: '', start_time: '10:00', end_time: '22:00', reason: ''
})

function showTableDialog(row = null) {
  currentTable.value = row
  if (row) {
    tableForm.value = { ...row }
  } else {
    tableForm.value = { name: '', capacity: 6, location: '' }
  }
  tableDialogVisible.value = true
}

async function saveTable() {
  try {
    if (currentTable.value) {
      await tablesApi.update(currentTable.value.id, tableForm.value)
      ElMessage.success('更新成功')
    } else {
      await tablesApi.create(tableForm.value)
      ElMessage.success('创建成功')
    }
    await store.loadTables()
    tableDialogVisible.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function deleteTable(row) {
  try {
    await ElMessageBox.confirm('确定要删除该桌位吗？', '删除确认', { type: 'warning' })
    await tablesApi.delete(row.id)
    await store.loadTables()
    ElMessage.success('删除成功')
  } catch {}
}

function showScriptDialog(row = null) {
  currentScript.value = row
  if (row) {
    scriptForm.value = { ...row }
  } else {
    scriptForm.value = {
      name: '', duration_minutes: 180, min_players: 4, max_players: 8,
      difficulty: 'medium', price: 128, description: ''
    }
  }
  scriptDialogVisible.value = true
}

async function saveScript() {
  try {
    if (currentScript.value) {
      await scriptsApi.update(currentScript.value.id, scriptForm.value)
      ElMessage.success('更新成功')
    } else {
      await scriptsApi.create(scriptForm.value)
      ElMessage.success('创建成功')
    }
    await store.loadScripts()
    scriptDialogVisible.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function deleteScript(row) {
  try {
    await ElMessageBox.confirm('确定要删除该剧本吗？', '删除确认', { type: 'warning' })
    await scriptsApi.delete(row.id)
    await store.loadScripts()
    ElMessage.success('删除成功')
  } catch {}
}

function showHostDialog(row = null) {
  currentHost.value = row
  if (row) {
    hostForm.value = { ...row }
  } else {
    hostForm.value = { name: '', phone: '', email: '', skills: '' }
  }
  hostDialogVisible.value = true
}

async function saveHost() {
  try {
    if (currentHost.value) {
      await hostsApi.update(currentHost.value.id, hostForm.value)
      ElMessage.success('更新成功')
    } else {
      await hostsApi.create(hostForm.value)
      ElMessage.success('创建成功')
    }
    await store.loadHosts()
    hostDialogVisible.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function deleteHost(row) {
  try {
    await ElMessageBox.confirm('确定要删除该主持人吗？', '删除确认', { type: 'warning' })
    await hostsApi.delete(row.id)
    await store.loadHosts()
    ElMessage.success('删除成功')
  } catch {}
}

function showLeaveDialog() {
  leaveForm.value = {
    host_id: store.hosts[0]?.id || '',
    leave_date: store.selectedDate,
    start_time: '10:00',
    end_time: '22:00',
    reason: ''
  }
  leaveDialogVisible.value = true
}

async function saveLeave() {
  try {
    await hostsApi.addLeave(leaveForm.value)
    ElMessage.success('请假已添加')
    leaveDialogVisible.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

function getDifficultyType(difficulty) {
  const types = { easy: 'success', medium: 'warning', hard: 'danger' }
  return types[difficulty] || 'info'
}

function getDifficultyLabel(difficulty) {
  const labels = { easy: '简单', medium: '中等', hard: '困难' }
  return labels[difficulty] || difficulty
}

onMounted(() => {
  store.loadAll()
})
</script>

<style scoped>
.manage-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.manage-tabs {
  background: white;
  border-radius: 12px;
  padding: 20px;
}

.tab-toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}
</style>
