<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #409EFF;">{{ stats.totalOrders || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">退货单总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #E6A23C;">{{ stats.pendingOrders || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">待检数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #909399;">{{ stats.qualityDoneOrders || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">质检完成</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #67C23A;">{{ stats.disposedOrders || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">已处置</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #67C23A;">{{ stats.resellCount || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">入库二次销售</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #E6A23C;">{{ stats.repairCount || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">待维修</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #F56C6C;">{{ stats.scrapCount || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">报废</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #909399;">{{ stats.rejectCount || 0 }}</div>
            <div style="margin-top: 10px; color: #909399;">拒收</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold;">库存汇总</span>
              <el-button size="small" @click="loadStats">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <el-table :data="inventory">
            <el-table-column prop="product_name" label="商品名称" />
            <el-table-column prop="sku" label="SKU" />
            <el-table-column label="入库可售">
              <template #default="scope">
                <el-tag type="success" size="small">{{ scope.row.good_quantity }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="待维修">
              <template #default="scope">
                <el-tag type="warning" size="small">{{ scope.row.repair_quantity }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="报废">
              <template #default="scope">
                <el-tag type="danger" size="small">{{ scope.row.scrap_quantity }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="合计">
              <template #default="scope">
                <strong>{{ scope.row.total_quantity }}</strong>
              </template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="180" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span style="font-weight: bold;">快速操作</span>
          </template>
          <el-space direction="vertical" fill>
            <el-button type="primary" @click="$router.push('/orders')" style="height: 50px;">
              <el-icon><Document /></el-icon>
              前往退货单管理
            </el-button>
            <el-button type="success" @click="exportOrders" style="height: 50px;">
              <el-icon><Download /></el-icon>
              导出所有数据（含统计）
            </el-button>
            <el-button type="warning" @click="loadStats" style="height: 50px;">
              <el-icon><Refresh /></el-icon>
              刷新统计数据
            </el-button>
          </el-space>
          
          <el-alert type="info" style="margin-top: 20px;" :closable="false">
            <div style="font-weight: bold; margin-bottom: 5px;">数据一致性说明</div>
            <ul style="margin: 0; padding-left: 20px;">
              <li>所有统计数据实时从数据库读取，与列表、详情保持一致</li>
              <li>处置操作通过数据库事务确保库存和状态同步更新</li>
              <li>导出功能直接使用最新的 SQL 查询结果</li>
              <li>点击"刷新"按钮可强制重新加载所有数据</li>
            </ul>
          </el-alert>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const stats = ref({})
const inventory = ref([])

const loadStats = async () => {
  try {
    const res = await axios.get('/api/stats')
    if (res.data.success) {
      stats.value = res.data.data
    }
    const invRes = await axios.get('/api/inventory')
    if (invRes.data.success) {
      inventory.value = invRes.data.data
    }
  } catch (err) {
    console.error(err)
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

onMounted(() => {
  loadStats()
})
</script>
