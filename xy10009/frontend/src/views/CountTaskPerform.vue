<template>
  <div class="count-task-perform">
    <el-card class="header-card">
      <div class="task-header">
        <div class="task-info">
          <h2>{{ task?.name }}</h2>
          <div class="task-meta">
            <el-tag :type="getStatusType(task?.status)">
              {{ getStatusText(task?.status) }}
            </el-tag>
            <span>任务编号: {{ task?.taskNo }}</span>
            <span>仓库: {{ task?.Warehouse?.name }}</span>
          </div>
        </div>
        <div class="task-actions">
          <el-button @click="goBack">
            返回
          </el-button>
          <el-button 
            v-if="isOnline" 
            type="primary" 
            @click="syncAllCounts"
            :loading="syncing"
          >
            同步数据
          </el-button>
          <el-button 
            type="success" 
            @click="completeTask"
            :disabled="pendingCount > 0"
            :loading="completing"
          >
            完成盘点
          </el-button>
        </div>
      </div>
      
      <div class="progress-bar">
        <div class="progress-info">
          <span>盘点进度: {{ progress }}%</span>
          <span>已完成 {{ countedCount }} / {{ totalCount }}</span>
        </div>
        <el-progress 
          :percentage="progress" 
          :status="pendingCount > 0 ? 'exception' : 'success'"
        />
      </div>
    </el-card>

    <el-card v-loading="loading">
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索商品编码、名称或条码"
          style="width: 300px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-select
          v-model="filterStatus"
          placeholder="状态筛选"
          style="width: 150px"
          clearable
        >
          <el-option label="待盘点" value="pending" />
          <el-option label="已盘点" value="counted" />
        </el-select>
      </div>

      <el-table
        :data="filteredDetails"
        style="width: 100%"
        row-key="id"
      >
        <el-table-column prop="Product.code" label="商品编码" width="130" />
        <el-table-column prop="Product.name" label="商品名称" />
        <el-table-column prop="Product.specification" label="规格" width="120" />
        <el-table-column prop="Product.unit" label="单位" width="60" />
        <el-table-column label="系统数量" width="100">
          <template #default="scope">
            {{ formatNumber(scope.row.systemQuantity) }}
          </template>
        </el-table-column>
        <el-table-column label="盘点数量" width="150">
          <template #default="scope">
            <div class="count-input-group">
              <el-button
                size="small"
                circle
                @click="decrementQuantity(scope.row)"
              >
                -
              </el-button>
              <el-input-number
                v-model="scope.row.countQuantity"
                :min="0"
                :precision="2"
                size="small"
                :controls="false"
                style="width: 80px"
                @change="handleQuantityChange(scope.row)"
              />
              <el-button
                size="small"
                circle
                @click="incrementQuantity(scope.row)"
              >
                +
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="差异数量" width="100">
          <template #default="scope">
            <span
              :class="{
                'positive': parseFloat(scope.row.differenceQuantity) > 0,
                'negative': parseFloat(scope.row.differenceQuantity) < 0
              }"
            >
              {{ formatNumber(scope.row.differenceQuantity) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="scope">
            <el-tag 
              :type="scope.row.countStatus === 'counted' ? 'success' : 'info'"
              size="small"
            >
              {{ scope.row.countStatus === 'counted' ? '已盘点' : '待盘点' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="本地状态" width="80">
          <template #default="scope">
            <el-tag 
              :type="getLocalStatusType(scope.row)"
              size="small"
            >
              {{ getLocalStatusText(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="quick-count-card" v-if="task?.status === 'in_progress'">
      <h3>快速录入</h3>
      <div class="quick-count-form">
        <el-input
          ref="barcodeInput"
          v-model="barcodeInput"
          placeholder="扫码或输入商品条码/编码"
          style="width: 200px"
          @keyup.enter="handleBarcodeSubmit"
        />
        <el-input-number
          v-model="quickCountQuantity"
          :min="0"
          :precision="2"
          :controls="false"
          style="width: 100px"
          @keyup.enter="handleBarcodeSubmit"
        />
        <el-button type="primary" @click="handleBarcodeSubmit">
          录入
        </el-button>
      </div>
      
      <div v-if="recentScannedProduct" class="scanned-info">
        <el-alert
          :title="`已录入: ${recentScannedProduct.name} - ${recentScannedProduct.quantity}`"
          type="success"
          :closable="false"
          show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { countTaskApi } from '@/services/api'
import offlineStorage from '@/services/offlineStorage'
import syncService from '@/services/syncService'

export default {
  name: 'CountTaskPerform',
  components: {
    Search
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const store = useStore()
    
    const task = ref(null)
    const details = ref([])
    const localCountsMap = ref({})
    
    const loading = ref(false)
    const syncing = ref(false)
    const completing = ref(false)
    
    const searchKeyword = ref('')
    const filterStatus = ref('')
    
    const barcodeInput = ref('')
    const quickCountQuantity = ref(1)
    const recentScannedProduct = ref(null)
    const barcodeInputEl = ref(null)
    
    const isOnline = computed(() => store.state.isOnline)
    
    const totalCount = computed(() => details.value.length)
    const countedCount = computed(() => 
      details.value.filter(d => d.countStatus === 'counted').length
    )
    const pendingCount = computed(() => 
      details.value.filter(d => d.countStatus === 'pending').length
    )
    const progress = computed(() => 
      totalCount.value > 0 
        ? Math.round(countedCount.value / totalCount.value * 100) 
        : 0
    )
    
    const filteredDetails = computed(() => {
      let result = details.value
      
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        result = result.filter(d => 
          d.Product?.code?.toLowerCase().includes(keyword) ||
          d.Product?.name?.toLowerCase().includes(keyword) ||
          d.Product?.barcode?.toLowerCase().includes(keyword)
        )
      }
      
      if (filterStatus.value) {
        result = result.filter(d => d.countStatus === filterStatus.value)
      }
      
      return result
    })
    
    const loadTask = async () => {
      try {
        loading.value = true
        const response = await countTaskApi.get(route.params.id)
        task.value = response.data
        details.value = response.data.CountDetails || []
        
        await loadLocalCounts()
      } catch (error) {
        console.error('加载任务失败:', error)
        ElMessage.error('加载任务失败')
      } finally {
        loading.value = false
      }
    }
    
    const loadLocalCounts = async () => {
      const localCounts = await offlineStorage.getLocalCountsByTask(route.params.id)
      
      localCountsMap.value = {}
      localCounts.forEach(count => {
        localCountsMap.value[count.id] = count
      })
      
      details.value.forEach(detail => {
        const localCount = localCountsMap.value[detail.id]
        if (localCount && localCount.updatedAt > detail.updatedAt) {
          detail.countQuantity = localCount.countQuantity
          detail.differenceQuantity = localCount.countQuantity - parseFloat(detail.systemQuantity)
          detail.countStatus = 'counted'
        }
      })
    }
    
    const saveCount = async (detail) => {
      await offlineStorage.saveLocalCount({
        id: detail.id,
        taskId: task.value.id,
        productId: detail.productId,
        countQuantity: detail.countQuantity,
        version: detail.version,
        remark: detail.remark || null
      })
      
      localCountsMap.value[detail.id] = {
        id: detail.id,
        countQuantity: detail.countQuantity,
        synced: false,
        updatedAt: new Date().toISOString()
      }
    }
    
    const incrementQuantity = (row) => {
      row.countQuantity = parseFloat(row.countQuantity) + 1
      handleQuantityChange(row)
    }
    
    const decrementQuantity = (row) => {
      if (row.countQuantity > 0) {
        row.countQuantity = parseFloat(row.countQuantity) - 1
        handleQuantityChange(row)
      }
    }
    
    const handleQuantityChange = (row) => {
      const systemQty = parseFloat(row.systemQuantity)
      const countQty = parseFloat(row.countQuantity)
      
      row.differenceQuantity = countQty - systemQty
      row.countStatus = countQty > 0 ? 'counted' : 'pending'
      
      saveCount(row)
    }
    
    const handleBarcodeSubmit = async () => {
      if (!barcodeInput.value) return
      
      const found = details.value.find(d => 
        d.Product?.code === barcodeInput.value ||
        d.Product?.barcode === barcodeInput.value
      )
      
      if (found) {
        found.countQuantity = quickCountQuantity.value
        handleQuantityChange(found)
        
        recentScannedProduct.value = {
          name: found.Product.name,
          quantity: quickCountQuantity.value
        }
        
        barcodeInput.value = ''
        quickCountQuantity.value = 1
        
        nextTick(() => {
          barcodeInputEl.value?.focus()
        })
      } else {
        ElMessage.warning('未找到该商品')
      }
    }
    
    const syncAllCounts = async () => {
      try {
        syncing.value = true
        
        await syncService.trySync()
        
        await loadTask()
        
        ElMessage.success('同步完成')
      } catch (error) {
        console.error('同步失败:', error)
        ElMessage.error('同步失败')
      } finally {
        syncing.value = false
      }
    }
    
    const completeTask = async () => {
      try {
        await ElMessageBox.confirm(
          '确定要完成盘点吗？完成后将自动同步所有数据并更新库存。',
          '提示',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        if (isOnline.value) {
          await syncAllCounts()
        }
        
        if (!isOnline.value) {
          await syncService.queueTaskAction('completeTask', {
            taskId: task.value.id,
            data: { version: task.value.version }
          })
          ElMessage.success('盘点已保存到本地，联网后将自动提交')
          router.push('/count-tasks')
          return
        }
        
        completing.value = true
        await countTaskApi.complete(task.value.id, { version: task.value.version })
        
        ElMessage.success('盘点完成')
        router.push('/count-tasks')
      } catch (error) {
        if (error !== 'cancel') {
          console.error('完成盘点失败:', error)
        }
      } finally {
        completing.value = false
      }
    }
    
    const goBack = () => {
      router.push(`/count-tasks/${route.params.id}`)
    }
    
    const getStatusType = (status) => {
      const map = {
        draft: 'info',
        in_progress: 'warning',
        completed: 'success',
        cancelled: 'danger'
      }
      return map[status] || 'info'
    }
    
    const getStatusText = (status) => {
      const map = {
        draft: '草稿',
        in_progress: '进行中',
        completed: '已完成',
        cancelled: '已取消'
      }
      return map[status] || status
    }
    
    const getLocalStatusType = (detail) => {
      const local = localCountsMap.value[detail.id]
      if (!local || local.synced) return 'info'
      return 'warning'
    }
    
    const getLocalStatusText = (detail) => {
      const local = localCountsMap.value[detail.id]
      if (!local) return '无本地数据'
      if (local.synced) return '已同步'
      return '待同步'
    }
    
    const formatNumber = (num) => {
      const n = parseFloat(num)
      if (isNaN(n)) return '0'
      return n.toFixed(2)
    }
    
    onMounted(() => {
      loadTask()
      
      window.addEventListener('online', handleOnline)
    })
    
    const handleOnline = async () => {
      ElMessage.info('网络已连接，自动同步中...')
      await syncAllCounts()
    }
    
    watch(isOnline, (newVal) => {
      if (newVal) {
        handleOnline()
      }
    })
    
    return {
      task,
      details,
      localCountsMap,
      loading,
      syncing,
      completing,
      searchKeyword,
      filterStatus,
      barcodeInput,
      quickCountQuantity,
      recentScannedProduct,
      barcodeInputEl,
      isOnline,
      totalCount,
      countedCount,
      pendingCount,
      progress,
      filteredDetails,
      incrementQuantity,
      decrementQuantity,
      handleQuantityChange,
      handleBarcodeSubmit,
      syncAllCounts,
      completeTask,
      goBack,
      getStatusType,
      getStatusText,
      getLocalStatusType,
      getLocalStatusText,
      formatNumber,
      Search
    }
  }
}
</script>

<style scoped>
.count-task-perform {
  padding: 0;
}

.header-card {
  margin-bottom: 20px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.task-info h2 {
  margin: 0 0 10px 0;
  font-size: 20px;
}

.task-meta {
  display: flex;
  gap: 15px;
  align-items: center;
  font-size: 14px;
  color: #606266;
}

.task-actions {
  display: flex;
  gap: 10px;
}

.progress-bar {
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}

.search-bar {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.count-input-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.positive {
  color: #67c23a;
  font-weight: bold;
}

.negative {
  color: #f56c6c;
  font-weight: bold;
}

.quick-count-card {
  margin-top: 20px;
}

.quick-count-card h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.quick-count-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.scanned-info {
  margin-top: 15px;
}
</style>
