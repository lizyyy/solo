<template>
  <div class="main-content">
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ projectStore.boxes.length }}</span>
        <span class="stat-label">箱子数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ projectStore.stats.totalItems }}</span>
        <span class="stat-label">物品数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ projectStore.stats.totalWeight.toFixed(1) }}kg</span>
        <span class="stat-label">总重量</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ projectStore.stats.packedBoxes }}</span>
        <span class="stat-label">已封箱</span>
      </div>
      <div class="stat-item" style="cursor: pointer;" @click="showRiskPanel = !showRiskPanel">
        <span class="stat-value" :style="{ color: projectStore.stats.riskCount > 0 ? '#f56c6c' : '#67c23a' }">
          {{ projectStore.stats.riskCount }}
        </span>
        <span class="stat-label">风险项</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-section">
        <el-button type="primary" :icon="Plus" @click="showAddItem = true">
          添加物品
        </el-button>
        <el-button :icon="Upload" @click="handleImportCSV">
          导入CSV
        </el-button>
      </div>
      <div class="toolbar-divider" />
      <div class="toolbar-section">
        <el-dropdown>
          <el-button :icon="Download">
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="exportMovingList">
                搬运清单 CSV
              </el-dropdown-item>
              <el-dropdown-item @click="exportUrgentList">
                今晚先拆清单 Markdown
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="toolbar-divider" />
      <div class="toolbar-section">
        <el-select v-model="batchStatus" placeholder="批量更改状态" size="small" style="width: 140px;">
          <el-option label="待装箱" value="pending" />
          <el-option label="已封箱" value="packed" />
          <el-option label="已搬运" value="moved" />
          <el-option label="已到达" value="arrived" />
          <el-option label="已拆箱" value="unpacked" />
        </el-select>
        <el-button 
          type="warning" 
          size="small" 
          :disabled="selectedBoxes.length === 0 || !batchStatus"
          @click="handleBatchStatusChange"
        >
          应用 ({{ selectedBoxes.length }})
        </el-button>
        <el-button 
          size="small" 
          :disabled="selectedBoxes.length === 0"
          @click="clearSelection"
        >
          清除选择
        </el-button>
      </div>
    </div>

    <div class="content-area">
      <template v-if="projectStore.filteredItems.length === 0">
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-text">暂无物品</div>
          <div class="empty-state-hint">点击"添加物品"或导入CSV来添加物品</div>
        </div>
      </template>

      <template v-else>
        <div 
          v-for="box in displayBoxes" 
          :key="box.id"
          class="box-card"
          :class="{ selected: selectedBoxes.includes(box.id) }"
        >
          <div class="box-header" @click="toggleBoxSelection(box.id)">
            <el-checkbox :model-value="selectedBoxes.includes(box.id)" @click.stop />
            <span class="box-number">#{{ box.boxNumber }}</span>
            <span class="box-name">{{ box.name || '未命名箱子' }}</span>
            <el-tag :type="getBoxStatusType(box.status)" size="small" class="box-status">
              {{ getBoxStatusLabel(box.status) }}
            </el-tag>
            <div class="box-stats">
              <span>{{ getBoxStats(box.id).totalItems }}件</span>
              <span>{{ getBoxStats(box.id).totalWeight.toFixed(1) }}kg</span>
            </div>
            <div class="box-actions">
              <el-dropdown @command="handleBoxCommand">
                <el-button type="primary" link size="small">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{ action: 'edit', box }">
                      编辑箱子
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'addItem', box }">
                      添加物品
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'exportLabel', box }">
                      打印标签
                    </el-dropdown-item>
                    <el-dropdown-item divided :command="{ action: 'delete', box }">
                      删除箱子
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          
          <div class="box-body">
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 40px;"></th>
                  <th>物品名称</th>
                  <th style="width: 80px;">数量</th>
                  <th style="width: 100px;">重量</th>
                  <th style="width: 150px;">标签</th>
                  <th style="width: 100px;">负责人</th>
                  <th style="width: 100px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in getBoxItems(box.id)" :key="item.id">
                  <td>
                    <el-tag 
                      v-if="item.tags.length > 0" 
                      size="small"
                      :type="getHighestPriorityTagType(item.tags)"
                    >
                      {{ item.tags[0] }}
                    </el-tag>
                  </td>
                  <td>
                    <span class="item-name">{{ item.name }}</span>
                    <span v-if="item.description" style="color: #909399; font-size: 12px; margin-left: 8px;">
                      {{ item.description }}
                    </span>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ item.weight.toFixed(1) }}kg</td>
                  <td>
                    <div class="item-tags">
                      <el-tag 
                        v-for="tag in item.tags" 
                        :key="tag" 
                        size="small"
                        :type="getTagType(tag)"
                      >
                        {{ tag }}
                      </el-tag>
                    </div>
                  </td>
                  <td>{{ item.responsiblePerson || '-' }}</td>
                  <td>
                    <el-button type="primary" link size="small" @click="editItem(item)">
                      编辑
                    </el-button>
                    <el-button type="danger" link size="small" @click="deleteItem(item)">
                      删除
                    </el-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="unboxedItems.length > 0" class="box-card">
          <div class="box-header">
            <span class="box-number" style="color: #909399;">?</span>
            <span class="box-name" style="color: #909399;">未装箱物品</span>
            <div class="box-stats" style="color: #909399;">
              <span>{{ unboxedItems.length }}件</span>
              <span>{{ unboxedItemsWeight.toFixed(1) }}kg</span>
            </div>
          </div>
          <div class="box-body">
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 40px;"></th>
                  <th>物品名称</th>
                  <th style="width: 80px;">数量</th>
                  <th style="width: 100px;">重量</th>
                  <th style="width: 150px;">标签</th>
                  <th style="width: 100px;">负责人</th>
                  <th style="width: 100px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in unboxedItems" :key="item.id">
                  <td>
                    <el-tag 
                      v-if="item.tags.length > 0" 
                      size="small"
                      :type="getHighestPriorityTagType(item.tags)"
                    >
                      {{ item.tags[0] }}
                    </el-tag>
                  </td>
                  <td>
                    <span class="item-name">{{ item.name }}</span>
                    <span v-if="item.description" style="color: #909399; font-size: 12px; margin-left: 8px;">
                      {{ item.description }}
                    </span>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ item.weight.toFixed(1) }}kg</td>
                  <td>
                    <div class="item-tags">
                      <el-tag 
                        v-for="tag in item.tags" 
                        :key="tag" 
                        size="small"
                        :type="getTagType(tag)"
                      >
                        {{ tag }}
                      </el-tag>
                    </div>
                  </td>
                  <td>{{ item.responsiblePerson || '-' }}</td>
                  <td>
                    <el-button type="primary" link size="small" @click="editItem(item)">
                      编辑
                    </el-button>
                    <el-button type="danger" link size="small" @click="deleteItem(item)">
                      删除
                    </el-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>

    <AddItemDialog 
      v-model="showAddItem"
      :editing-item="editingItem"
      :selected-box="selectedBoxForAddItem"
      @success="handleItemAdded"
    />

    <AddBoxDialog 
      v-model="showEditBox"
      :editing-box="editingBox"
      @success="handleBoxEdited"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import AddItemDialog from '@/components/AddItemDialog.vue'
import AddBoxDialog from '@/components/AddBoxDialog.vue'
import { 
  Plus, Upload, Download, ArrowDown, MoreFilled 
} from '@element-plus/icons-vue'
import { BoxStatusColors, BoxStatusLabels, SystemTagColors, SystemTagLabels } from '@/models/types'
import { ElMessage, ElMessageBox } from 'element-plus'

const projectStore = useProjectStore()
const showAddItem = ref(false)
const showEditBox = ref(false)
const editingItem = ref(null)
const editingBox = ref(null)
const selectedBoxForAddItem = ref(null)
const selectedBoxes = ref([])
const batchStatus = ref('')
const showRiskPanel = ref(true)

const displayBoxes = computed(() => {
  if (projectStore.selectedBoxId) {
    const box = projectStore.boxes.find(b => b.id === projectStore.selectedBoxId)
    return box ? [box] : []
  }
  
  const items = projectStore.filteredItems
  const boxIds = new Set(items.map(i => i.boxId).filter(Boolean))
  return projectStore.boxes.filter(b => boxIds.has(b.id))
})

const unboxedItems = computed(() => {
  const items = projectStore.filteredItems.filter(i => !i.boxId)
  return items
})

const unboxedItemsWeight = computed(() => {
  return unboxedItems.value.reduce((sum, item) => sum + (item.weight * item.quantity), 0)
})

function getBoxStatusType(status) {
  return BoxStatusColors[status] || 'info'
}

function getBoxStatusLabel(status) {
  return BoxStatusLabels[status] || status
}

function getBoxStats(boxId) {
  return projectStore.getBoxStats(boxId)
}

function getBoxItems(boxId) {
  return projectStore.filteredItems.filter(i => i.boxId === boxId)
}

function getTagType(tag) {
  const tagKey = Object.keys(SystemTagLabels).find(k => SystemTagLabels[k] === tag)
  if (tagKey && SystemTagColors[tagKey]) {
    return SystemTagColors[tagKey]
  }
  return 'info'
}

function getHighestPriorityTagType(tags) {
  const priority = ['证件', '急用', '易碎', '贵重']
  for (const p of priority) {
    if (tags.includes(p)) {
      return getTagType(p)
    }
  }
  return 'info'
}

function toggleBoxSelection(boxId) {
  const index = selectedBoxes.value.indexOf(boxId)
  if (index > -1) {
    selectedBoxes.value.splice(index, 1)
  } else {
    selectedBoxes.value.push(boxId)
  }
}

function clearSelection() {
  selectedBoxes.value = []
  batchStatus.value = ''
}

async function handleBatchStatusChange() {
  if (selectedBoxes.value.length === 0 || !batchStatus.value) return
  
  await projectStore.batchChangeBoxStatus(selectedBoxes.value, batchStatus.value)
  ElMessage.success(`已将 ${selectedBoxes.value.length} 个箱子状态更改为 ${getBoxStatusLabel(batchStatus.value)}`)
  clearSelection()
}

function handleBoxCommand(command) {
  const { action, box } = command
  
  switch (action) {
    case 'edit':
      editingBox.value = { ...box }
      showEditBox.value = true
      break
    case 'addItem':
      selectedBoxForAddItem.value = box
      editingItem.value = null
      showAddItem.value = true
      break
    case 'exportLabel':
      projectStore.exportBoxLabelHTML(box.id)
      ElMessage.success('标签已导出')
      break
    case 'delete':
      ElMessageBox.confirm(
        `确定要删除箱子 #${box.boxNumber} 吗？里面的物品将会变成未装箱状态。`,
        '删除确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        projectStore.removeBox(box.id)
        ElMessage.success('箱子已删除')
      }).catch(() => {})
      break
  }
}

function editItem(item) {
  editingItem.value = { ...item }
  selectedBoxForAddItem.value = null
  showAddItem.value = true
}

async function deleteItem(item) {
  try {
    await ElMessageBox.confirm(
      `确定要删除物品"${item.name}"吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    projectStore.removeItem(item.id)
    ElMessage.success('物品已删除')
  } catch {
    // 用户取消
  }
}

function handleItemAdded(item) {
  showAddItem.value = false
  editingItem.value = null
  selectedBoxForAddItem.value = null
}

function handleBoxEdited(box) {
  showEditBox.value = false
  editingBox.value = null
}

async function handleImportCSV() {
  const result = await projectStore.importItemsFromCSV()
  if (result.canceled) return
  
  if (result.errors && result.errors.length > 0) {
    ElMessage.warning(`导入完成，但有 ${result.errors.length} 行数据有问题`)
    console.log('Import errors:', result.errors)
  } else if (result.items && result.items.length > 0) {
    ElMessage.success(`成功导入 ${result.items.length} 个物品`)
  }
}

function exportMovingList() {
  projectStore.exportMovingListCSV()
  ElMessage.success('搬运清单已导出')
}

function exportUrgentList() {
  projectStore.exportUrgentListMarkdown()
  ElMessage.success('今晚先拆清单已导出')
}
</script>
