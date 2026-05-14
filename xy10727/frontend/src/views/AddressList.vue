<template>
  <div class="address-list">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>地址记录列表</span>
          <div style="display: flex; gap: 10px;">
            <el-button type="warning" @click="handleRecalculate" :loading="recalculating">
              <el-icon><Refresh /></el-icon>
              重新计算(v2)
            </el-button>
            <el-button type="primary" @click="handleBatchCompare" :disabled="selectedIds.length === 0">
              <el-icon><Search /></el-icon>
              批量比对({{ selectedIds.length }})
            </el-button>
            <el-button type="success" @click="handleExport">
              <el-icon><Download /></el-icon>
              导出
            </el-button>
          </div>
        </div>
      </template>

      <div style="margin-bottom: 20px; display: flex; gap: 15px; align-items: center;">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索原始地址"
          style="width: 300px"
          clearable
          @input="fetchList"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterStatus" placeholder="选择状态" clearable @change="fetchList" style="width: 150px;">
          <el-option label="待处理" value="pending" />
          <el-option label="已匹配" value="matched" />
          <el-option label="已修正" value="corrected" />
          <el-option label="已复核" value="reviewed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-select v-model="filterFailed" placeholder="是否失败" clearable @change="fetchList" style="width: 150px;">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
        <el-button type="primary" @click="fetchList" :loading="loading">
          <el-icon><Refresh /></el-icon>
          查询
        </el-button>
      </div>

      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="original_address" label="原始地址" min-width="250" show-overflow-tooltip />
        <el-table-column prop="delivery_range" label="配送范围" width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_failed" label="是否失败" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.is_failed ? 'danger' : 'success'">
              {{ scope.row.is_failed ? '失败' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="geocoding_version" label="版本" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="goToDetail(scope.row.id)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button type="warning" link size="small" @click="goToEdit(scope.row.id)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(scope.row.id, scope.row.original_address)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Download, Refresh, View, Edit, Delete } from '@element-plus/icons-vue'
import { getAddressList, deleteAddress, batchCompare, recalculateByVersion, exportAddresses } from '@/api/address'

const router = useRouter()
const loading = ref(false)
const recalculating = ref(false)
const tableData = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const filterStatus = ref('')
const filterFailed = ref(null)
const selectedIds = ref([])

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getStatusType = (status) => {
  const typeMap = {
    pending: 'info',
    matched: 'success',
    corrected: 'warning',
    reviewed: 'success',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    pending: '待处理',
    matched: '已匹配',
    corrected: '已修正',
    reviewed: '已复核',
    failed: '失败'
  }
  return textMap[status] || status
}

const fetchList = async () => {
  loading.value = true
  try {
    const params = {
      skip: (currentPage.value - 1) * pageSize.value,
      limit: pageSize.value
    }
    if (searchKeyword.value) params.search = searchKeyword.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterFailed.value !== null && filterFailed.value !== '') params.is_failed = filterFailed.value

    const res = await getAddressList(params)
    tableData.value = res.items
    total.value = res.total
  } catch (error) {
    console.error('获取列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

const handleBatchCompare = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要对选中的 ${selectedIds.value.length} 条记录进行比对吗？`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const res = await batchCompare({ record_ids: selectedIds.value })
    ElMessage.success(`比对完成，共处理 ${res.results.length} 条记录`)
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量比对失败:', error)
    }
  }
}

const handleRecalculate = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要对v1版本的所有记录重新计算到v2版本吗？',
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    recalculating.value = true
    const res = await recalculateByVersion({ geocoding_version: 'v2' })
    ElMessage.success(`重新计算完成，共更新 ${res.updated_count} 条记录，总计 ${res.total_records} 条`)
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重新计算失败:', error)
    }
  } finally {
    recalculating.value = false
  }
}

const handleExport = async () => {
  try {
    const params = { format: 'xlsx' }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterFailed.value !== null && filterFailed.value !== '') params.is_failed = filterFailed.value
    if (selectedIds.value.length > 0) params.record_ids = selectedIds.value

    const blob = await exportAddresses(params)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `address_records_${Date.now()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
  }
}

const handleDelete = async (id, address) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除地址记录：${address}？`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error', confirmButtonClass: 'el-button--danger' }
    )
    await deleteAddress(id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

const goToDetail = (id) => {
  router.push(`/detail/${id}`)
}

const goToEdit = (id) => {
  router.push(`/edit/${id}`)
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.address-list {
  height: 100%;
}
</style>
