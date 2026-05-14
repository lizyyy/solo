<template>
  <div class="dashboard">
    <el-row :gutter="24">
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>节点分组</span>
              <el-button type="primary" size="small" circle @click="showCreateGroup = true">
                <el-icon><Plus /></el-icon>
              </el-button>
            </div>
          </template>
          <el-menu
            :default-active="selectedGroup?.toString()"
            mode="vertical"
            @select="handleGroupSelect"
          >
            <el-menu-item v-for="group in nodeGroups" :key="group.id" :index="group.id.toString()">
              <el-icon><Monitor /></el-icon>
              <span>{{ group.name }}</span>
              <template #title>
                <span>{{ group.name }} ({{ group.node_count }}节点)</span>
              </template>
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-col>

      <el-col :span="18">
        <el-card shadow="hover" style="margin-bottom: 24px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>配置版本列表</span>
              <el-button type="primary" size="small" :disabled="!selectedGroup" @click="showCreateVersion = true">
                <el-icon><Plus /></el-icon>
                新建版本
              </el-button>
            </div>
          </template>
          <el-table :data="configVersions" style="width: 100%">
            <el-table-column prop="version" label="版本号" width="120" />
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="created_by" label="创建人" width="120" />
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="createSync(row)">
                  <el-icon><Upload /></el-icon>
                  同步配置
                </el-button>
                <el-button type="warning" size="small" @click="showRollback(row)">
                  <el-icon><RefreshLeft /></el-icon>
                  回滚
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>同步任务状态</span>
              <el-button type="primary" size="small" @click="refreshData">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <el-table :data="syncStatuses" style="width: 100%" @row-click="handleSyncRowClick">
            <el-table-column prop="request_id" label="任务ID" width="180" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="200">
              <template #default="{ row }">
                <el-progress :percentage="Math.round((row.success_nodes / row.total_nodes) * 100)" :stroke-width="12" />
              </template>
            </el-table-column>
            <el-table-column label="节点统计" width="250">
              <template #default="{ row }">
                <span style="color: #67c23a">成功: {{ row.success_nodes }}</span> /
                <span style="color: #f56c6c">失败: {{ row.failed_nodes }}</span> /
                <span style="color: #e6a23c">离线: {{ row.offline_nodes }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="created_by" label="创建人" width="100" />
            <el-table-column prop="started_at" label="开始时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.started_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="300">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click.stop="openReviewDrawer(row)">
                  <el-icon><View /></el-icon>
                  复核
                </el-button>
                <el-button type="warning" size="small" @click.stop="handleIntercept(row)" :disabled="!canIntercept(row)">
                  <el-icon><VideoPause /></el-icon>
                  拦截
                </el-button>
                <el-button type="success" size="small" @click.stop="handleCorrect(row)">
                  <el-icon><Check /></el-icon>
                  修正
                </el-button>
                <el-button type="info" size="small" @click.stop="handleExport(row)">
                  <el-icon><Download /></el-icon>
                  导出
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-drawer v-model="reviewDrawerVisible" title="同步任务复核" size="60%" direction="rtl">
      <div v-if="currentSync" class="review-content">
        <el-descriptions :column="2" border style="margin-bottom: 24px">
          <el-descriptions-item label="任务ID">{{ currentSync.request_id }}</el-descriptions-item>
          <el-descriptions-item label="同步状态">
            <el-tag :type="getStatusType(currentSync.status)">{{ getStatusText(currentSync.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="节点分组">{{ currentSync.node_group?.name }}</el-descriptions-item>
          <el-descriptions-item label="配置版本">{{ currentSync.config_version?.version }}</el-descriptions-item>
          <el-descriptions-item label="总节点数">{{ currentSync.total_nodes }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ currentSync.created_by }}</el-descriptions-item>
        </el-descriptions>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="离线节点" name="offline">
            <el-table :data="currentSync.offline_node_list" style="width: 100%">
              <el-table-column prop="node_name" label="节点名称" />
              <el-table-column prop="node_ip" label="节点IP" />
              <el-table-column prop="last_seen" label="最后在线时间">
                <template #default="{ row }">
                  {{ formatDate(row.last_seen) }}
                </template>
              </el-table-column>
              <el-table-column prop="retry_count" label="重试次数" />
              <el-table-column prop="is_resolved" label="是否解决">
                <template #default="{ row }">
                  <el-tag :type="row.is_resolved ? 'success' : 'warning'">{{ row.is_resolved ? '是' : '否' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="冲突解决" name="conflict">
            <el-table :data="currentSync.conflicts" style="width: 100%">
              <el-table-column prop="node_name" label="节点名称" />
              <el-table-column prop="current_version" label="当前版本" />
              <el-table-column prop="target_version" label="目标版本" />
              <el-table-column prop="conflict_detail" label="冲突详情" />
              <el-table-column prop="status" label="状态">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'resolved' ? 'success' : 'warning'">{{ row.status === 'resolved' ? '已解决' : '待处理' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作">
                <template #default="{ row }">
                  <el-button type="primary" size="small" @click="showResolveConflict(row)" :disabled="row.status === 'resolved'">
                    解决冲突
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="操作审计" name="audit">
            <el-table :data="currentSync.audits" style="width: 100%">
              <el-table-column prop="action" label="操作" />
              <el-table-column prop="operator" label="操作人" />
              <el-table-column prop="detail" label="详情" />
              <el-table-column prop="created_at" label="时间">
                <template #default="{ row }">
                  {{ formatDate(row.created_at) }}
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog v-model="showCreateGroup" title="创建节点分组" width="500px">
      <el-form :model="groupForm" label-width="100px">
        <el-form-item label="分组名称">
          <el-input v-model="groupForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="groupForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="节点数量">
          <el-input-number v-model="groupForm.node_count" :min="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateGroup = false">取消</el-button>
        <el-button type="primary" @click="createGroup">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreateVersion" title="创建配置版本" width="600px">
      <el-form :model="versionForm" label-width="100px">
        <el-form-item label="版本号">
          <el-input v-model="versionForm.version" placeholder="例如: v1.0.0" />
        </el-form-item>
        <el-form-item label="配置内容">
          <el-input v-model="versionForm.config_content" type="textarea" :rows="5" placeholder="JSON格式配置" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="versionForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="versionForm.created_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateVersion = false">取消</el-button>
        <el-button type="primary" @click="createVersion">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showSyncDialog" title="创建同步任务" width="500px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="配置版本">
          <el-input :value="selectedVersion?.version" disabled />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="syncForm.created_by" />
        </el-form-item>
        <el-form-item label="请求ID">
          <el-input v-model="syncForm.request_id" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSyncDialog = false">取消</el-button>
        <el-button type="primary" @click="submitSync">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRollbackDialog" title="配置回滚" width="500px">
      <el-form :model="rollbackForm" label-width="100px">
        <el-form-item label="回滚到版本">
          <el-select v-model="rollbackForm.target_version_id" placeholder="选择版本">
            <el-option v-for="v in configVersions" :key="v.id" :label="v.version" :value="v.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="rollbackForm.operator" />
        </el-form-item>
        <el-form-item label="请求ID">
          <el-input v-model="rollbackForm.request_id" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRollbackDialog = false">取消</el-button>
        <el-button type="primary" @click="submitRollback">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showInterceptDialog" title="拦截同步任务" width="500px">
      <el-form :model="interceptForm" label-width="100px">
        <el-form-item label="拦截原因">
          <el-input v-model="interceptForm.reason" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="interceptForm.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showInterceptDialog = false">取消</el-button>
        <el-button type="primary" @click="submitIntercept">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showResolveDialog" title="解决配置冲突" width="500px">
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="解决方式">
          <el-input v-model="resolveForm.resolution" type="textarea" :rows="3" placeholder="描述冲突解决方式" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="resolveForm.resolved_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showResolveDialog = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCorrectDialog" title="修正同步状态" width="500px">
      <el-form :model="correctForm" label-width="100px">
        <el-form-item label="修正说明">
          <el-input v-model="correctForm.correct_detail" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="correctForm.operator" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCorrectDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCorrect">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Monitor, Upload, RefreshLeft, Refresh, View, VideoPause, Check, Download } from '@element-plus/icons-vue'
import { nodeGroupApi, configVersionApi, syncApi, conflictApi } from '../api'

const nodeGroups = ref([])
const configVersions = ref([])
const syncStatuses = ref([])
const selectedGroup = ref(null)
const selectedVersion = ref(null)
const currentSync = ref(null)

const reviewDrawerVisible = ref(false)
const activeTab = ref('offline')

const showCreateGroup = ref(false)
const showCreateVersion = ref(false)
const showSyncDialog = ref(false)
const showRollbackDialog = ref(false)
const showInterceptDialog = ref(false)
const showResolveDialog = ref(false)
const showCorrectDialog = ref(false)

const groupForm = ref({ name: '', description: '', node_count: 5 })
const versionForm = ref({ version: '', config_content: '', description: '', created_by: '' })
const syncForm = ref({ created_by: 'admin', request_id: '' })
const rollbackForm = ref({ target_version_id: null, operator: 'admin', request_id: '' })
const interceptForm = ref({ reason: '', operator: 'admin' })
const resolveForm = ref({ resolution: '', resolved_by: 'admin' })
const correctForm = ref({ correct_detail: '', operator: 'admin' })

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = { pending: 'info', syncing: 'primary', success: 'success', failed: 'danger', conflict: 'warning', offline: 'warning' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待处理', syncing: '同步中', success: '成功', failed: '失败', conflict: '冲突', offline: '离线' }
  return map[status] || status
}

const canIntercept = (row) => {
  return ['pending', 'syncing'].includes(row.status)
}

const handleGroupSelect = (index) => {
  selectedGroup.value = parseInt(index)
  loadConfigVersions(selectedGroup.value)
  loadSyncStatuses(selectedGroup.value)
}

const loadNodeGroups = async () => {
  try {
    const res = await nodeGroupApi.list()
    nodeGroups.value = res.data
  } catch (error) {
    console.error(error)
  }
}

const loadConfigVersions = async (groupId) => {
  try {
    const res = await configVersionApi.list(groupId)
    configVersions.value = res.data
  } catch (error) {
    console.error(error)
  }
}

const loadSyncStatuses = async (groupId) => {
  try {
    const res = await syncApi.list(groupId)
    syncStatuses.value = res.data
  } catch (error) {
    console.error(error)
  }
}

const createGroup = async () => {
  try {
    await nodeGroupApi.create(groupForm.value)
    ElMessage.success('创建成功')
    showCreateGroup.value = false
    loadNodeGroups()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createVersion = async () => {
  try {
    await configVersionApi.create({ ...versionForm.value, node_group_id: selectedGroup.value })
    ElMessage.success('创建成功')
    showCreateVersion.value = false
    loadConfigVersions(selectedGroup.value)
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createSync = (version) => {
  selectedVersion.value = version
  syncForm.value.request_id = `sync_${Date.now()}`
  showSyncDialog.value = true
}

const submitSync = async () => {
  try {
    const res = await syncApi.create({
      node_group_id: selectedGroup.value,
      config_version_id: selectedVersion.value.id,
      ...syncForm.value
    })
    if (res.data.idempotent) {
      ElMessage.warning('请求已处理（幂等）')
    } else {
      ElMessage.success('同步任务创建成功')
    }
    showSyncDialog.value = false
    loadSyncStatuses(selectedGroup.value)
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const showRollback = (version) => {
  selectedVersion.value = version
  rollbackForm.value.request_id = `rollback_${Date.now()}`
  showRollbackDialog.value = true
}

const submitRollback = async () => {
  try {
    const lastSync = syncStatuses.value[0]
    if (!lastSync) {
      ElMessage.error('没有可回滚的同步任务')
      return
    }
    const res = await syncApi.rollback(lastSync.id, rollbackForm.value)
    if (res.data.idempotent) {
      ElMessage.warning('回滚请求已处理（幂等）')
    } else {
      ElMessage.success('回滚成功')
    }
    showRollbackDialog.value = false
    loadSyncStatuses(selectedGroup.value)
  } catch (error) {
    ElMessage.error('回滚失败')
  }
}

const handleIntercept = (row) => {
  currentSync.value = row
  showInterceptDialog.value = true
}

const submitIntercept = async () => {
  try {
    await syncApi.intercept(currentSync.value.id, interceptForm.value)
    ElMessage.success('拦截成功')
    showInterceptDialog.value = false
    loadSyncStatuses(selectedGroup.value)
  } catch (error) {
    ElMessage.error('拦截失败')
  }
}

const handleCorrect = (row) => {
  currentSync.value = row
  showCorrectDialog.value = true
}

const submitCorrect = async () => {
  try {
    await syncApi.correct(currentSync.value.id, correctForm.value)
    ElMessage.success('修正成功')
    showCorrectDialog.value = false
    loadSyncStatuses(selectedGroup.value)
  } catch (error) {
    ElMessage.error('修正失败')
  }
}

const handleSyncRowClick = async (row) => {
  try {
    const res = await syncApi.get(row.id)
    currentSync.value = res.data
  } catch (error) {
    currentSync.value = row
  }
}

const openReviewDrawer = async (row) => {
  try {
    const res = await syncApi.get(row.id)
    currentSync.value = res.data
  } catch (error) {
    currentSync.value = row
  }
  reviewDrawerVisible.value = true
}

const showResolveConflict = (conflict) => {
  currentSync.value.currentConflict = conflict
  showResolveDialog.value = true
}

const submitResolve = async () => {
  try {
    await conflictApi.resolve(currentSync.value.currentConflict.id, resolveForm.value)
    ElMessage.success('冲突已解决')
    showResolveDialog.value = false
    loadSyncStatuses(selectedGroup.value)
  } catch (error) {
    ElMessage.error('解决失败')
  }
}

const handleExport = (row) => {
  syncApi.export(row.id)
  ElMessage.success('开始导出')
}

const refreshData = () => {
  if (selectedGroup.value) {
    loadConfigVersions(selectedGroup.value)
    loadSyncStatuses(selectedGroup.value)
  }
}

onMounted(() => {
  loadNodeGroups()
})
</script>

<style scoped>
.dashboard {
  height: 100%;
}

.review-content {
  padding: 20px;
}
</style>
