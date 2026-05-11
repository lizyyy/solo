<template>
  <div class="adjustment-form">
    <el-card>
      <template #header>
        <span>创建调价单</span>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        style="max-width: 1000px; margin: 0 auto;"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="调价标题" prop="title">
              <el-input v-model="form.title" placeholder="请输入调价标题" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="调价类型" prop="type">
              <el-select v-model="form.type" placeholder="请选择调价类型" style="width: 100%;">
                <el-option label="促销调价" value="promotion" />
                <el-option label="区域调价" value="regional" />
                <el-option label="常规调价" value="regular" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="生效时间" prop="effectTime">
          <el-date-picker
            v-model="form.effectTime"
            type="datetime"
            placeholder="请选择生效时间"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="过期时间">
          <el-date-picker
            v-model="form.expireTime"
            type="datetime"
            placeholder="请选择过期时间（可选）"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="请输入描述信息"
          />
        </el-form-item>

        <el-form-item label="商品列表" prop="items">
          <div class="items-section">
            <div class="items-header">
              <el-button type="primary" :icon="Plus" @click="addProduct">
                添加商品
              </el-button>
            </div>
            <el-table :data="form.items" border style="width: 100%; margin-top: 10px;">
              <el-table-column label="商品" min-width="250">
                <template #default="scope">
                  <el-select
                    v-model="scope.row.productId"
                    placeholder="选择商品"
                    filterable
                    style="width: 100%;"
                    @change="(val) => onProductChange(val, scope.$index)"
                  >
                    <el-option
                      v-for="product in products"
                      :key="product.id"
                      :label="`${product.sku} - ${product.name}`"
                      :value="product.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="原价" width="120">
                <template #default="scope">
                  <span>¥{{ scope.row.originalPrice }}</span>
                </template>
              </el-table-column>
              <el-table-column label="新价" width="150">
                <template #default="scope">
                  <el-input-number
                    v-model="scope.row.newPrice"
                    :min="0"
                    :precision="2"
                    :step="0.5"
                    style="width: 100%;"
                  />
                </template>
              </el-table-column>
              <el-table-column label="调价幅度" width="120">
                <template #default="scope">
                  <span :style="{ color: scope.row.newPrice < scope.row.originalPrice ? '#67c23a' : '#f56c6c' }">
                    {{ getPriceDiff(scope.row) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="scope">
                  <el-button
                    type="danger"
                    link
                    :icon="Delete"
                    @click="removeProduct(scope.$index)"
                  />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>

        <el-form-item label="门店范围" prop="storeIds">
          <div class="stores-section">
            <div class="stores-header">
              <span>选择需要执行调价的门店</span>
              <el-checkbox v-model="selectAllStores" @change="toggleAllStores">
                全选
              </el-checkbox>
            </div>
            <el-table
              :data="groupedStores"
              border
              style="width: 100%; margin-top: 10px;"
              :row-key="'id'"
              :tree-props="{ children: 'stores' }"
            >
              <el-table-column label="区域/门店" prop="name">
                <template #default="scope">
                  <el-checkbox
                    v-if="scope.row.stores"
                    :model-value="isRegionAllSelected(scope.row.id)"
                    @change="(val) => toggleRegion(scope.row, val)"
                  >
                    {{ scope.row.name }}
                  </el-checkbox>
                  <el-checkbox
                    v-else
                    v-model="scope.row.selected"
                    @change="updateSelectedStores"
                  >
                    {{ scope.row.name }} ({{ scope.row.code }})
                  </el-checkbox>
                </template>
              </el-table-column>
              <el-table-column label="门店数" width="100">
                <template #default="scope">
                  <span v-if="scope.row.stores">{{ scope.row.stores.length }} 家门店</span>
                  <span v-else>单门店</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :icon="Check" @click="submitForm" :loading="submitting">
            保存草稿
          </el-button>
          <el-button :icon="ArrowLeft" @click="goBack">
            返回
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Check, ArrowLeft } from '@element-plus/icons-vue'
import { adjustmentsAPI, productsAPI, storesAPI, regionsAPI } from '@/api'

const router = useRouter()

const formRef = ref(null)
const submitting = ref(false)
const products = ref([])
const allStores = ref([])
const selectAllStores = ref(false)

const form = ref({
  title: '',
  type: 'regular',
  effectTime: null,
  expireTime: null,
  description: '',
  items: [],
  storeIds: []
})

const rules = {
  title: [{ required: true, message: '请输入调价标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择调价类型', trigger: 'change' }],
  effectTime: [{ required: true, message: '请选择生效时间', trigger: 'change' }],
  items: [{ required: true, message: '请至少添加一个商品', trigger: 'change' }],
  storeIds: [{ required: true, message: '请至少选择一个门店', trigger: 'change' }]
}

const groupedStores = computed(() => {
  const storeMap = {}
  allStores.value.forEach(store => {
    if (!storeMap[store.region_id]) {
      storeMap[store.region_id] = {
        id: store.region_id,
        name: store.region_name,
        stores: []
      }
    }
    storeMap[store.region_id].stores.push({
      ...store,
      selected: form.value.storeIds.includes(store.id)
    })
  })
  return Object.values(storeMap)
})

const loadData = async () => {
  try {
    const [productsData, storesData] = await Promise.all([
      productsAPI.list(),
      storesAPI.list()
    ])
    products.value = productsData
    allStores.value = storesData
  } catch (error) {
    ElMessage.error(error.message)
  }
}

const addProduct = () => {
  form.value.items.push({
    productId: null,
    originalPrice: 0,
    newPrice: 0
  })
}

const removeProduct = (index) => {
  form.value.items.splice(index, 1)
}

const onProductChange = (productId, index) => {
  const product = products.value.find(p => p.id === productId)
  if (product) {
    form.value.items[index].originalPrice = product.current_price
  }
}

const getPriceDiff = (item) => {
  if (!item.originalPrice || !item.newPrice) return '-'
  const diff = item.newPrice - item.originalPrice
  const percent = ((diff / item.originalPrice) * 100).toFixed(1)
  const sign = diff >= 0 ? '+' : ''
  return `${sign}¥${diff.toFixed(2)} (${sign}${percent}%)`
}

const isRegionAllSelected = (regionId) => {
  const regionStores = allStores.value.filter(s => s.region_id === regionId)
  return regionStores.length > 0 && regionStores.every(s => form.value.storeIds.includes(s.id))
}

const toggleRegion = (region, selected) => {
  const regionStoreIds = region.stores.map(s => s.id)
  if (selected) {
    regionStoreIds.forEach(id => {
      if (!form.value.storeIds.includes(id)) {
        form.value.storeIds.push(id)
      }
    })
  } else {
    form.value.storeIds = form.value.storeIds.filter(id => !regionStoreIds.includes(id))
  }
  updateStoreSelection()
}

const toggleAllStores = (selected) => {
  if (selected) {
    form.value.storeIds = allStores.value.map(s => s.id)
  } else {
    form.value.storeIds = []
  }
  updateStoreSelection()
}

const updateSelectedStores = () => {
  form.value.storeIds = []
  allStores.value.forEach(store => {
    const region = groupedStores.value.find(r => r.id === store.region_id)
    if (region) {
      const storeInRegion = region.stores.find(s => s.id === store.id)
      if (storeInRegion && storeInRegion.selected) {
        form.value.storeIds.push(store.id)
      }
    }
  })
}

const updateStoreSelection = () => {
  allStores.value.forEach(store => {
    const region = groupedStores.value.find(r => r.id === store.region_id)
    if (region) {
      const storeInRegion = region.stores.find(s => s.id === store.id)
      if (storeInRegion) {
        storeInRegion.selected = form.value.storeIds.includes(store.id)
      }
    }
  })
}

const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      if (form.value.items.length === 0) {
        ElMessage.warning('请至少添加一个商品')
        return
      }
      
      if (form.value.storeIds.length === 0) {
        ElMessage.warning('请至少选择一个门店')
        return
      }

      const data = {
        title: form.value.title,
        type: form.value.type,
        description: form.value.description,
        effectTime: form.value.effectTime,
        expireTime: form.value.expireTime,
        items: form.value.items.filter(i => i.productId && i.newPrice > 0),
        storeIds: form.value.storeIds,
        createdBy: 'system'
      }

      await adjustmentsAPI.create(data)
      ElMessage.success('调价单创建成功')
      router.push('/adjustments')
    } catch (error) {
      ElMessage.error(error.message)
    } finally {
      submitting.value = false
    }
  })
}

const goBack = () => {
  router.push('/adjustments')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.items-section,
.stores-section {
  width: 100%;
}

.items-header,
.stores-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
