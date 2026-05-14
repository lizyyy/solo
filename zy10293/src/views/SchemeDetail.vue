<template>
  <div class="page-container">
    <el-card v-if="scheme">
      <template #header>
        <div class="card-header">
          <div>
            <span class="scheme-title">{{ scheme.name }}</span>
            <el-tag type="info" size="small" style="margin-left: 12px;">V{{ scheme.version }}</el-tag>
            <el-tag :type="scheme.status === 'approved' ? 'success' : 'info'" size="small" style="margin-left: 8px;">
              {{ scheme.status === 'approved' ? '已审核' : '草稿' }}
            </el-tag>
          </div>
          <div>
            <el-button @click="router.push('/schemes')">返回列表</el-button>
            <el-button type="success" @click="createNewVersion" v-if="scheme.status === 'approved'">
              <el-icon><CopyDocument /></el-icon>创建新版本
            </el-button>
            <el-button type="warning" @click="approveScheme" v-if="scheme.status === 'draft'">
              <el-icon><Check /></el-icon>审核通过
            </el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="方案编号">{{ scheme.scheme_no }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ scheme.created_at }}</el-descriptions-item>
        <el-descriptions-item label="总比例">
          <span :class="{ 'text-error': Math.abs(scheme.total_ratio - 100) > 0.01 }">
            {{ scheme.total_ratio }}%
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="描述">{{ scheme.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">原料配比</el-divider>
      
      <el-table :data="schemeItems" border stripe>
        <el-table-column prop="material_name" label="原料名称" />
        <el-table-column prop="batch_no" label="批次号" width="140" />
        <el-table-column prop="ratio" label="比例(%)" width="100" align="right">
          <template #default="{ row }">
            <strong>{{ row.ratio }}</strong>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="参考用量" width="120" align="right">
          <template #default="{ row }">
            {{ row.quantity }} g
          </template>
        </el-table-column>
        <el-table-column label="库存状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.stock_quantity < row.quantity" type="danger" size="small">库存不足</el-tag>
            <el-tag v-else type="success" size="small">充足</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="12">
          <el-card title="版本历史">
            <el-timeline>
              <el-timeline-item
                v-for="ver in versionHistory"
                :key="ver.id"
                :timestamp="ver.created_at"
                placement="top"
              >
                <div>
                  <strong>{{ ver.name }}</strong>
                  <el-tag size="small" type="info">V{{ ver.version }}</el-tag>
                  <span class="text-muted" style="margin-left: 8px;">{{ ver.scheme_no }}</span>
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card title="配比饼图">
            <div ref="pieChartRef" style="height: 300px;"></div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-card v-else>
      <template #header>新建拼配方案</template>
      
      <el-form :model="form" label-width="100px">
        <el-form-item label="方案名称" required>
          <el-input v-model="form.name" placeholder="输入方案名称" style="width: 400px" />
        </el-form-item>
        <el-form-item label="基于版本">
          <el-select v-model="parentSchemeId" placeholder="不基于任何版本（全新）" style="width: 400px" clearable>
            <el-option
              v-for="s in allSchemes"
              :key="s.id"
              :label="`${s.name} - V${s.version}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" style="width: 600px" />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">原料配比</el-divider>
      
      <el-button type="primary" size="small" @click="addMaterial" style="margin-bottom: 16px;">
        <el-icon><Plus /></el-icon>添加原料
      </el-button>
      <span class="ratio-total" :class="{ 'error': Math.abs(totalRatio - 100) > 0.01 }">
        合计: {{ totalRatio.toFixed(2) }}%
      </span>

      <el-table :data="formItems" border stripe>
        <el-table-column prop="material_id" label="原料" width="200">
          <template #default="{ row, $index }">
            <el-select v-model="row.material_id" placeholder="选择原料" style="width: 100%" @change="onMaterialChange">
              <el-option
                v-for="m in materials"
                :key="m.id"
                :label="`${m.name} (${m.batch_no})`"
                :value="m.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="ratio" label="比例(%)" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.ratio" :min="0" :max="100" :precision="2" style="width: 100%" @change="updateQuantity" />
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="参考用量(g)" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.quantity" :min="0" :precision="2" style="width: 100%" @change="updateRatio" />
          </template>
        </el-table-column>
        <el-table-column label="库存" width="100">
          <template #default="{ row }">
            <span v-if="getMaterialStock(row.material_id)" :class="{ 'low-stock': getMaterialStock(row.material_id) < row.quantity }">
              {{ getMaterialStock(row.material_id) }} g
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" @click="formItems.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 24px;">
        <el-button @click="router.push('/schemes')">取消</el-button>
        <el-button type="primary" @click="saveScheme">保存方案</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { schemeApi, materialApi } from '../api'

const router = useRouter()
const route = useRoute()

const scheme = ref<any>(null)
const schemeItems = ref([])
const versionHistory = ref([])
const materials = ref([])
const allSchemes = ref([])
const parentSchemeId = ref<number | null>(null)
const pieChartRef = ref()

const form = reactive({
  name: '',
  description: ''
})

const formItems = ref<any[]>([])

const totalRatio = computed(() => {
  return formItems.value.reduce((sum, item) => sum + (Number(item.ratio) || 0), 0)
})

const getMaterialStock = (id: number) => {
  const m = materials.value.find((x: any) => x.id === id)
  return m ? m.stock_quantity : 0
}

const onMaterialChange = () => {
  // 检查重复
  const ids = formItems.value.map(i => i.material_id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    ElMessage.warning('同一原料不能重复添加')
  }
}

const updateQuantity = () => {
  // 比例变化时，用量按比例自动计算（基准1000g）
  formItems.value.forEach(item => {
    if (item.ratio) {
      item.quantity = parseFloat((1000 * item.ratio / 100).toFixed(2))
    }
  })
}

const updateRatio = () => {
  // 用量变化时，比例自动计算
  const totalQty = formItems.value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  if (totalQty > 0) {
    formItems.value.forEach(item => {
      if (item.quantity) {
        item.ratio = parseFloat((item.quantity / totalQty * 100).toFixed(2))
      }
    })
  }
}

const addMaterial = () => {
  formItems.value.push({
    material_id: null,
    ratio: 0,
    quantity: 0
  })
}

const loadData = async () => {
  try {
    const materialsRes = await materialApi.list()
    materials.value = materialsRes.data

    const schemesRes = await schemeApi.list()
    allSchemes.value = schemesRes.data

    const id = route.params.id as string
    if (id && id !== 'new') {
      const res = await schemeApi.get(parseInt(id))
      scheme.value = res.data
      schemeItems.value = res.data.items || []
      versionHistory.value = res.data.history || []
      
      setTimeout(() => initPieChart(), 100)
    } else {
      const copyId = sessionStorage.getItem('copy_scheme_id')
      if (copyId) {
        parentSchemeId.value = parseInt(copyId)
        const res = await schemeApi.get(parseInt(copyId))
        form.name = res.data.name + ' (新版)'
        formItems.value = (res.data.items || []).map((item: any) => ({
          material_id: item.material_id,
          ratio: item.ratio,
          quantity: item.quantity
        }))
        sessionStorage.removeItem('copy_scheme_id')
      }
    }
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const initPieChart = () => {
  if (!pieChartRef.value) {
    setTimeout(() => initPieChart(), 50)
    return
  }
  const chart = echarts.init(pieChartRef.value)
  const data = schemeItems.value.map((item: any) => ({
    name: item.material_name,
    value: item.ratio
  }))
  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}% ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: '60%',
      data: data,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  })
}

const createNewVersion = () => {
  sessionStorage.setItem('copy_scheme_id', scheme.value.id)
  router.push('/schemes/new')
}

const approveScheme = async () => {
  try {
    await ElMessageBox.confirm(
      '确认审核通过该方案？审核后可用于生产入库。如果平均评分低于3分将提示警告。',
      '审核方案',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await schemeApi.approve(scheme.value.id)
    ElMessage.success('审核成功')
    scheme.value.status = 'approved'
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '审核失败')
    }
  }
}

const saveScheme = async () => {
  if (!form.name) {
    ElMessage.warning('请填写方案名称')
    return
  }
  if (formItems.value.length === 0) {
    ElMessage.warning('请至少添加一种原料')
    return
  }
  if (Math.abs(totalRatio.value - 100) > 0.01) {
    ElMessage.warning('原料比例合计必须等于100%')
    return
  }

  try {
    await schemeApi.create({
      ...form,
      items: formItems.value,
      parent_id: parentSchemeId.value
    })
    ElMessage.success('方案保存成功')
    router.push('/schemes')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
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

.scheme-title {
  font-size: 18px;
  font-weight: 600;
}

.ratio-total {
  float: right;
  font-size: 16px;
  font-weight: 600;
  margin-right: 16px;
}

.ratio-total.error {
  color: #F56C6C;
}

.text-error {
  color: #F56C6C;
  font-weight: 600;
}

.text-muted {
  color: #909399;
}

.low-stock {
  color: #F56C6C;
  font-weight: 600;
}
</style>
