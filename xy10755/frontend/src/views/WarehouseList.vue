<template>
  <div>
    <el-card>
      <template #header>
        <span>仓库与库存</span>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="仓库列表" name="warehouses">
          <el-table :data="warehouses" border>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="warehouse_code" label="仓库编码" width="150" />
            <el-table-column prop="warehouse_name" label="仓库名称" width="200" />
            <el-table-column prop="city" label="城市" width="120" />
            <el-table-column prop="address" label="地址" min-width="200" />
            <el-table-column prop="is_active" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'danger'">{{ row.is_active ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="库存查询" name="inventories">
          <el-form :inline="true" :model="inventoryFilter" style="margin-bottom: 20px;">
            <el-form-item label="SKU">
              <el-input v-model="inventoryFilter.sku" placeholder="输入SKU查询" clearable />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadInventories">查询</el-button>
            </el-form-item>
          </el-form>
          
          <el-table :data="inventories" border>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="warehouse_id" label="仓库ID" width="100" />
            <el-table-column prop="sku" label="SKU" width="150" />
            <el-table-column prop="quantity" label="总库存" width="120" />
            <el-table-column prop="reserved_quantity" label="已预留" width="120" />
            <el-table-column label="可用库存" width="120">
              <template #default="{ row }">
                <el-tag type="success">{{ row.quantity - row.reserved_quantity }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="运费规则" name="shipping-rules">
          <el-alert title="系统内置运费规则" type="info" style="margin-bottom: 20px;" show-icon />
          
          <el-table :data="shippingRules" border>
            <el-table-column prop="rule_name" label="规则名称" width="150" />
            <el-table-column prop="warehouse_code" label="仓库编码" width="120" />
            <el-table-column label="重量范围" width="200">
              <template #default="{ row }">{{ row.min_weight }}kg - {{ row.max_weight }}kg</template>
            </el-table-column>
            <el-table-column prop="shipping_fee" label="运费" width="120">
              <template #default="{ row }">¥{{ row.shipping_fee.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="100" />
            <el-table-column prop="is_active" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'danger'">{{ row.is_active ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { warehouseApi } from '../api'

const activeTab = ref('warehouses')
const warehouses = ref([])
const inventories = ref([])
const inventoryFilter = ref({ sku: '' })

const shippingRules = ref([
  { rule_name: '北京-首重', warehouse_code: 'WH001', min_weight: 0, max_weight: 1, shipping_fee: 8, priority: 10, is_active: true },
  { rule_name: '北京-续重', warehouse_code: 'WH001', min_weight: 1, max_weight: 5, shipping_fee: 12, priority: 5, is_active: true },
  { rule_name: '上海-首重', warehouse_code: 'WH002', min_weight: 0, max_weight: 1, shipping_fee: 10, priority: 10, is_active: true },
  { rule_name: '广州-首重', warehouse_code: 'WH003', min_weight: 0, max_weight: 1, shipping_fee: 9, priority: 10, is_active: true },
])

const loadWarehouses = async () => {
  try {
    const res = await warehouseApi.list()
    warehouses.value = res.data
  } catch (e) {}
}

const loadInventories = async () => {
  try {
    const res = await warehouseApi.inventories(inventoryFilter.value)
    inventories.value = res.data
  } catch (e) {}
}

onMounted(() => {
  loadWarehouses()
  loadInventories()
})
</script>
