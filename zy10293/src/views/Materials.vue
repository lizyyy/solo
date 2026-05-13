<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>原料批次管理</span>
          <el-button type="primary" @click="openDialog">
            <el-icon><Plus /></el-icon>新增批次
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="类型">
          <el-select v-model="filters.type" placeholder="全部" clearable style="width: 120px">
            <el-option label="红茶" value="红茶" />
            <el-option label="绿茶" value="绿茶" />
            <el-option label="乌龙茶" value="乌龙茶" />
            <el-option label="普洱茶" value="普洱茶" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="名称/批次号" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="batch_no" label="批次号" width="160" />
        <el-table-column prop="name" label="原料名称" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="origin" label="产地" width="120" />
        <el-table-column label="库存" width="120">
          <template #default="{ row }">
            <span :class="{ 'low-stock': row.stock_quantity < 100 }">
              {{ row.stock_quantity }} {{ row.unit }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="purchase_date" label="采购日期" width="120" />
        <el-table-column prop="supplier" label="供应商" width="120" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="原料批次" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="批次号" required>
          <el-input v-model="form.batch_no" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="原料名称" required>
          <el-input v-model="form.name" placeholder="输入原料名称" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="红茶" value="红茶" />
            <el-option label="绿茶" value="绿茶" />
            <el-option label="乌龙茶" value="乌龙茶" />
            <el-option label="普洱茶" value="普洱茶" />
          </el-select>
        </el-form-item>
        <el-form-item label="产地">
          <el-input v-model="form.origin" placeholder="例如：福建安溪" />
        </el-form-item>
        <el-form-item label="库存数量" required>
          <el-input-number v-model="form.stock_quantity" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="form.unit" style="width: 100%">
            <el-option label="g" value="g" />
            <el-option label="kg" value="kg" />
          </el-select>
        </el-form-item>
        <el-form-item label="采购日期">
          <el-date-picker v-model="form.purchase_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="form.supplier" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { materialApi } from '../api'
import dayjs from 'dayjs'

const tableData = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)

const filters = reactive({
  type: '',
  keyword: ''
})

const form = reactive({
  id: 0,
  batch_no: '',
  name: '',
  type: '',
  origin: '',
  stock_quantity: 0,
  unit: 'g',
  purchase_date: '',
  supplier: '',
  description: ''
})

const resetFilters = () => {
  filters.type = ''
  filters.keyword = ''
  loadData()
}

const loadData = async () => {
  try {
    const res = await materialApi.list(filters)
    tableData.value = res.data
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const openDialog = (row?: any) => {
  if (row) {
    isEdit.value = true
    Object.assign(form, row)
  } else {
    isEdit.value = false
    Object.assign(form, {
      id: 0,
      batch_no: 'BAT' + dayjs().format('YYYYMMDDHHmmss'),
      name: '',
      type: '',
      origin: '',
      stock_quantity: 0,
      unit: 'g',
      purchase_date: dayjs().format('YYYY-MM-DD'),
      supplier: '',
      description: ''
    })
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.name || !form.type || !form.batch_no) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    if (isEdit.value) {
      await materialApi.update(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await materialApi.create(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '操作失败')
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.low-stock {
  color: #F56C6C;
  font-weight: 600;
}
</style>
