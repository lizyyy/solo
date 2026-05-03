<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">💊 药品管理</h1>
        <p class="text-gray-500 mt-1">录入和管理家庭药箱中的药品信息</p>
      </div>
      <div class="flex gap-2">
        <button 
          @click="showImportModal = true"
          class="btn btn-outline flex items-center gap-2"
        >
          <span>📥</span>
          <span class="hidden sm:inline">导入CSV</span>
        </button>
        <button 
          @click="showAddModal = true"
          class="btn btn-primary flex items-center gap-2"
        >
          <span>➕</span>
          <span>添加药品</span>
        </button>
      </div>
    </div>
    
    <div class="card mb-6">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <input 
              v-model="searchQuery"
              type="text"
              class="input"
              placeholder="🔍 搜索药品名称、成分..."
            />
          </div>
          <div class="flex gap-2">
            <select 
              v-model="filterStatus"
              class="input"
            >
              <option value="">全部状态</option>
              <option value="normal">正常</option>
              <option value="expiring">即将过期</option>
              <option value="expired">已过期</option>
              <option value="low_stock">库存不足</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="filteredMedicines.length === 0" class="card p-8 text-center">
      <div class="text-5xl mb-4">💊</div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">暂无药品</h3>
      <p class="text-gray-500 mb-4">点击上方按钮添加您的第一个药品</p>
      <button 
        @click="showAddModal = true"
        class="btn btn-primary"
      >
        添加药品
      </button>
    </div>
    
    <div v-else class="space-y-4">
      <div 
        v-for="medicine in filteredMedicines" 
        :key="medicine.id"
        class="card hover:shadow-md transition-shadow"
      >
        <div class="card-header flex flex-col sm:flex-row justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h3 class="font-semibold text-lg text-gray-800">{{ medicine.name }}</h3>
              <span 
                v-if="isExpired(medicine.expiryDate)"
                class="badge badge-danger"
              >
                已过期
              </span>
              <span 
                v-else-if="isExpiringSoon(medicine.expiryDate)"
                class="badge badge-warning"
              >
                即将过期
              </span>
              <span 
                v-if="medicine.stockQuantity === 0"
                class="badge badge-danger"
              >
                库存为0
              </span>
              <span 
                v-else-if="medicine.stockQuantity <= 5"
                class="badge badge-warning"
              >
                库存不足
              </span>
            </div>
            <p v-if="medicine.genericIngredient" class="text-sm text-gray-500 mt-1">
              通用成分：{{ medicine.genericIngredient }}
            </p>
          </div>
          <div class="flex gap-2">
            <button 
              @click="editMedicine(medicine)"
              class="text-gray-400 hover:text-primary-500 transition-colors"
              title="编辑"
            >
              ✏️
            </button>
            <button 
              @click="confirmDelete(medicine)"
              class="text-gray-400 hover:text-danger-500 transition-colors"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500">规格</label>
              <p class="text-sm text-gray-700 mt-1">{{ medicine.specifications || '-' }}</p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500">库存数量</label>
              <p class="text-sm text-gray-700 mt-1">{{ medicine.stockQuantity }} 份</p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500">有效期</label>
              <p 
                class="text-sm mt-1"
                :class="{
                  'text-danger-600': isExpired(medicine.expiryDate),
                  'text-warning-600': isExpiringSoon(medicine.expiryDate) && !isExpired(medicine.expiryDate),
                  'text-gray-700': !isExpired(medicine.expiryDate) && !isExpiringSoon(medicine.expiryDate)
                }"
              >
                {{ medicine.expiryDate || '-' }}
                <span v-if="medicine.expiryDate">
                  ({{ getDaysUntilExpiry(medicine.expiryDate) > 0 ? getDaysUntilExpiry(medicine.expiryDate) + '天后' : Math.abs(getDaysUntilExpiry(medicine.expiryDate)) + '天前' }})
                </span>
              </p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500">建议间隔</label>
              <p class="text-sm text-gray-700 mt-1">{{ medicine.suggestedInterval || 4 }} 小时</p>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-100">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-medium text-gray-500">适用人群</label>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span 
                    v-for="pop in medicine.applicablePopulation" 
                    :key="pop"
                    class="badge badge-primary"
                  >
                    {{ applicablePopulationLabel(pop) }}
                  </span>
                  <span v-if="!medicine.applicablePopulation || medicine.applicablePopulation.length === 0" class="badge badge-gray">
                    所有人群
                  </span>
                </div>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500">禁忌标签</label>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span 
                    v-for="ci in medicine.contraindications" 
                    :key="ci"
                    class="badge badge-danger"
                  >
                    {{ ci }}
                  </span>
                  <span v-if="!medicine.contraindications || medicine.contraindications.length === 0" class="badge badge-gray">
                    无
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="medicine.notes" class="mt-4 pt-4 border-t border-gray-100">
            <label class="text-xs font-medium text-gray-500">备注</label>
            <p class="text-sm text-gray-600 mt-1">{{ medicine.notes }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-if="showAddModal || showEditModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-xl font-semibold">
            {{ showAddModal ? '添加药品' : '编辑药品' }}
          </h2>
          <button 
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form @submit.prevent="saveMedicine" class="card-body space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label">药品名称 *</label>
              <input 
                v-model="form.name"
                type="text"
                class="input"
                placeholder="如：感冒灵颗粒"
                required
              />
            </div>
            <div>
              <label class="label">通用成分</label>
              <input 
                v-model="form.genericIngredient"
                type="text"
                class="input"
                placeholder="如：对乙酰氨基酚、布洛芬"
              />
              <p class="text-xs text-gray-500 mt-1">多种成分用逗号分隔</p>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="label">规格</label>
              <input 
                v-model="form.specifications"
                type="text"
                class="input"
                placeholder="如：5mg/片、0.5g/粒"
              />
            </div>
            <div>
              <label class="label">库存数量 *</label>
              <input 
                v-model.number="form.stockQuantity"
                type="number"
                class="input"
                placeholder="0"
                min="0"
                required
              />
            </div>
            <div>
              <label class="label">有效期 *</label>
              <input 
                v-model="form.expiryDate"
                type="date"
                class="input"
                required
              />
            </div>
          </div>
          
          <div>
            <label class="label">适用人群（可多选）</label>
            <div class="flex flex-wrap gap-2 mt-2">
              <label 
                v-for="(label, key) in applicablePopulationOptions" 
                :key="key"
                class="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50"
                :class="{
                  'bg-primary-50 border-primary-300': form.applicablePopulation.includes(key)
                }"
              >
                <input 
                  type="checkbox"
                  :checked="form.applicablePopulation.includes(key)"
                  @change="toggleApplicablePopulation(key)"
                  class="sr-only"
                />
                <span>{{ label }}</span>
              </label>
            </div>
          </div>
          
          <div>
            <label class="label">禁忌标签（用逗号分隔）</label>
            <input 
              v-model="contraindicationsInput"
              type="text"
              class="input"
              placeholder="如：孕妇禁用、过敏者禁用、严重肝肾不全禁用"
            />
          </div>
          
          <div>
            <label class="label">建议服药间隔（小时）</label>
            <input 
              v-model.number="form.suggestedInterval"
              type="number"
              class="input"
              min="1"
              max="24"
              placeholder="4"
            />
            <p class="text-xs text-gray-500 mt-1">同成分或同类药物的最小建议间隔</p>
          </div>
          
          <div>
            <label class="label">备注</label>
            <textarea 
              v-model="form.notes"
              class="input min-h-[80px]"
              placeholder="其他需要注意的信息..."
            ></textarea>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button 
              type="button"
              @click="closeModal"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              type="submit"
              class="btn btn-primary flex-1"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <div 
      v-if="showImportModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="showImportModal = false"
    >
      <div class="bg-white rounded-lg max-w-lg w-full">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-xl font-semibold">导入药品 CSV</h2>
          <button 
            @click="showImportModal = false"
            class="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label class="label">CSV 格式说明</label>
            <div class="bg-gray-50 rounded-md p-4 text-sm">
              <p class="text-gray-600 mb-2">CSV 文件应包含以下列（支持中文或英文列名）：</p>
              <ul class="list-disc list-inside text-gray-500 space-y-1">
                <li>药名 / name / 药品名称</li>
                <li>通用成分 / 成分 / genericingredient</li>
                <li>规格 / specifications</li>
                <li>库存数量 / stock / stockquantity</li>
                <li>有效期 / expiry / expirydate</li>
                <li>适用人群 / 适用 / applicable</li>
                <li>禁忌 / 禁忌标签 / contraindications</li>
                <li>建议间隔 / 间隔 / interval</li>
                <li>备注 / notes</li>
              </ul>
            </div>
          </div>
          
          <div>
            <label class="label">选择文件</label>
            <input 
              ref="fileInput"
              type="file"
              accept=".csv,.txt"
              @change="handleFileSelect"
              class="input"
            />
          </div>
          
          <div v-if="importPreview.length > 0">
            <label class="label">预览（{{ importPreview.length }} 条记录）</label>
            <div class="max-h-[200px] overflow-auto border rounded-md">
              <table class="w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-3 py-2 text-left">药名</th>
                    <th class="px-3 py-2 text-left">成分</th>
                    <th class="px-3 py-2 text-left">库存</th>
                    <th class="px-3 py-2 text-left">有效期</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in importPreview" :key="index">
                    <td class="px-3 py-2 border-t">{{ item.name }}</td>
                    <td class="px-3 py-2 border-t text-gray-500">{{ item.genericIngredient || '-' }}</td>
                    <td class="px-3 py-2 border-t">{{ item.stockQuantity }}</td>
                    <td class="px-3 py-2 border-t">{{ item.expiryDate || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button 
              @click="showImportModal = false"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              v-if="importPreview.length > 0"
              @click="confirmImport"
              class="btn btn-primary flex-1"
            >
              确认导入 ({{ importPreview.length }})
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-if="showDeleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="showDeleteConfirm = false"
    >
      <div class="bg-white rounded-lg max-w-sm w-full">
        <div class="card-header">
          <h2 class="text-lg font-semibold">确认删除</h2>
        </div>
        <div class="card-body">
          <p class="text-gray-600">
            确定要删除药品「{{ medicineToDelete?.name }}」吗？此操作不可撤销。
          </p>
          <div class="flex gap-3 mt-6">
            <button 
              @click="showDeleteConfirm = false"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              @click="confirmDeleteMedicine"
              class="btn btn-danger flex-1"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  getMedicines, 
  addMedicine, 
  updateMedicine, 
  deleteMedicine as deleteMedicineFromStorage,
  setMedicines
} from '@/utils/storage'
import { createMedicine } from '@/utils/models'
import { APPLICABLE_POPULATION, APPLICABLE_POPULATION_LABELS } from '@/utils/constants'
import { isExpired, isExpiringSoon, getDaysUntilExpiry } from '@/utils/dateUtils'
import { importMedicinesFromCSV } from '@/utils/importExport'

const medicines = ref([])
const searchQuery = ref('')
const filterStatus = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const showImportModal = ref(false)
const showDeleteConfirm = ref(false)
const medicineToDelete = ref(null)
const editingMedicineId = ref(null)
const fileInput = ref(null)
const importPreview = ref([])

const applicablePopulationOptions = APPLICABLE_POPULATION_LABELS

const defaultForm = () => ({
  name: '',
  genericIngredient: '',
  specifications: '',
  stockQuantity: 0,
  expiryDate: '',
  applicablePopulation: [],
  contraindications: [],
  suggestedInterval: 4,
  notes: ''
})

const form = ref(defaultForm())
const contraindicationsInput = ref('')

const filteredMedicines = computed(() => {
  let result = [...medicines.value]
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m => 
      m.name.toLowerCase().includes(query) ||
      (m.genericIngredient && m.genericIngredient.toLowerCase().includes(query)) ||
      (m.notes && m.notes.toLowerCase().includes(query))
    )
  }
  
  if (filterStatus.value) {
    result = result.filter(m => {
      if (filterStatus.value === 'expired') return isExpired(m.expiryDate)
      if (filterStatus.value === 'expiring') return isExpiringSoon(m.expiryDate) && !isExpired(m.expiryDate)
      if (filterStatus.value === 'low_stock') return m.stockQuantity <= 5
      if (filterStatus.value === 'normal') return !isExpired(m.expiryDate) && !isExpiringSoon(m.expiryDate) && m.stockQuantity > 5
      return true
    })
  }
  
  return result
})

function applicablePopulationLabel(key) {
  return APPLICABLE_POPULATION_LABELS[key] || key
}

function loadMedicines() {
  medicines.value = getMedicines()
}

function resetForm() {
  form.value = defaultForm()
  contraindicationsInput.value = ''
  editingMedicineId.value = null
}

function closeModal() {
  showAddModal.value = false
  showEditModal.value = false
  resetForm()
}

function editMedicine(medicine) {
  editingMedicineId.value = medicine.id
  form.value = { ...medicine }
  contraindicationsInput.value = (medicine.contraindications || []).join('、')
  showEditModal.value = true
}

function confirmDelete(medicine) {
  medicineToDelete.value = medicine
  showDeleteConfirm.value = true
}

function confirmDeleteMedicine() {
  if (medicineToDelete.value) {
    deleteMedicineFromStorage(medicineToDelete.value.id)
    loadMedicines()
  }
  showDeleteConfirm.value = false
  medicineToDelete.value = null
}

function toggleApplicablePopulation(key) {
  const index = form.value.applicablePopulation.indexOf(key)
  if (index > -1) {
    form.value.applicablePopulation.splice(index, 1)
  } else {
    form.value.applicablePopulation.push(key)
  }
}

function parseTags(input) {
  if (!input.trim()) return []
  return input
    .split(/[,、，]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function saveMedicine() {
  form.value.contraindications = parseTags(contraindicationsInput.value)
  
  if (showAddModal.value) {
    const newMedicine = createMedicine(form.value)
    addMedicine(newMedicine)
  } else if (showEditModal.value && editingMedicineId.value) {
    updateMedicine(editingMedicineId.value, form.value)
  }
  
  loadMedicines()
  closeModal()
}

function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result
    if (typeof content === 'string') {
      importPreview.value = importMedicinesFromCSV(content)
    }
  }
  reader.readAsText(file)
}

function confirmImport() {
  if (importPreview.value.length > 0) {
    const currentMedicines = getMedicines()
    const newMedicines = [...currentMedicines, ...importPreview.value]
    setMedicines(newMedicines)
    loadMedicines()
  }
  importPreview.value = []
  showImportModal.value = false
}

onMounted(() => {
  loadMedicines()
})
</script>
