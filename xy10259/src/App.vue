<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-left">
        <el-icon class="logo-icon"><Flower /></el-icon>
        <h1>花店节日花束备料台</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="loadSampleData" :icon="Download">
          加载示例数据
        </el-button>
        <el-button @click="clearAllData" :icon="Delete" type="danger">
          清空数据
        </el-button>
      </div>
    </el-header>
    
    <el-container>
      <el-aside width="220px" class="app-aside">
        <el-menu :default-active="activeTab" @select="handleMenuSelect" class="side-menu">
          <el-menu-item index="dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>备料看板</span>
          </el-menu-item>
          <el-menu-item index="materials">
            <el-icon><Box /></el-icon>
            <span>花材管理</span>
          </el-menu-item>
          <el-menu-item index="recipes">
            <el-icon><Document /></el-icon>
            <span>花束配方</span>
          </el-menu-item>
          <el-menu-item index="preorders">
            <el-icon><ShoppingCart /></el-icon>
            <span>预售订单</span>
          </el-menu-item>
          <el-menu-item index="inventory">
            <el-icon><Warehouse /></el-icon>
            <span>库存管理</span>
          </el-menu-item>
          <el-menu-item index="loss">
            <el-icon><Warning /></el-icon>
            <span>损耗记录</span>
          </el-menu-item>
          <el-menu-item index="substitute">
            <el-icon><Refresh /></el-icon>
            <span>替换方案</span>
          </el-menu-item>
          <el-menu-item index="help">
            <el-icon><QuestionFilled /></el-icon>
            <span>使用说明</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-main class="app-main">
        <Dashboard 
          v-if="activeTab === 'dashboard'"
          :materials="materials"
          :recipes="recipes"
          :preorders="preorders"
          :inventory="inventory"
          :loss-records="lossRecords"
          :substitute-plans="substitutePlans"
        />
        
        <MaterialsView 
          v-else-if="activeTab === 'materials'"
          v-model:materials="materials"
          @save="saveMaterials"
        />
        
        <RecipesView 
          v-else-if="activeTab === 'recipes'"
          v-model:recipes="recipes"
          :materials="materials"
          @save="saveRecipes"
        />
        
        <PreordersView 
          v-else-if="activeTab === 'preorders'"
          v-model:preorders="preorders"
          :recipes="recipes"
          @save="savePreorders"
        />
        
        <InventoryView 
          v-else-if="activeTab === 'inventory'"
          v-model:inventory="inventory"
          :materials="materials"
          @save="saveInventory"
        />
        
        <LossView 
          v-else-if="activeTab === 'loss'"
          v-model:loss-records="lossRecords"
          :materials="materials"
          @save="saveLossRecords"
        />
        
        <SubstituteView 
          v-else-if="activeTab === 'substitute'"
          v-model:substitute-plans="substitutePlans"
          :materials="materials"
          @save="saveSubstitutePlans"
        />
        
        <HelpView v-else-if="activeTab === 'help'" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Flower, Download, Delete, DataAnalysis, Box, Document, 
  ShoppingCart, Warehouse, Warning, Refresh, QuestionFilled 
} from '@element-plus/icons-vue'
import { loadData, saveData, STORAGE_KEYS } from './utils/storage.js'
import { generateSampleData } from './utils/sampleData.js'
import Dashboard from './components/Dashboard.vue'
import MaterialsView from './components/MaterialsView.vue'
import RecipesView from './components/RecipesView.vue'
import PreordersView from './components/PreordersView.vue'
import InventoryView from './components/InventoryView.vue'
import LossView from './components/LossView.vue'
import SubstituteView from './components/SubstituteView.vue'
import HelpView from './components/HelpView.vue'

const activeTab = ref('dashboard')

const materials = ref([])
const recipes = ref([])
const preorders = ref([])
const inventory = ref([])
const lossRecords = ref([])
const substitutePlans = ref([])

function handleMenuSelect(index) {
  activeTab.value = index
}

function loadAllData() {
  materials.value = loadData(STORAGE_KEYS.MATERIALS, [])
  recipes.value = loadData(STORAGE_KEYS.RECIPES, [])
  preorders.value = loadData(STORAGE_KEYS.PREORDERS, [])
  inventory.value = loadData(STORAGE_KEYS.INVENTORY, [])
  lossRecords.value = loadData(STORAGE_KEYS.LOSS_RECORDS, [])
  substitutePlans.value = loadData(STORAGE_KEYS.SUBSTITUTE_PLANS, [])
}

function saveMaterials() {
  saveData(STORAGE_KEYS.MATERIALS, materials.value)
}

function saveRecipes() {
  saveData(STORAGE_KEYS.RECIPES, recipes.value)
}

function savePreorders() {
  saveData(STORAGE_KEYS.PREORDERS, preorders.value)
}

function saveInventory() {
  saveData(STORAGE_KEYS.INVENTORY, inventory.value)
}

function saveLossRecords() {
  saveData(STORAGE_KEYS.LOSS_RECORDS, lossRecords.value)
}

function saveSubstitutePlans() {
  saveData(STORAGE_KEYS.SUBSTITUTE_PLANS, substitutePlans.value)
}

function loadSampleData() {
  ElMessageBox.confirm(
    '加载示例数据将覆盖现有数据，是否继续？',
    '确认操作',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const data = generateSampleData()
    materials.value = data.materials
    recipes.value = data.recipes
    preorders.value = data.preorders
    inventory.value = data.inventory
    lossRecords.value = data.lossRecords
    substitutePlans.value = data.substitutePlans
    
    saveMaterials()
    saveRecipes()
    savePreorders()
    saveInventory()
    saveLossRecords()
    saveSubstitutePlans()
    
    ElMessage.success('示例数据加载成功！')
  }).catch(() => {
  })
}

function clearAllData() {
  ElMessageBox.confirm(
    '确定要清空所有数据吗？此操作不可恢复！',
    '确认操作',
    {
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
      type: 'error'
    }
  ).then(() => {
    materials.value = []
    recipes.value = []
    preorders.value = []
    inventory.value = []
    lossRecords.value = []
    substitutePlans.value = []
    
    saveMaterials()
    saveRecipes()
    savePreorders()
    saveInventory()
    saveLossRecords()
    saveSubstitutePlans()
    
    ElMessage.success('所有数据已清空！')
  }).catch(() => {
  })
}

onMounted(() => {
  loadAllData()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
}

.app-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.header-right {
  display: flex;
  gap: 12px;
}

.app-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.side-menu {
  border-right: none;
  height: 100%;
}

.app-main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>