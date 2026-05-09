<template>
  <div class="view-container">
    <el-card class="header-card">
      <div class="card-header">
        <h2>花束配方</h2>
        <el-button type="primary" @click="openAddDialog" :icon="Plus">
          新增配方
        </el-button>
      </div>
    </el-card>

    <el-card class="table-card">
      <el-table :data="recipes" stripe style="width: 100%">
        <el-table-column prop="name" label="花束名称" width="180" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="花材组成" min-width="250">
          <template #default="scope">
            <div v-if="scope.row.materials && scope.row.materials.length > 0">
              <el-tag
                v-for="mat in scope.row.materials.slice(0, 3)"
                :key="mat.materialId"
                size="small"
                style="margin-right: 4px; margin-bottom: 4px"
              >
                {{ getMaterialName(mat.materialId) }} × {{ mat.quantity }}
              </el-tag>
              <el-tag v-if="scope.row.materials.length > 3" size="small" type="info">
                +{{ scope.row.materials.length - 3 }} 种
              </el-tag>
            </div>
            <span v-else style="color: #909399">未配置花材</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="openEditDialog(scope.row)">
              编辑
            </el-button>
            <el-button type="success" link @click="toggleStatus(scope.row)">
              {{ scope.row.status === 'active' ? '停用' : '启用' }}
            </el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑配方' : '新增配方'"
      width="700px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="花束名称">
          <el-input v-model="formData.name" placeholder="请输入花束名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="2"
            placeholder="请输入花束描述"
          />
        </el-form-item>
        <el-form-item label="花材配方">
          <div class="materials-form">
            <el-table :data="formData.materials" size="small" style="width: 100%">
              <el-table-column label="花材" min-width="150">
                <template #default="scope">
                  <el-select
                    v-model="scope.row.materialId"
                    placeholder="选择花材"
                    style="width: 100%"
                    @change="() => checkDuplicateMaterial(scope.$index)"
                  >
                    <el-option
                      v-for="mat in availableMaterials"
                      :key="mat.id"
                      :label="mat.name"
                      :value="mat.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="数量" width="120">
                <template #default="scope">
                  <el-input-number
                    v-model="scope.row.quantity"
                    :min="1"
                    :max="1000"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="scope">
                  <el-button
                    type="danger"
                    link
                    @click="removeMaterial(scope.$index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button
              type="primary"
              text
              @click="addMaterial"
              style="margin-top: 8px"
            >
              + 添加花材
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { generateId } from '../utils/storage.js'

const props = defineProps({
  recipes: {
    type: Array,
    required: true
  },
  materials: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:recipes', 'save'])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const formData = ref({
  name: '',
  description: '',
  materials: [],
  status: 'active'
})

const recipeList = computed(() => props.recipes)

function getMaterialName(materialId) {
  const mat = props.materials.find(m => m.id === materialId)
  return mat ? mat.name : '未知花材'
}

function resetForm() {
  formData.value = {
    name: '',
    description: '',
    materials: [],
    status: 'active'
  }
  isEdit.value = false
  editId.value = null
}

function openAddDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  resetForm()
  isEdit.value = true
  editId.value = row.id
  formData.value = {
    name: row.name,
    description: row.description || '',
    materials: JSON.parse(JSON.stringify(row.materials || [])),
    status: row.status
  }
  dialogVisible.value = true
}

function addMaterial() {
  formData.value.materials.push({
    materialId: '',
    quantity: 1
  })
}

function removeMaterial(index) {
  formData.value.materials.splice(index, 1)
}

function checkDuplicateMaterial(currentIndex) {
  const currentId = formData.value.materials[currentIndex].materialId
  const duplicate = formData.value.materials.find(
    (m, i) => i !== currentIndex && m.materialId === currentId
  )
  if (duplicate && currentId) {
    ElMessage.warning('同一种花材请勿重复添加')
  }
}

const availableMaterials = computed(() => props.materials)

function handleSubmit() {
  if (!formData.value.name) {
    ElMessage.warning('请输入花束名称')
    return
  }

  if (formData.value.materials.length === 0) {
    ElMessage.warning('请至少添加一种花材')
    return
  }

  const invalidMaterials = formData.value.materials.filter(m => !m.materialId)
  if (invalidMaterials.length > 0) {
    ElMessage.warning('请选择所有花材')
    return
  }

  const validMaterials = formData.value.materials.filter(
    m => props.materials.some(pm => pm.id === m.materialId)
  )
  if (validMaterials.length !== formData.value.materials.length) {
    ElMessage.warning('存在无效的花材选择，请检查')
    return
  }

  const duplicate = recipeList.value.find(
    r => r.name === formData.value.name && r.id !== editId.value
  )
  if (duplicate) {
    ElMessage.error('花束名称已存在，请勿重复添加')
    return
  }

  const newList = [...recipeList.value]
  
  if (isEdit.value) {
    const index = newList.findIndex(r => r.id === editId.value)
    if (index !== -1) {
      newList[index] = {
        ...newList[index],
        name: formData.value.name,
        description: formData.value.description,
        materials: formData.value.materials,
        updatedAt: new Date().toISOString()
      }
    }
    ElMessage.success('配方更新成功')
  } else {
    const newRecipe = {
      id: generateId(),
      name: formData.value.name,
      description: formData.value.description,
      materials: formData.value.materials,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    newList.push(newRecipe)
    ElMessage.success('配方添加成功')
  }

  emit('update:recipes', newList)
  emit('save')
  dialogVisible.value = false
  resetForm()
}

function toggleStatus(row) {
  const newList = [...recipeList.value]
  const index = newList.findIndex(r => r.id === row.id)
  if (index !== -1) {
    newList[index].status = newList[index].status === 'active' ? 'inactive' : 'active'
    emit('update:recipes', newList)
    emit('save')
    ElMessage.success(
      `配方已${newList[index].status === 'active' ? '启用' : '停用'}`
    )
  }
}

function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除配方「${row.name}」吗？删除后关联的订单可能会受到影响。`,
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = recipeList.value.filter(r => r.id !== row.id)
    emit('update:recipes', newList)
    emit('save')
    ElMessage.success('删除成功')
  }).catch(() => {
  })
}
</script>

<style scoped>
.view-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-card h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.table-card {
  flex: 1;
}

.materials-form {
  width: 100%;
}
</style>