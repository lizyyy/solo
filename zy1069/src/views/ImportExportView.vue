<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">📤 导入导出</h1>
      <p class="text-gray-500 mt-1">备份和恢复药箱数据，生成用药核对清单</p>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <div class="card-header bg-primary-50 border-b-primary-100">
          <h3 class="font-semibold text-lg text-primary-800 flex items-center gap-2">
            <span>💾</span>
            <span>数据备份与恢复</span>
          </h3>
        </div>
        <div class="card-body space-y-6">
          <div class="p-4 bg-success-50 rounded-lg border border-success-200">
            <h4 class="font-medium text-success-800 mb-2 flex items-center gap-2">
              <span>✅</span>
              <span>导出 JSON 备份</span>
            </h4>
            <p class="text-sm text-success-600 mb-4">
              将所有数据（家庭成员、药品、用药计划、服药记录）导出为 JSON 文件，用于备份或迁移。
            </p>
            <button 
              @click="handleExportJSON"
              class="btn btn-success w-full"
            >
              <span class="mr-2">📥</span>
              导出备份文件
            </button>
          </div>
          
          <div class="p-4 bg-warning-50 rounded-lg border border-warning-200">
            <h4 class="font-medium text-warning-800 mb-2 flex items-center gap-2">
              <span>⚠️</span>
              <span>导入 JSON 备份</span>
            </h4>
            <p class="text-sm text-warning-600 mb-4">
              从之前导出的 JSON 备份文件恢复数据。注意：这将覆盖当前所有数据！
            </p>
            <div class="flex gap-3">
              <input 
                ref="jsonFileInput"
                type="file"
                accept=".json"
                @change="handleJSONFileSelect"
                class="hidden"
              />
              <button 
                @click="jsonFileInput?.click()"
                class="btn btn-outline flex-1"
              >
                <span class="mr-2">📁</span>
                选择文件
              </button>
              <button 
                v-if="jsonImportData"
                @click="handleImportJSON"
                class="btn btn-warning flex-1"
              >
                <span class="mr-2">⚠️</span>
                确认导入
              </button>
            </div>
            <p v-if="jsonImportData" class="text-xs text-warning-600 mt-2">
              已选择文件，包含 {{ jsonImportData.data?.familyMembers?.length || 0 }} 个成员、
              {{ jsonImportData.data?.medicines?.length || 0 }} 种药品、
              {{ jsonImportData.data?.medicationPlans?.length || 0 }} 个用药计划
            </p>
          </div>
          
          <div class="p-4 bg-danger-50 rounded-lg border border-danger-200">
            <h4 class="font-medium text-danger-800 mb-2 flex items-center gap-2">
              <span>🗑️</span>
              <span>清除所有数据</span>
            </h4>
            <p class="text-sm text-danger-600 mb-4">
              清除浏览器本地存储中的所有数据。此操作不可撤销，请先导出备份！
            </p>
            <button 
              @click="handleClearData"
              class="btn btn-danger w-full"
            >
              <span class="mr-2">⚠️</span>
              清除所有数据
            </button>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header bg-gray-50">
          <h3 class="font-semibold text-lg text-gray-800 flex items-center gap-2">
            <span>📋</span>
            <span>用药核对清单</span>
          </h3>
        </div>
        <div class="card-body space-y-6">
          <div class="p-4 bg-primary-50 rounded-lg border border-primary-200">
            <h4 class="font-medium text-primary-800 mb-2 flex items-center gap-2">
              <span>📄</span>
              <span>导出 Markdown 格式</span>
            </h4>
            <p class="text-sm text-primary-600 mb-4">
              导出为 Markdown 格式的清单，便于编辑和分享给家人确认。包含风险概览、成员信息、药品库存和用药计划。
            </p>
            <button 
              @click="handleExportMarkdown"
              class="btn btn-primary w-full"
            >
              <span class="mr-2">📝</span>
              导出 Markdown
            </button>
          </div>
          
          <div class="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
            <h4 class="font-medium text-secondary-800 mb-2 flex items-center gap-2">
              <span>🌐</span>
              <span>导出 HTML 格式</span>
            </h4>
            <p class="text-sm text-secondary-600 mb-4">
              导出为美观的 HTML 网页，可直接在浏览器打开查看或打印。包含完整的样式和风险高亮。
            </p>
            <button 
              @click="handleExportHTML"
              class="btn btn-secondary w-full"
            >
              <span class="mr-2">🖨️</span>
              导出 HTML
            </button>
          </div>
          
          <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 class="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <span>📊</span>
              <span>当前数据概览</span>
            </h4>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div class="text-center p-3 bg-white rounded-lg">
                <div class="text-2xl font-bold text-primary-600">{{ dataStats.members }}</div>
                <div class="text-sm text-gray-500">家庭成员</div>
              </div>
              <div class="text-center p-3 bg-white rounded-lg">
                <div class="text-2xl font-bold text-warning-600">{{ dataStats.medicines }}</div>
                <div class="text-sm text-gray-500">药品数量</div>
              </div>
              <div class="text-center p-3 bg-white rounded-lg">
                <div class="text-2xl font-bold text-success-600">{{ dataStats.activePlans }}</div>
                <div class="text-sm text-gray-500">进行中计划</div>
              </div>
              <div class="text-center p-3 bg-white rounded-lg">
                <div class="text-2xl font-bold text-danger-600">{{ dataStats.risks }}</div>
                <div class="text-sm text-gray-500">风险提醒</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card lg:col-span-2">
        <div class="card-header bg-info-50">
          <h3 class="font-semibold text-lg text-info-800 flex items-center gap-2">
            <span>📥</span>
            <span>导入药品 CSV</span>
          </h3>
        </div>
        <div class="card-body">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-medium text-gray-700 mb-3">CSV 格式说明</h4>
              <div class="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <p class="text-gray-600">CSV 文件应包含以下列（支持中文或英文列名）：</p>
                <ul class="list-disc list-inside text-gray-500 space-y-1">
                  <li><strong>药名</strong> / name / 药品名称</li>
                  <li><strong>通用成分</strong> / 成分 / genericingredient</li>
                  <li><strong>规格</strong> / specifications</li>
                  <li><strong>库存数量</strong> / stock / stockquantity</li>
                  <li><strong>有效期</strong> / expiry / expirydate (格式: YYYY-MM-DD)</li>
                  <li><strong>适用人群</strong> / 适用 / applicable</li>
                  <li><strong>禁忌</strong> / 禁忌标签 / contraindications</li>
                  <li><strong>建议间隔</strong> / 间隔 / interval (小时)</li>
                  <li><strong>备注</strong> / notes</li>
                </ul>
              </div>
              
              <div class="mt-4">
                <h5 class="font-medium text-gray-700 mb-2">示例 CSV 内容：</h5>
                <pre class="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
药名,通用成分,规格,库存数量,有效期,适用人群,禁忌,建议间隔,备注
布洛芬缓释胶囊,布洛芬,0.3g/粒,12,2025-06-30,成年人、青少年,孕妇禁用、胃溃疡禁用,12,止痛药
对乙酰氨基酚滴剂,对乙酰氨基酚,100ml/瓶,2,2025-12-31,婴幼儿、儿童,严重肝肾不全禁用,6,儿童退烧药
                </pre>
              </div>
            </div>
            
            <div>
              <h4 class="font-medium text-gray-700 mb-3">导入操作</h4>
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div class="text-4xl mb-4">📁</div>
                <p class="text-gray-500 mb-4">点击按钮选择 CSV 文件导入药品数据</p>
                <input 
                  ref="csvFileInput"
                  type="file"
                  accept=".csv,.txt"
                  @change="handleCSVFileSelect"
                  class="hidden"
                />
                <button 
                  @click="csvFileInput?.click()"
                  class="btn btn-primary"
                >
                  <span class="mr-2">📤</span>
                  选择 CSV 文件
                </button>
              </div>
              
              <div v-if="csvPreview.length > 0" class="mt-4">
                <div class="flex justify-between items-center mb-3">
                  <h5 class="font-medium text-gray-700">预览（{{ csvPreview.length }} 条记录）</h5>
                  <div class="flex gap-2">
                    <button 
                      @click="clearCSVPreview"
                      class="btn btn-secondary text-sm"
                    >
                      取消
                    </button>
                    <button 
                      @click="confirmCSVImport"
                      class="btn btn-success text-sm"
                    >
                      <span class="mr-1">✅</span>
                      确认导入
                    </button>
                  </div>
                </div>
                <div class="max-h-[300px] overflow-auto border rounded-lg">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-50 sticky top-0">
                      <tr>
                        <th class="px-3 py-2 text-left font-medium">药名</th>
                        <th class="px-3 py-2 text-left font-medium">成分</th>
                        <th class="px-3 py-2 text-left font-medium">库存</th>
                        <th class="px-3 py-2 text-left font-medium">有效期</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr 
                        v-for="(item, index) in csvPreview" 
                        :key="index"
                        class="border-t"
                      >
                        <td class="px-3 py-2">{{ item.name }}</td>
                        <td class="px-3 py-2 text-gray-500">{{ item.genericIngredient || '-' }}</td>
                        <td class="px-3 py-2">{{ item.stockQuantity }}</td>
                        <td class="px-3 py-2">{{ item.expiryDate || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-if="showConfirmModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="showConfirmModal = false"
    >
      <div class="bg-white rounded-lg max-w-md w-full">
        <div class="card-header">
          <h2 class="text-lg font-semibold" :class="{ 'text-danger-600': confirmModalType === 'clear' }">
            {{ confirmModalTitle }}
          </h2>
        </div>
        <div class="card-body">
          <p class="text-gray-600 mb-4">{{ confirmModalMessage }}</p>
          <div v-if="confirmModalType === 'import'" class="text-sm text-warning-600 bg-warning-50 p-3 rounded-lg mb-4">
            此操作将覆盖当前所有数据，请确保已导出备份！
          </div>
          <div class="flex gap-3">
            <button 
              @click="showConfirmModal = false"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              @click="executeConfirmAction"
              class="btn flex-1"
              :class="{
                'btn-danger': confirmModalType === 'clear',
                'btn-warning': confirmModalType === 'import',
                'btn-primary': confirmModalType === 'csv_import'
              }"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-if="showToast"
      class="fixed top-4 right-4 z-50"
    >
      <div 
        class="card px-6 py-4 shadow-lg flex items-center gap-3"
        :class="{
          'bg-success-50 border-success-200': toastType === 'success',
          'bg-danger-50 border-danger-200': toastType === 'error',
          'bg-warning-50 border-warning-200': toastType === 'warning'
        }"
      >
        <span class="text-xl">
          {{ toastType === 'success' ? '✅' : toastType === 'error' ? '❌' : '⚠️' }}
        </span>
        <span>{{ toastMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { 
  exportToJSON, 
  importFromJSON, 
  exportMarkdownChecklist,
  exportHTMLChecklist,
  importMedicinesFromCSV
} from '@/utils/importExport'
import { 
  getFamilyMembers, 
  getMedicines, 
  getMedicationPlans,
  setMedicines,
  clearAllStorage
} from '@/utils/storage'
import { runAllChecks } from '@/utils/rulesEngine'
import { isDateInRange, getTodayString } from '@/utils/dateUtils'

const jsonFileInput = ref(null)
const csvFileInput = ref(null)
const jsonImportData = ref(null)
const csvPreview = ref([])

const showConfirmModal = ref(false)
const confirmModalType = ref('')
const confirmModalTitle = ref('')
const confirmModalMessage = ref('')

const showToast = ref(false)
const toastType = ref('success')
const toastMessage = ref('')

const dataStats = computed(() => {
  const members = getFamilyMembers()
  const medicines = getMedicines()
  const plans = getMedicationPlans()
  const today = getTodayString()
  const activePlans = plans.filter(p => isDateInRange(today, p.startDate, p.endDate))
  const checkResult = runAllChecks()
  
  return {
    members: members.length,
    medicines: medicines.length,
    activePlans: activePlans.length,
    risks: checkResult.statistics.total
  }
})

function showToastMessage(message, type = 'success') {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
  
  setTimeout(() => {
    showToast.value = false
  }, 3000)
}

function handleExportJSON() {
  try {
    exportToJSON()
    showToastMessage('JSON 备份导出成功！')
  } catch (e) {
    showToastMessage('导出失败：' + e.message, 'error')
  }
}

function handleJSONFileSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result
      if (typeof content === 'string') {
        jsonImportData.value = JSON.parse(content)
        showToastMessage('文件解析成功，点击确认导入')
      }
    } catch (err) {
      showToastMessage('JSON 文件解析失败：' + err.message, 'error')
    }
  }
  reader.readAsText(file)
}

function handleImportJSON() {
  if (!jsonImportData.value) return
  
  confirmModalType.value = 'import'
  confirmModalTitle.value = '确认导入数据'
  confirmModalMessage.value = '确定要导入此备份文件吗？这将覆盖当前所有数据。'
  showConfirmModal.value = true
}

function handleClearData() {
  confirmModalType.value = 'clear'
  confirmModalTitle.value = '确认清除所有数据'
  confirmModalMessage.value = '确定要清除所有数据吗？此操作不可撤销，请先导出备份！'
  showConfirmModal.value = true
}

function handleExportMarkdown() {
  try {
    exportMarkdownChecklist()
    showToastMessage('Markdown 清单导出成功！')
  } catch (e) {
    showToastMessage('导出失败：' + e.message, 'error')
  }
}

function handleExportHTML() {
  try {
    exportHTMLChecklist()
    showToastMessage('HTML 清单导出成功！')
  } catch (e) {
    showToastMessage('导出失败：' + e.message, 'error')
  }
}

function handleCSVFileSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result
      if (typeof content === 'string') {
        csvPreview.value = importMedicinesFromCSV(content)
        if (csvPreview.value.length === 0) {
          showToastMessage('未解析到有效的药品数据', 'warning')
        } else {
          showToastMessage(`解析到 ${csvPreview.value.length} 条药品记录`)
        }
      }
    } catch (err) {
      showToastMessage('CSV 文件解析失败：' + err.message, 'error')
    }
  }
  reader.readAsText(file)
}

function clearCSVPreview() {
  csvPreview.value = []
  if (csvFileInput.value) {
    csvFileInput.value.value = ''
  }
}

function confirmCSVImport() {
  if (csvPreview.value.length === 0) return
  
  confirmModalType.value = 'csv_import'
  confirmModalTitle.value = '确认导入药品'
  confirmModalMessage.value = `确定要导入 ${csvPreview.value.length} 条药品记录吗？这些药品将添加到现有药箱中。`
  showConfirmModal.value = true
}

function executeConfirmAction() {
  showConfirmModal.value = false
  
  if (confirmModalType.value === 'import') {
    try {
      const success = importFromJSON(JSON.stringify(jsonImportData.value))
      if (success) {
        showToastMessage('数据导入成功！')
        jsonImportData.value = null
        if (jsonFileInput.value) {
          jsonFileInput.value.value = ''
        }
      } else {
        showToastMessage('导入失败', 'error')
      }
    } catch (e) {
      showToastMessage('导入失败：' + e.message, 'error')
    }
  } else if (confirmModalType.value === 'clear') {
    try {
      clearAllStorage()
      showToastMessage('数据已清除')
    } catch (e) {
      showToastMessage('清除失败：' + e.message, 'error')
    }
  } else if (confirmModalType.value === 'csv_import') {
    try {
      const currentMedicines = getMedicines()
      const newMedicines = [...currentMedicines, ...csvPreview.value]
      setMedicines(newMedicines)
      showToastMessage(`成功导入 ${csvPreview.value.length} 条药品记录！`)
      csvPreview.value = []
      if (csvFileInput.value) {
        csvFileInput.value.value = ''
      }
    } catch (e) {
      showToastMessage('导入失败：' + e.message, 'error')
    }
  }
}
</script>
