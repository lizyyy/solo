<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.search" placeholder="附件名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" clearable>
            <el-option label="有效" value="valid" />
            <el-option label="过期" value="expired" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAttachments">查询</el-button>
          <el-button type="success" @click="openDialog">新增附件</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <el-table :data="attachments" style="width: 100%">
        <el-table-column prop="name" label="附件名称" />
        <el-table-column prop="matter_name" label="所属事项" width="150" />
        <el-table-column prop="identity_name" label="身份类型" width="120" />
        <el-table-column prop="expire_date" label="到期日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'valid' ? 'success' : 'danger'">
              {{ row.status === 'valid' ? '有效' : '过期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="附件信息" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="附件名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="所属事项">
          <el-select v-model="form.matter_id">
            <el-option v-for="m in matters" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="身份类型">
          <el-select v-model="form.identity_type_id">
            <el-option v-for="t in types" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker v-model="form.expire_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="有效" value="valid" />
            <el-option label="过期" value="expired" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAttachment">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { attachmentsApi, mattersApi, identityApi } from '../api'
import { ElMessage } from 'element-plus'

const searchForm = ref({ search: '', status: '' })
const attachments = ref([])
const matters = ref([])
const types = ref([])
const dialogVisible = ref(false)
const form = ref({})
const editId = ref(null)

const loadAttachments = async () => {
  try {
    const res = await attachmentsApi.getAttachments(searchForm.value)
    if (res.data.success) {
      attachments.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const openDialog = (row = null) => {
  if (row) {
    editId.value = row.id
    form.value = { ...row }
  } else {
    editId.value = null
    form.value = { status: 'valid' }
  }
  dialogVisible.value = true
}

const saveAttachment = async () => {
  try {
    if (editId.value) {
      await attachmentsApi.updateAttachment(editId.value, { ...form.value, changedBy: 'admin' })
      ElMessage.success('更新成功')
    } else {
      await attachmentsApi.createAttachment(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadAttachments()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

onMounted(async () => {
  loadAttachments()
  const [mRes, tRes] = await Promise.all([mattersApi.getMatters({}), identityApi.getTypes({})])
  if (mRes.data.success) matters.value = mRes.data.data
  if (tRes.data.success) types.value = tRes.data.data
})
</script>
