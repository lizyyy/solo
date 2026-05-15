<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="修复状态">
          <el-select v-model="searchForm.isFixed" clearable>
            <el-option label="未修复" :value="false" />
            <el-option label="已修复" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadExceptions">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <el-table :data="exceptions" style="width: 100%">
        <el-table-column prop="exception_type" label="异常类型" width="120" />
        <el-table-column prop="reason" label="异常原因" />
        <el-table-column prop="matter_name" label="所属事项" width="150" />
        <el-table-column prop="before_value" label="修改前值" width="150" />
        <el-table-column prop="after_value" label="修改后值" width="150" />
        <el-table-column prop="handler" label="处理人" width="100" />
        <el-table-column prop="is_fixed" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_fixed ? 'success' : 'danger'">
              {{ row.is_fixed ? '已修复' : '未修复' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="!row.is_fixed" size="small" type="primary" @click="openFixDialog(row)">修复</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="fixDialogVisible" title="修复异常" width="500px">
      <el-form :model="fixForm" label-width="100px">
        <el-form-item label="处理人">
          <el-input v-model="fixForm.handler" />
        </el-form-item>
        <el-form-item label="修改后值">
          <el-input v-model="fixForm.after_value" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fixDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="fixException">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { exceptionsApi } from '../api'
import { ElMessage } from 'element-plus'

const searchForm = ref({ isFixed: undefined })
const exceptions = ref([])
const fixDialogVisible = ref(false)
const fixForm = ref({})
const currentExceptionId = ref(null)

const loadExceptions = async () => {
  try {
    const res = await exceptionsApi.getExceptions(searchForm.value)
    if (res.data.success) {
      exceptions.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const openFixDialog = (row) => {
  currentExceptionId.value = row.id
  fixForm.value = {
    handler: '',
    after_value: ''
  }
  fixDialogVisible.value = true
}

const fixException = async () => {
  try {
    await exceptionsApi.fixException(currentExceptionId.value, fixForm.value)
    ElMessage.success('修复成功')
    fixDialogVisible.value = false
    loadExceptions()
  } catch (error) {
    ElMessage.error('修复失败')
  }
}

onMounted(() => {
  loadExceptions()
})
</script>
