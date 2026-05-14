<template>
  <div class="duty-reports">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>值班报告</span>
          <el-button type="primary" @click="openAddDialog">新增报告</el-button>
        </div>
      </template>

      <el-table :data="reports" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="reporter" label="报告人" width="120" />
        <el-table-column prop="report_time" label="报告时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.report_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="report_content" label="报告内容" min-width="250">
          <template #default="{ row }">
            <el-popover placement="top-start" width="400" trigger="hover">
              <template #reference>
                <span>{{ truncateText(row.report_content, 50) }}</span>
              </template>
              <pre style="white-space: pre-wrap; margin: 0">{{ row.report_content }}</pre>
            </el-popover>
          </template>
        </el-table-column>
        <el-table-column prop="handle_status" label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.handle_status === 'pending' ? 'warning' : 'success'">
              {{ row.handle_status === 'pending' ? '待处理' : '已处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" width="120" />
        <el-table-column prop="handle_time" label="处理时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.handle_time) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.handle_status === 'pending'"
              link
              type="success"
              @click="openHandleDialog(row)"
            >
              处理
            </el-button>
            <el-button
              v-else
              link
              type="primary"
              @click="viewDetail(row)"
            >
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addDialogVisible" title="新增值班报告" width="600px">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="报告人">
          <el-input v-model="addForm.reporter" placeholder="请输入报告人姓名" />
        </el-form-item>
        <el-form-item label="报告内容">
          <el-input
            v-model="addForm.report_content"
            type="textarea"
            :rows="6"
            placeholder="请输入报告内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdd">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="handleDialogVisible" title="处理值班报告" width="600px">
      <el-descriptions :column="1" border style="margin-bottom: 20px">
        <el-descriptions-item label="报告人">
          {{ currentReport?.reporter }}
        </el-descriptions-item>
        <el-descriptions-item label="报告时间">
          {{ formatDate(currentReport?.report_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="报告内容">
          <pre style="white-space: pre-wrap; margin: 0">{{ currentReport?.report_content }}</pre>
        </el-descriptions-item>
      </el-descriptions>
      <el-form :model="handleForm" label-width="100px">
        <el-form-item label="处理人">
          <el-input v-model="handleForm.handler" placeholder="请输入处理人姓名" />
        </el-form-item>
        <el-form-item label="处理意见">
          <el-input
            v-model="handleForm.handle_comment"
            type="textarea"
            :rows="4"
            placeholder="请输入处理意见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确认处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="报告详情" width="600px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="报告人">
          {{ currentReport?.reporter }}
        </el-descriptions-item>
        <el-descriptions-item label="报告时间">
          {{ formatDate(currentReport?.report_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="报告内容">
          <pre style="white-space: pre-wrap; margin: 0">{{ currentReport?.report_content }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="处理状态">
          <el-tag :type="currentReport?.handle_status === 'pending' ? 'warning' : 'success'">
            {{ currentReport?.handle_status === 'pending' ? '待处理' : '已处理' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="处理人" v-if="currentReport?.handler">
          {{ currentReport?.handler }}
        </el-descriptions-item>
        <el-descriptions-item label="处理时间" v-if="currentReport?.handle_time">
          {{ formatDate(currentReport?.handle_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="处理意见" v-if="currentReport?.handle_comment">
          <pre style="white-space: pre-wrap; margin: 0">{{ currentReport?.handle_comment }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { dutyReportAPI } from '@/api'

const reports = ref([])
const addDialogVisible = ref(false)
const handleDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const currentReport = ref(null)

const addForm = reactive({
  reporter: '',
  report_content: ''
})

const handleForm = reactive({
  handler: '',
  handle_comment: '',
  handle_status: 'handled'
})

const loadReports = async () => {
  try {
    const res = await dutyReportAPI.getReports()
    reports.value = res.data
  } catch (e) {
    ElMessage.error('加载值班报告失败')
  }
}

const openAddDialog = () => {
  Object.assign(addForm, {
    reporter: '',
    report_content: ''
  })
  addDialogVisible.value = true
}

const openHandleDialog = (row) => {
  currentReport.value = row
  Object.assign(handleForm, {
    handler: '',
    handle_comment: '',
    handle_status: 'handled'
  })
  handleDialogVisible.value = true
}

const viewDetail = (row) => {
  currentReport.value = row
  detailDialogVisible.value = true
}

const submitAdd = async () => {
  if (!addForm.reporter) {
    ElMessage.warning('请输入报告人姓名')
    return
  }
  if (!addForm.report_content) {
    ElMessage.warning('请输入报告内容')
    return
  }

  try {
    await dutyReportAPI.createReport(addForm)
    ElMessage.success('报告提交成功')
    addDialogVisible.value = false
    loadReports()
  } catch (e) {
    ElMessage.error('报告提交失败')
  }
}

const submitHandle = async () => {
  if (!handleForm.handler) {
    ElMessage.warning('请输入处理人姓名')
    return
  }

  try {
    await dutyReportAPI.handleReport(currentReport.value.id, handleForm)
    ElMessage.success('处理成功')
    handleDialogVisible.value = false
    loadReports()
  } catch (e) {
    ElMessage.error('处理失败')
  }
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.duty-reports {
  height: 100%;
}
</style>
