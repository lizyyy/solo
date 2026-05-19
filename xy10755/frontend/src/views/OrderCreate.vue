<template>
  <div>
    <el-card>
      <template #header>
        <span>创建订单</span>
      </template>

      <el-form :model="orderForm" label-width="120px" style="max-width: 800px;">
        <el-divider content-position="left">基本信息</el-divider>
        
        <el-form-item label="订单号" required>
          <el-input v-model="orderForm.order_no" />
        </el-form-item>
        
        <el-form-item label="客户名称" required>
          <el-input v-model="orderForm.customer_name" />
        </el-form-item>
        
        <el-form-item label="收货地址" required>
          <el-input v-model="orderForm.customer_address" placeholder="城市 地址，如：北京市 朝阳区..." />
        </el-form-item>

        <el-divider content-position="left">订单商品</el-divider>
        
        <el-table :data="orderForm.order_lines" border style="margin-bottom: 20px;">
          <el-table-column label="SKU" width="120">
            <template #default="{ row, $index }">
              <el-input v-model="row.sku" />
            </template>
          </el-table-column>
          <el-table-column label="商品名称">
            <template #default="{ row, $index }">
              <el-input v-model="row.product_name" />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="120">
            <template #default="{ row, $index }">
              <el-input-number v-model="row.quantity" :min="1" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="150">
            <template #default="{ row, $index }">
              <el-input-number v-model="row.unit_price" :min="0" :precision="2" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="removeLine($index)" :disabled="orderForm.order_lines.length <= 1">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-form-item>
          <el-button type="primary" @click="addLine">添加商品行</el-button>
        </el-form-item>

        <el-divider content-position="left">原始数据</el-divider>
        
        <el-form-item label="原始输入">
          <el-input v-model="orderForm.raw_input" type="textarea" :rows="3" placeholder="可保存原始订单数据JSON等" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submitOrder" size="large">提交订单</el-button>
          <el-button @click="$router.push('/')" size="large">返回列表</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { orderApi } from '../api'

const router = useRouter()

const orderForm = ref({
  order_no: '',
  customer_name: '',
  customer_address: '',
  order_lines: [
    {
      sku: 'SKU001',
      product_name: '示例商品1',
      quantity: 1,
      unit_price: 99.00
    }
  ],
  raw_input: ''
})

const addLine = () => {
  orderForm.value.order_lines.push({
    sku: '',
    product_name: '',
    quantity: 1,
    unit_price: 0
  })
}

const removeLine = (index) => {
  orderForm.value.order_lines.splice(index, 1)
}

const submitOrder = async () => {
  if (!orderForm.value.order_no || !orderForm.value.customer_name || !orderForm.value.customer_address) {
    ElMessage.warning('请填写完整的基本信息')
    return
  }
  if (orderForm.value.order_lines.length === 0) {
    ElMessage.warning('请至少添加一个商品')
    return
  }

  try {
    await orderApi.create(orderForm.value)
    ElMessage.success('订单创建成功')
    router.push('/')
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '创建失败')
  }
}

onMounted(() => {
  orderForm.value.order_no = `ORD${Date.now()}`
})
</script>
