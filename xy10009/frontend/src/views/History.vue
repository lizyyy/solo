<template>
  <div class="history">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
        </div>
      </template>

      <div class="search-bar">
        <el-form :inline="true">
          <el-form-item label="模块">
            <el-select
              v-model="searchForm.module"
              placeholder="全部模块"
              clearable
              style="width: 150px"
              @change="loadHistory(1)"
            >
              <el-option label="用户" value="user" />
              <el-option label="仓库" value="warehouse" />
              <el-option label="商品" value="product" />
              <el-option label="库存" value="inventory" />
              <el-option label="盘点任务" value="count_task" />
              <el-option label="盘点明细" value="count_detail" />
            </el-select>
          </el-form-item>
          <el-form-item label="操作">
            <el-select
              v-model="searchForm.action"
              placeholder="全部操作"
              clearable
              style="width: 120px"
              @change="loadHistory(1)"
            >
              <el-option label="创建" value="create" />
              <el-option label="更新" value="update" />
              <el-option label="删除" value="delete" />
              <el-option label="提交" value="submit" />
              <el-option label="完成" value="complete" />
              <el-option label="取消" value="cancel" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker
              v-model="searchForm.dateRange"
              type="daterange"
              placeholder="选择日期范围"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 240px"
              @change="handleDateChange"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadHistory(1)">
              搜索
            </el-button>
            <el-button @click="resetSearch">
              重置
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="records" v-loading="loading" style="width: 100%">
        <el-table-column label="操作时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="120">
          <template #default="scope">
            {{ scope.row.changedByName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="模块" width="100">
          <template #default="scope">
            <el-tag size="small">{{ getModuleText(scope.row.module) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="scope">
            <el-tag :type="getActionType(scope.row.action)" size="small">
              {{ getActionText(scope.row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对象" width="200">
          <template #default="scope">
            {{ scope.row.entityName || scope.row.entityType || scope.row.entityId }}
          </template>
        </el-table-column>
        <el-table-column label="IP地址" width="120">
          <template #default="scope">
            {{ scope.row.ipAddress || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="备注">
          <template #default="scope">
            {{ scope.row.remark || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button
              type="primary"
              size="small"
              link
              @click="viewDetail(scope.row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadHistory"
          @current-change="loadHistory"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      title="操作详情"
      width="800px"
    >
      <el-descriptions :column="1" border v-if="currentRecord">
        <el-descriptions-item label="操作时间">
          {{ formatDate(currentRecord.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ currentRecord.changedByName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="模块">
          {{ getModuleText(currentRecord.module) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作类型">
          {{ getActionText(currentRecord.action) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作对象">
          {{ currentRecord.entityName || currentRecord.entityType }}
        </el-descriptions-item>
        <el-descriptions-item label="对象ID">
          {{ currentRecord.entityId }}
        </el-descriptions-item>
        <el-descriptions-item label="IP地址">
          {{ currentRecord.ipAddress || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="用户代理">
          {{ currentRecord.userAgent || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">
          {{ currentRecord.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      
      <el-divider content-position="left">数据变更</el-divider>
      
      <el-row :gutter="20" v-if="currentRecord">
        <el-col :span="12">
          <div class="section-title">原值</div>
          <pre class="json-display">{{ formatJson(currentRecord.oldValue) }}</pre>
        </el-col>
        <el-col :span="12">
          <div class="section-title">新值</div>
          <pre class="json-display">{{ formatJson(currentRecord.newValue) }}</pre>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { historyApi } from '@/services/api'

export default {
  name: 'History',
  setup() {
    const loading = ref(false)
    const records = ref([])
    const detailVisible = ref(false)
    const currentRecord = ref(null)
    
    const searchForm = reactive({
      module: '',
      action: '',
      dateRange: []
    })
    
    const pagination = reactive({
      page: 1,
      pageSize: 20,
      total: 0
    })
    
    const loadHistory = async (page = pagination.page) => {
      try {
        loading.value = true
        pagination.page = page
        
        const params = {
          page: pagination.page,
          pageSize: pagination.pageSize
        }
        
        if (searchForm.module) {
          params.module = searchForm.module
        }
        
        if (searchForm.action) {
          params.action = searchForm.action
        }
        
        if (searchForm.dateRange && searchForm.dateRange.length === 2) {
          params.startDate = searchForm.dateRange[0]
          params.endDate = searchForm.dateRange[1]
        }
        
        const response = await historyApi.list(params)
        records.value = response.data.records
        pagination.total = response.data.pagination.total
      } catch (error) {
        console.error('加载历史记录失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const resetSearch = () => {
      searchForm.module = ''
      searchForm.action = ''
      searchForm.dateRange = []
      loadHistory(1)
    }
    
    const handleDateChange = () => {
      loadHistory(1)
    }
    
    const viewDetail = (row) => {
      currentRecord.value = row
      detailVisible.value = true
    }
    
    const getModuleText = (module) => {
      const map = {
        user: '用户',
        warehouse: '仓库',
        product: '商品',
        inventory: '库存',
        count_task: '盘点任务',
        count_detail: '盘点明细'
      }
      return map[module] || module
    }
    
    const getActionText = (action) => {
      const map = {
        create: '创建',
        update: '更新',
        delete: '删除',
        submit: '提交',
        approve: '批准',
        reject: '拒绝',
        complete: '完成',
        cancel: '取消'
      }
      return map[action] || action
    }
    
    const getActionType = (action) => {
      const map = {
        create: 'success',
        update: 'warning',
        delete: 'danger',
        submit: 'primary',
        complete: 'success',
        cancel: 'info'
      }
      return map[action] || 'info'
    }
    
    const formatDate = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString('zh-CN')
    }
    
    const formatJson = (obj) => {
      if (!obj) return '-'
      try {
        return JSON.stringify(obj, null, 2)
      } catch {
        return JSON.stringify(obj)
      }
    }
    
    onMounted(() => {
      loadHistory()
    })
    
    return {
      loading,
      records,
      detailVisible,
      currentRecord,
      searchForm,
      pagination,
      loadHistory,
      resetSearch,
      handleDateChange,
      viewDetail,
      getModuleText,
      getActionText,
      getActionType,
      formatDate,
      formatJson
    }
  }
}
</script>

<style scoped>
.history {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-bar {
  margin-bottom: 20px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.section-title {
  font-weight: bold;
  margin-bottom: 10px;
  color: #606266;
}

.json-display {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  max-height: 400px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
</style>
