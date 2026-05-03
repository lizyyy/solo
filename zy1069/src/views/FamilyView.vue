<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">👨‍👩‍👧‍👦 家庭成员</h1>
        <p class="text-gray-500 mt-1">管理家庭成员档案，记录过敏信息和慢性病标签</p>
      </div>
      <button 
        @click="showAddModal = true"
        class="btn btn-primary flex items-center gap-2"
      >
        <span>➕</span>
        <span>添加成员</span>
      </button>
    </div>
    
    <div v-if="members.length === 0" class="card p-8 text-center">
      <div class="text-5xl mb-4">👤</div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">暂无家庭成员</h3>
      <p class="text-gray-500 mb-4">点击上方按钮添加您的第一个家庭成员</p>
      <button 
        @click="showAddModal = true"
        class="btn btn-primary"
      >
        添加成员
      </button>
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="member in members" 
        :key="member.id"
        class="card hover:shadow-md transition-shadow"
      >
        <div class="card-header flex justify-between items-start">
          <div>
            <h3 class="font-semibold text-lg text-gray-800">{{ member.name }}</h3>
            <p class="text-sm text-gray-500 mt-1">{{ member.age }}岁 · {{ ageGroupLabel(member.ageGroup) }}</p>
          </div>
          <div class="flex gap-2">
            <button 
              @click="editMember(member)"
              class="text-gray-400 hover:text-primary-500 transition-colors"
              title="编辑"
            >
              ✏️
            </button>
            <button 
              @click="confirmDelete(member)"
              class="text-gray-400 hover:text-danger-500 transition-colors"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-500">过敏信息</label>
            <div class="mt-2 flex flex-wrap gap-1">
              <span 
                v-if="member.allergies.length === 0"
                class="badge badge-gray"
              >
                无
              </span>
              <span 
                v-else
                v-for="allergy in member.allergies" 
                :key="allergy"
                class="badge badge-danger"
              >
                {{ allergy }}
              </span>
            </div>
          </div>
          
          <div>
            <label class="text-sm font-medium text-gray-500">慢性病史</label>
            <div class="mt-2 flex flex-wrap gap-1">
              <span 
                v-if="member.chronicConditions.length === 0"
                class="badge badge-gray"
              >
                无
              </span>
              <span 
                v-else
                v-for="condition in member.chronicConditions" 
                :key="condition"
                class="badge badge-warning"
              >
                {{ condition }}
              </span>
            </div>
          </div>
          
          <div v-if="member.notes">
            <label class="text-sm font-medium text-gray-500">备注</label>
            <p class="mt-1 text-sm text-gray-600">{{ member.notes }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-if="showAddModal || showEditModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-xl font-semibold">
            {{ showAddModal ? '添加家庭成员' : '编辑家庭成员' }}
          </h2>
          <button 
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form @submit.prevent="saveMember" class="card-body space-y-4">
          <div>
            <label class="label">姓名 *</label>
            <input 
              v-model="form.name"
              type="text"
              class="input"
              placeholder="请输入姓名"
              required
            />
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">年龄 *</label>
              <input 
                v-model.number="form.age"
                type="number"
                class="input"
                placeholder="年龄"
                min="0"
                max="150"
                required
              />
            </div>
            <div>
              <label class="label">年龄段</label>
              <select 
                v-model="form.ageGroup"
                class="input"
              >
                <option value="">自动判断</option>
                <option v-for="(label, key) in ageGroupOptions" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
          </div>
          
          <div>
            <label class="label">过敏信息（用逗号分隔）</label>
            <input 
              v-model="allergiesInput"
              type="text"
              class="input"
              placeholder="如：青霉素、海鲜、牛奶"
            />
            <p class="text-xs text-gray-500 mt-1">输入多个过敏项，用逗号或顿号分隔</p>
          </div>
          
          <div>
            <label class="label">慢性病史（用逗号分隔）</label>
            <input 
              v-model="conditionsInput"
              type="text"
              class="input"
              placeholder="如：高血压、糖尿病、心脏病"
            />
            <p class="text-xs text-gray-500 mt-1">输入多个慢性病，用逗号或顿号分隔</p>
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
            确定要删除家庭成员「{{ memberToDelete?.name }}」吗？此操作不可撤销。
          </p>
          <div class="flex gap-3 mt-6">
            <button 
              @click="showDeleteConfirm = false"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              @click="deleteMember"
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
import { ref, computed, onMounted, watch } from 'vue'
import { 
  getFamilyMembers, 
  addFamilyMember, 
  updateFamilyMember, 
  deleteFamilyMember,
  getFamilyMember
} from '@/utils/storage'
import { createFamilyMember } from '@/utils/models'
import { AGE_GROUP_LABELS, AGE_GROUP_RANGES } from '@/utils/constants'
import { getAgeGroup } from '@/utils/dateUtils'

const members = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const memberToDelete = ref(null)
const editingMemberId = ref(null)

const defaultForm = () => ({
  name: '',
  age: '',
  ageGroup: '',
  allergies: [],
  chronicConditions: [],
  notes: ''
})

const form = ref(defaultForm())
const allergiesInput = ref('')
const conditionsInput = ref('')

const ageGroupOptions = AGE_GROUP_LABELS

function ageGroupLabel(ageGroup) {
  return AGE_GROUP_LABELS[ageGroup] || '未设置'
}

function loadMembers() {
  members.value = getFamilyMembers()
}

function resetForm() {
  form.value = defaultForm()
  allergiesInput.value = ''
  conditionsInput.value = ''
  editingMemberId.value = null
}

function closeModal() {
  showAddModal.value = false
  showEditModal.value = false
  resetForm()
}

function editMember(member) {
  editingMemberId.value = member.id
  form.value = { ...member }
  allergiesInput.value = member.allergies.join('、')
  conditionsInput.value = member.chronicConditions.join('、')
  showEditModal.value = true
}

function confirmDelete(member) {
  memberToDelete.value = member
  showDeleteConfirm.value = true
}

function deleteMember() {
  if (memberToDelete.value) {
    deleteFamilyMember(memberToDelete.value.id)
    loadMembers()
  }
  showDeleteConfirm.value = false
  memberToDelete.value = null
}

function parseTags(input) {
  if (!input.trim()) return []
  return input
    .split(/[,、，]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function saveMember() {
  form.value.allergies = parseTags(allergiesInput.value)
  form.value.chronicConditions = parseTags(conditionsInput.value)
  
  if (!form.value.ageGroup) {
    form.value.ageGroup = getAgeGroup(form.value.age)
  }
  
  if (showAddModal.value) {
    const newMember = createFamilyMember(form.value)
    addFamilyMember(newMember)
  } else if (showEditModal.value && editingMemberId.value) {
    updateFamilyMember(editingMemberId.value, form.value)
  }
  
  loadMembers()
  closeModal()
}

onMounted(() => {
  loadMembers()
})
</script>
