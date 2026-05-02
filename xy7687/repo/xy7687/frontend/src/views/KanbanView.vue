<template>
  <div class="kanban-container">
    <div class="kanban-header">
      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索工单（支持姓名、手机号、工单号、设备型号）"
          style="width: 400px"
          :prefix-icon="Search"
          clearable
          @clear="loadKanban"
          @keyup.enter="loadKanban"
        />
        <el-button type="primary" :icon="Search" @click="loadKanban">搜索</el-button>
      </div>
      <div class="action-section">
        <el-button :icon="Refresh" @click="loadKanban">刷新</el-button>
        <el-dropdown @command="handleExport">
          <el-button type="warning" :icon="Download">导出CSV</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">导出全部</el-dropdown-item>
              <el-dropdown-item command="pending_inspection">导出待检测</el-dropdown-item>
              <el-dropdown-item command="quoting">导出报价中</el-dropdown-item>
              <el-dropdown-item command="repairing">导出维修中</el-dropdown-item>
              <el-dropdown-item command="pending_pickup">导出待取机</el-dropdown-item>
              <el-dropdown-item command="completed">导出已完成</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".csv"
          :on-change="handleImport"
        >
          <el-button type="success" :icon="Upload">导入CSV</el-button>
        </el-upload>
        <el-button :icon="Document" @click="downloadTemplate">下载模板</el-button>
      </div>
    </div>

    <div class="kanban-board">
      <div
        v-for="(column, status) in kanbanData"
        :key="status"
        class="kanban-column"
      >
        <div class="column-header" :style="{ background: column.color + '20', borderLeftColor: column.color }">
          <span class="column-title">{{ column.label }}</span>
          <el-tag :type="getStatusTagType(status)" size="small">
            {{ column.tickets.length }}
          </el-tag>
        </div>
        <div class="column-body">
          <div
            v-for="ticket in column.tickets"
            :key="ticket.id"
            class="ticket-card"
            @click="viewDetail(ticket.id)"
          >
            <div class="ticket-header">
              <span class="ticket-no">{{ ticket.ticket_no }}</span>
              <el-tag :type="getStatusTagType(ticket.status)" size="small">
                {{ ticket.statusLabel }}
              </el-tag>
            </div>
            <div class="ticket-content">
              <div class="ticket-row">
                <span class="label">客户:</span>
                <span class="value">{{ ticket.customer_name }}</span>
              </div>
              <div class="ticket-row">
                <span class="label">手机:</span>
                <span class="value">{{ ticket.customer_phone }}</span>
              </div>
              <div class="ticket-row">
                <span class="label">机型:</span>
                <span class="value">{{ ticket.device_model }}</span>
              </div>
              <div class="ticket-row" v-if="ticket.quote_amount > 0">
                <span class="label">报价:</span>
                <span class="value price">¥{{ ticket.quote_amount }}</span>
              </div>
              <div class="ticket-row" v-if="ticket.fault_description">
                <span class="label">故障:</span>
                <span class="value desc">{{ ticket.fault_description }}</span>
              </div>
            </div>
            <div class="ticket-footer">
              <span class="create-time">{{ ticket.created_at }}</span>
              <div class="ticket-actions">
                <el-button
                  v-if="ticket.status !== 'completed' && ticket.status !== 'cancelled'"
                  type="text"
                  size="small"
                  @click.stop="editTicket(ticket.id)"
                >
                  编辑
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-if="column.tickets.length === 0" description="暂无工单" :image-size="60" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Upload, Document } from '@element-plus/icons-vue'
import { ticketApi, csvApi } from '../api'

const router = useRouter()
const searchKeyword = ref('')
const kanbanData = ref({})

const loadKanban = async () => {
  try {
    const res = await ticketApi.getKanban(searchKeyword.value)
    kanbanData.value = res.data
  } catch (error) {
    console.error('加载看板失败:', error)
  }
}

const getStatusTagType = (status) => {
  const typeMap = {
    pending_inspection: 'warning',
    quoting: 'primary',
    repairing: 'danger',
    pending_pickup: 'info',
    completed: 'success',
    cancelled: 'info'
  }
  return typeMap[status] || 'info'
}

const viewDetail = (id) => {
  router.push(`/ticket/${id}`)
}

const editTicket = (id) => {
  router.push(`/ticket/edit/${id}`)
}

const handleExport = (command) => {
  if (command === 'all') {
    csvApi.export()
  } else {
    csvApi.export(command)
  }
  ElMessage.success('开始导出CSV文件')
}

const handleImport = async (file) => {
  try {
    await ElMessageBox.confirm(
      '导入CSV将批量创建工单，请确保文件格式正确。是否继续？',
      '确认导入',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const res = await csvApi.import(file.raw)
    ElMessage.success(res.message || '导入成功')
    loadKanban()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('导入失败:', error)
    }
  }
}

const downloadTemplate = () => {
  csvApi.downloadTemplate()
  ElMessage.success('开始下载导入模板')
}

onMounted(() => {
  loadKanban()
})
</script>

<style scoped>
.kanban-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.search-section {
  display: flex;
  gap: 12px;
}

.action-section {
  display: flex;
  gap: 12px;
}

.kanban-board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  flex: 1;
  padding-bottom: 16px;
}

.kanban-column {
  min-width: 300px;
  max-width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.column-header {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid;
}

.column-title {
  font-weight: 600;
  font-size: 15px;
}

.column-body {
  padding: 12px;
  flex: 1;
  overflow-y: auto;
  min-height: 100px;
}

.ticket-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid #e4e7ed;
}

.ticket-card:hover {
  background: #f5f7fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ticket-no {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.ticket-content {
  margin-bottom: 8px;
}

.ticket-row {
  display: flex;
  margin-bottom: 4px;
  font-size: 13px;
}

.ticket-row .label {
  color: #909399;
  min-width: 40px;
}

.ticket-row .value {
  color: #303133;
  flex: 1;
  word-break: break-all;
}

.ticket-row .value.price {
  color: #f56c6c;
  font-weight: 600;
}

.ticket-row .value.desc {
  color: #606266;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ticket-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
  font-size: 12px;
}

.create-time {
  color: #c0c4cc;
}

.ticket-actions {
  display: flex;
  gap: 8px;
}
</style>
