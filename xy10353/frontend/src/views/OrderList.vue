<template>
  <div>
    <el-card>
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
        <div>
          <el-input v-model="searchKeyword" placeholder="搜索平台单号/商品/客户" style="width: 300px; margin-right: 10px;" @keyup.enter="loadOrders" />
          <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 150px; margin-right: 10px;">
            <el-option label="待检" value="pending" />
            <el-option label="质检完成" value="quality_done" />
            <el-option label="已处置" value="disposed" />
          </el-select>
          <el-button type="primary" @click="loadOrders">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
        </div>
        <div>
          <el-button @click="showImport = true">
            <el-icon><Upload /></el-icon>
            导入
          </el-button>
          <el-button type="success" @click="showAdd = true">
            <el-icon><Plus /></el-icon>
            新增
          </el-button>
          <el-button type="warning" @click="exportOrders">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </div>

      <el-table :data="orders" style="width: 100%">
        <el-table-column prop="platform_order_no" label="平台单号" width="180" />
        <el-table-column prop="product_name" label="商品名称" />
        <el-table-column prop="product_sku" label="SKU" width="150" />
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处置方式" width="120">
          <template #default="scope">
            <span v-if="scope.row.disposition">
              <el-tag :type="getDispositionType(scope.row.disposition)" size="small">
                {{ getDispositionLabel(scope.row.disposition) }}
              </el-tag>
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button size="small" type="primary" @click="goDetail(scope.row)">
              质检/详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAdd" title="新增退货单" width="500px">
      <el-form :model="newOrder" label-width="100px">
        <el-form-item label="平台单号" required>
          <el-input v-model="newOrder.platform_order_no" placeholder="如：TM20260510001" />
        </el-form-item>
        <el-form-item label="商品名称" required>
          <el-input v-model="newOrder.product_name" placeholder="如：无线蓝牙耳机" />
        </el-form-item>
        <el-form-item label="SKU" required>
          <el-input v-model="newOrder.product_sku" placeholder="如：EAR-BT-001" />
        </el-form-item>
        <el-form-item label="退货原因">
          <el-select v-model="newOrder.return_reason" placeholder="选择退货原因">
            <el-option label="7天无理由" value="7天无理由" />
            <el-option label="质量问题" value="质量问题" />
            <el-option label="功能异常" value="功能异常" />
            <el-option label="包装破损" value="包装破损" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户姓名">
          <el-input v-model="newOrder.customer_name" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="newOrder.customer_phone" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="addOrder">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showImport" title="导入退货单" width="500px">
      <el-alert type="info" :closable="false" style="margin-bottom: 15px;">
        请上传 Excel 文件，格式：平台单号|商品名称|SKU|退货原因|客户姓名|联系电话
      </el-alert>
      <el-upload
        drag
        :auto-upload="false"
        :limit="1"
        :on-change="handleFileChange"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="showImport = false">取消</el-button>
        <el-button type="primary" @click="importOrders">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const router = useRouter()

const orders = ref([])
const searchKeyword = ref('')
const statusFilter = ref('')
const showAdd = ref(false)
const showImport = ref(false)
const selectedFile = ref(null)

const newOrder = ref({
  platform_order_no: '',
  product_name: '',
  product_sku: '',
  return_reason: '',
  customer_name: '',
  customer_phone: ''
})

const loadOrders = async () => {
  const params = {}
  if (searchKeyword.value) params.keyword = searchKeyword.value
  if (statusFilter.value) params.status = statusFilter.value

  const res = await axios.get('/api/orders', { params })
  if (res.data.success) {
    orders.value = res.data.data
  }
}

const goDetail = (row) => {
  router.push({ name: 'OrderDetail', params: { id: row.id } })
}

const addOrder = async () => {
  if (!newOrder.value.platform_order_no || !newOrder.value.product_name || !newOrder.value.product_sku) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    const res = await axios.post('/api/orders', newOrder.value)
    if (res.data.success) {
      ElMessage.success('新增成功')
      showAdd.value = false
      loadOrders()
      newOrder.value = {
        platform_order_no: '',
        product_name: '',
        product_sku: '',
        return_reason: '',
        customer_name: '',
        customer_phone: ''
      }
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '新增失败')
  }
}

const handleFileChange = (file) => {
  selectedFile.value = file.raw
}

const importOrders = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  
  try {
    const res = await axios.post('/api/orders/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (res.data.success) {
      const { imported, errors } = res.data.data
      if (errors && errors.length > 0) {
        ElMessage.warning(`导入成功${imported}条，失败${errors.length}条：\n${errors.join('\n')}`)
      } else {
        ElMessage.success(`成功导入${imported}条`)
      }
      showImport.value = false
      selectedFile.value = null
      loadOrders()
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '导入失败')
  }
}

const exportOrders = async () => {
  try {
    const res = await axios.get('/api/export/orders', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `退货单_${new Date().toISOString().slice(0,10)}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

const getStatusType = (status) => {
  const map = { pending: 'warning', quality_done: 'info', disposed: 'success' }
  return map[status] || ''
}

const getStatusLabel = (status) => {
  const map = { pending: '待检', quality_done: '质检完成', disposed: '已处置' }
  return map[status] || status
}

const getDispositionType = (disp) => {
  const map = { resell: 'success', repair: 'warning', scrap: 'danger', reject: 'info' }
  return map[disp] || ''
}

const getDispositionLabel = (disp) => {
  const map = { resell: '入库', repair: '维修', scrap: '报废', reject: '拒收' }
  return map[disp] || disp
}

onMounted(() => {
  loadOrders()
})
</script>
