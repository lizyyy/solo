<template>
  <div class="record-list">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="操作类型">
          <el-select v-model="searchForm.type" placeholder="请选择" clearable>
            <el-option label="入库" value="stock_in" />
            <el-option label="开封" value="open" />
            <el-option label="领用" value="claim" />
            <el-option label="分装" value="subpackage" />
            <el-option label="归还" value="return" />
            <el-option label="报废" value="discard" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="searchForm.operator" placeholder="操作员姓名" clearable />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="试剂名称/批次号" clearable @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px;">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="typeLabel" label="操作类型" width="100">
          <template #default="scope">
            <el-tag :type="getTagType(scope.row.type)" effect="dark" size="small">
              {{ scope.row.typeLabel || scope.row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="试剂信息" min-width="180">
          <template #default="scope">
            <div v-if="scope.row.reagent">
              <div>{{ scope.row.reagent.name }}</div>
              <div class="sub-text" style="font-size: 12px; color: #909399;">
                {{ scope.row.reagent.code }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="批次号" min-width="180">
          <template #default="scope">
            <el-button link type="primary" @click="goToBatch(scope.row.batchId)">
              {{ scope.row.batch?.batchNo }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="location" label="操作地点" width="120" />
        <el-table-column prop="scanCode" label="扫码标识" width="200">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.scanCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" show-overflow-tooltip min-width="150" />
        <el-table-column prop="createdAt" label="操作时间" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecordList } from '../api/record'
import dayjs from 'dayjs'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const dateRange = ref([])

const searchForm = reactive({
  type: '',
  operator: '',
  keyword: ''
})

const operationTypeMap = {
  stock_in: 'success',
  open: 'info',
  claim: 'primary',
  subpackage: 'warning',
  return: 'info',
  discard: 'danger'
}

function getTagType(type) {
  return operationTypeMap[type] || ''
}

function formatTime(time) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

async function fetchList() {
  loading.value = true
  try {
    const params = {
      type: searchForm.type || undefined,
      operator: searchForm.operator || undefined,
      keyword: searchForm.keyword || undefined
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await getRecordList(params)
    tableData.value = res.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  fetchList()
}

function resetSearch() {
  searchForm.type = ''
  searchForm.operator = ''
  searchForm.keyword = ''
  dateRange.value = []
  fetchList()
}

function goToBatch(id) {
  if (id) {
    router.push(`/batches/${id}`)
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.search-card {
  margin-bottom: 16px;
}
</style>
