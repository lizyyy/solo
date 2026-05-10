<template>
  <div>
    <el-button @click="goBack" style="margin-bottom: 15px;">
      <el-icon><ArrowLeft /></el-icon>
      返回列表
    </el-button>

    <el-card v-if="order" style="margin-bottom: 15px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold;">退货单信息</span>
          <div>
            <el-tag :type="getStatusType(order.status)" style="margin-right: 10px;">
              {{ getStatusLabel(order.status) }}
            </el-tag>
            <el-tag v-if="order.disposition" :type="getDispositionType(order.disposition)">
              {{ getDispositionLabel(order.disposition) }}
            </el-tag>
          </div>
        </div>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="平台单号">{{ order.platform_order_no }}</el-descriptions-item>
        <el-descriptions-item label="商品名称">{{ order.product_name }}</el-descriptions-item>
        <el-descriptions-item label="SKU">{{ order.product_sku }}</el-descriptions-item>
        <el-descriptions-item label="退货原因">{{ order.return_reason }}</el-descriptions-item>
        <el-descriptions-item label="客户姓名">{{ order.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ order.customer_phone }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ order.created_at }}</el-descriptions-item>
        <el-descriptions-item label="处置时间">{{ order.disposed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ order.notes }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-bottom: 15px;">
      <template #header>
        <span style="font-weight: bold;">质检录入</span>
      </template>
      <el-form :model="quality" label-width="120px" :disabled="!!order?.disposition">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="外观检查" required>
              <el-select v-model="quality.appearance" placeholder="请选择" style="width: 150px; margin-right: 10px;">
                <el-option label="完好" value="good" />
                <el-option label="轻微划痕" value="minor" />
                <el-option label="严重损坏" value="severe" />
              </el-select>
              <el-input v-model="quality.appearance_notes" placeholder="备注（可选）" style="width: 200px;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配件检查" required>
              <el-select v-model="quality.accessories" placeholder="请选择" style="width: 150px; margin-right: 10px;">
                <el-option label="齐全" value="complete" />
                <el-option label="部分缺失" value="partial" />
                <el-option label="严重缺失" value="missing" />
              </el-select>
              <el-input v-model="quality.accessories_notes" placeholder="备注（可选）" style="width: 200px;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="包装检查" required>
              <el-select v-model="quality.packaging" placeholder="请选择" style="width: 150px; margin-right: 10px;">
                <el-option label="完好" value="good" />
                <el-option label="轻微破损" value="minor" />
                <el-option label="严重破损" value="severe" />
              </el-select>
              <el-input v-model="quality.packaging_notes" placeholder="备注（可选）" style="width: 200px;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="功能测试" required>
              <el-select v-model="quality.function_test" placeholder="请选择" style="width: 150px; margin-right: 10px;">
                <el-option label="正常" value="normal" />
                <el-option label="部分异常" value="partial" />
                <el-option label="无法使用" value="failed" />
              </el-select>
              <el-input v-model="quality.function_test_notes" placeholder="备注（可选）" style="width: 200px;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="整体结果">
              <el-select v-model="quality.overall_result" placeholder="请选择" style="width: 150px; margin-right: 10px;">
                <el-option label="良品" value="good" />
                <el-option label="瑕疵品" value="defect" />
                <el-option label="不良品" value="bad" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="质检员">
              <el-input v-model="quality.inspector" placeholder="请输入" style="width: 200px;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="saveQuality" :disabled="!!order?.disposition">
            <el-icon><Check /></el-icon>
            保存质检
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <span style="font-weight: bold;">处置决策</span>
      </template>
      <el-alert 
        v-if="order?.disposition" 
        :type="getAlertType(order.disposition)" 
        style="margin-bottom: 15px;"
      >
        该退货单已处置：<strong>{{ getDispositionLabel(order.disposition) }}</strong>。处置时间：{{ order.disposed_at }}
      </el-alert>
      <el-alert 
        v-else-if="order?.status === 'pending'" 
        type="warning" 
        style="margin-bottom: 15px;"
      >
        请先完成质检录入并保存，再进行处置。
      </el-alert>
      <div v-if="!order?.disposition && order?.status !== 'pending'" style="display: flex; gap: 15px;">
        <el-button type="success" size="large" @click="dispose('resell')">
          <el-icon><CircleCheck /></el-icon>
          入库二次销售
        </el-button>
        <el-button type="warning" size="large" @click="dispose('repair')">
          <el-icon><Tools /></el-icon>
          维修
        </el-button>
        <el-button type="danger" size="large" @click="dispose('scrap')">
          <el-icon><Delete /></el-icon>
          报废
        </el-button>
        <el-button type="info" size="large" @click="dispose('reject')">
          <el-icon><Close /></el-icon>
          拒收
        </el-button>
      </div>
    </el-card>

    <el-card v-if="logs.length > 0" style="margin-top: 15px;">
      <template #header>
        <span style="font-weight: bold;">库存变动日志</span>
      </template>
      <el-table :data="logs">
        <el-table-column prop="sku" label="SKU" />
        <el-table-column prop="change_type" label="变动类型" />
        <el-table-column prop="to_status" label="去向" />
        <el-table-column prop="quantity" label="数量" />
        <el-table-column prop="reason" label="原因" />
        <el-table-column prop="created_at" label="时间" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const order = ref(null)
const quality = ref({
  appearance: '',
  appearance_notes: '',
  accessories: '',
  accessories_notes: '',
  packaging: '',
  packaging_notes: '',
  function_test: '',
  function_test_notes: '',
  overall_result: '',
  inspector: ''
})
const logs = ref([])

const loadData = async () => {
  const res = await axios.get(`/api/orders/${route.params.id}`)
  if (res.data.success) {
    order.value = res.data.data.order
    if (res.data.data.quality) {
      quality.value = { ...res.data.data.quality }
    }
    logs.value = res.data.data.logs || []
  }
}

const saveQuality = async () => {
  try {
    const res = await axios.post(`/api/orders/${route.params.id}/quality`, quality.value)
    if (res.data.success) {
      ElMessage.success('质检保存成功')
      loadData()
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '保存失败')
  }
}

const dispose = async (type) => {
  const labelMap = {
    resell: '入库二次销售',
    repair: '维修',
    scrap: '报废',
    reject: '拒收'
  }
  
  try {
    await ElMessageBox.confirm(`确定要将该退货单置为【${labelMap[type]}】吗？`, '确认处置', {
      type: 'warning'
    })
    
    const res = await axios.post(`/api/orders/${route.params.id}/dispose`, { disposition: type })
    if (res.data.success) {
      ElMessage.success('处置成功')
      loadData()
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '处置失败')
    }
  }
}

const goBack = () => {
  router.push({ name: 'OrderList' })
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
  const map = { resell: '入库二次销售', repair: '待维修', scrap: '已报废', reject: '已拒收' }
  return map[disp] || disp
}

const getAlertType = (disp) => {
  const map = { resell: 'success', repair: 'warning', scrap: 'error', reject: 'info' }
  return map[disp] || 'info'
}

onMounted(() => {
  loadData()
})
</script>
