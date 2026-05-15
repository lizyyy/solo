<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" clearable placeholder="全部">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadOpinions">查询</el-button>
          <el-button type="success" @click="openDialog">新增补正意见</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px;">
      <el-table :data="opinions" style="width: 100%;">
        <el-table-column prop="matter_name" label="所属事项" width="150" />
        <el-table-column prop="attachment_name" label="关联附件" width="150" />
        <el-table-column prop="opinion" label="补正意见" min-width="200" />
        <el-table-column prop="handler" label="处理人" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handle_time" label="处理时间" width="180" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteOpinion(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="补正意见" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="所属事项">
          <el-select v-model="form.matter_id" style="width: 100%;">
            <el-option v-for="m in matters" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联附件">
          <el-select v-model="form.attachment_id" style="width: 100%;">
            <el-option v-for="a in attachments" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="补正意见">
          <el-input v-model="form.opinion" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="form.handler" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%;">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveOpinion">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { correctionOpinionsApi, mattersApi, attachmentsApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const searchForm = ref({ status: '' })
const opinions = ref([])
const matters = ref([])
const attachments = ref([])
const dialogVisible = ref(false)
const form = ref({})
const editId = ref(null)

const loadOpinions = async () => {
  try {
    const res = await correctionOpinionsApi.getOpinions(searchForm.value)
    if (res.data.success) {
      opinions.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const openDialog = (row = null) => {
  if (row) {
    editId.value = row.id
    form.value = {
      matter_id: row.matter_id,
      attachment_id: row.attachment_id,
      opinion: row.opinion,
      handler: row.handler,
      status: row.status
    }
  } else {
    editId.value = null
    form.value = { status: 'pending' }
  }
  dialogVisible.value = true
}

const saveOpinion = async () => {
  try {
    if (editId.value) {
      await correctionOpinionsApi.updateOpinion(editId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await correctionOpinionsApi.createOpinion(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadOpinions()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const deleteOpinion = async (id) => {
  try {
    await ElMessageBox.confirm('确定删除该补正意见？', '提示')
    await correctionOpinionsApi.deleteOpinion(id)
    ElMessage.success('删除成功')
    loadOpinions()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('删除失败')
  }
}

const getStatusText = (status) => {
  const map = { pending: '待处理', processing: '处理中', completed: '已完成' }
  return map[status] || status
}

const getStatusType = (status) => {
  const map = { pending: 'warning', processing: 'info', completed: 'success' }
  return map[status] || 'info'
}

onMounted(async () => {
  loadOpinions()
  const [mRes, aRes] = await Promise.all([
    mattersApi.getMatters({}),
    attachmentsApi.getAttachments({})
  ])
  if (mRes.data.success) matters.value = mRes.data.data
  if (aRes.data.success) attachments.value = aRes.data.data
})
</script>
