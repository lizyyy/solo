<template>
  <div class="transfers-view">
    <div class="card mb-6">
      <div class="card-header">
        <div class="card-title">🚑 转运队列管理</div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" @click="fetchData">
            🔄 刷新
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="tabs mb-4 flex gap-2">
          <button 
            class="btn btn-sm" 
            :class="activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'"
            @click="activeTab = 'pending'"
          >
            待处理 ({{ transfersStore.stats.pending }})
          </button>
          <button 
            class="btn btn-sm" 
            :class="activeTab === 'in_progress' ? 'btn-primary' : 'btn-secondary'"
            @click="activeTab = 'in_progress'"
          >
            进行中 ({{ transfersStore.stats.inProgress }})
          </button>
          <button 
            class="btn btn-sm" 
            :class="activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'"
            @click="activeTab = 'completed'"
          >
            已完成 ({{ transfersStore.stats.completed }})
          </button>
        </div>
        
        <div v-if="activeTab === 'pending'">
          <div class="alert alert-info mb-4">
            💡 提示：您可以拖拽转运项来调整优先级顺序，系统会自动保存新的排序。
          </div>
          
          <div v-if="pendingTransfers.length === 0" class="empty-state">
            <div class="empty-state-icon">🚑</div>
            <div class="empty-state-text">暂无待转运患者</div>
            <div class="empty-state-hint">患者在"治疗中"状态时可以申请转运</div>
          </div>
          
          <div v-else ref="pendingTransferList" class="transfer-list">
            <div 
              v-for="(transfer, index) in pendingTransfers" 
              :key="transfer.id"
              class="transfer-item draggable-item"
              :class="'triage-' + (transfer.triageLevel || 'green')"
              :data-id="transfer.id"
            >
              <div class="transfer-header flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                  <span class="queue-number" :style="{ backgroundColor: getPriorityColor(transfer.priority) }">
                    {{ transfer.queuePosition }}
                  </span>
                  <div>
                    <div class="transfer-patient font-semibold text-lg">
                      {{ transfer.patientName || '未知患者' }}
                    </div>
                    <div class="text-sm text-muted">
                      从 {{ transfer.fromDepartment || '急诊科' }} → 到 {{ transfer.toDepartment }}
                    </div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <span class="badge" :class="'triage-badge-' + (transfer.triageLevel || 'green')">
                    {{ patientsStore.getTriageLabel(transfer.triageLevel) }}
                  </span>
                  <span class="badge" :style="{ backgroundColor: getPriorityColor(transfer.priority), color: 'white' }">
                    优先级: {{ getPriorityLabel(transfer.priority) }}
                  </span>
                </div>
              </div>
              
              <div v-if="transfer.reason" class="transfer-details text-sm text-muted mb-3">
                <strong>原因：</strong>{{ transfer.reason }}
              </div>
              
              <div class="transfer-footer flex justify-between items-center text-sm text-muted">
                <span>申请时间：{{ formatTime(transfer.assignedAt) }}</span>
                <div class="flex gap-2">
                  <button 
                    class="btn btn-primary btn-sm" 
                    @click="startTransfer(transfer)"
                  >
                    ▶️ 开始转运
                  </button>
                  <button 
                    class="btn btn-success btn-sm" 
                    @click="completeTransfer(transfer)"
                  >
                    ✅ 完成
                  </button>
                  <button 
                    class="btn btn-secondary btn-sm" 
                    @click="cancelTransfer(transfer)"
                  >
                    ❌ 取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else-if="activeTab === 'in_progress'">
          <div v-if="inProgressTransfers.length === 0" class="empty-state">
            <div class="empty-state-icon">🚚</div>
            <div class="empty-state-text">暂无转运中的患者</div>
          </div>
          
          <div v-else class="transfer-list">
            <div 
              v-for="transfer in inProgressTransfers" 
              :key="transfer.id"
              class="transfer-item triage-blue"
            >
              <div class="transfer-header flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                  <div>
                    <div class="transfer-patient font-semibold text-lg">
                      {{ transfer.patientName || '未知患者' }}
                    </div>
                    <div class="text-sm text-muted">
                      转运中：{{ transfer.fromDepartment || '急诊科' }} → {{ transfer.toDepartment }}
                    </div>
                  </div>
                </div>
                <span class="badge badge-info pulse">转运中</span>
              </div>
              
              <div class="transfer-footer flex justify-end gap-2">
                <button 
                  class="btn btn-success btn-sm" 
                  @click="completeTransfer(transfer)"
                >
                  ✅ 完成转运
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else-if="activeTab === 'completed'">
          <div v-if="completedTransfers.length === 0" class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-text">暂无已完成的转运记录</div>
          </div>
          
          <div v-else class="table-wrapper" style="overflow-x: auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>患者</th>
                  <th>分诊级别</th>
                  <th>来源科室</th>
                  <th>目标科室</th>
                  <th>原因</th>
                  <th>申请时间</th>
                  <th>完成时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="transfer in completedTransfers" :key="transfer.id">
                  <td><strong>{{ transfer.patientName || '-' }}</strong></td>
                  <td>
                    <span class="badge" :class="'triage-badge-' + (transfer.triageLevel || 'green')">
                      {{ patientsStore.getTriageLabel(transfer.triageLevel) }}
                    </span>
                  </td>
                  <td>{{ transfer.fromDepartment || '-' }}</td>
                  <td>{{ transfer.toDepartment || '-' }}</td>
                  <td>{{ transfer.reason || '-' }}</td>
                  <td>{{ formatTime(transfer.assignedAt) }}</td>
                  <td>{{ formatTime(transfer.transferredAt) }}</td>
                  <td>
                    <span class="badge" :class="transfer.status === 'completed' ? 'badge-success' : 'badge-gray'">
                      {{ transfersStore.getStatusLabel(transfer.status) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTransfersStore } from '@/stores/transfers'
import { usePatientsStore } from '@/stores/patients'
import Sortable from 'sortablejs'

const transfersStore = useTransfersStore()
const patientsStore = usePatientsStore()

const activeTab = ref('pending')
const pendingTransferList = ref(null)

const pendingTransfers = computed(() => transfersStore.pendingTransfers)
const inProgressTransfers = computed(() => transfersStore.inProgressTransfers)
const completedTransfers = computed(() => transfersStore.completedTransfers)

function formatTime(time) {
  if (!time) return '-'
  const d = new Date(time)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getPriorityLabel(priority) {
  return transfersStore.getPriorityLabel(priority)
}

function getPriorityColor(priority) {
  return transfersStore.getPriorityColor(priority)
}

async function startTransfer(transfer) {
  try {
    await transfersStore.updateTransfer(transfer.id, { status: 'in_progress' })
    await fetchData()
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function completeTransfer(transfer) {
  if (!confirm('确定要标记此转运为已完成吗？')) {
    return
  }
  try {
    await transfersStore.updateTransfer(transfer.id, { status: 'completed' })
    await fetchData()
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function cancelTransfer(transfer) {
  if (!confirm('确定要取消此转运请求吗？')) {
    return
  }
  try {
    await transfersStore.updateTransfer(transfer.id, { status: 'cancelled' })
    await fetchData()
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function fetchData() {
  await transfersStore.fetchTransfers()
}

let sortableInstance = null

function initSortable() {
  if (sortableInstance) {
    sortableInstance.destroy()
  }
  
  if (pendingTransferList.value) {
    sortableInstance = new Sortable(pendingTransferList.value, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: async (evt) => {
        const orderedTransfers = Array.from(pendingTransferList.value.children).map((el, index) => ({
          id: el.getAttribute('data-id') || pendingTransfers.value[evt.oldIndex]?.id || pendingTransfers.value[index]?.id,
          queuePosition: index + 1
        })).filter(t => t.id)
        
        if (orderedTransfers.length > 0) {
          try {
            await transfersStore.reorderTransfers(orderedTransfers)
            await fetchData()
          } catch (error) {
            console.error('重新排序失败:', error)
          }
        }
      }
    })
  }
}

watch(activeTab, (val) => {
  if (val === 'pending') {
    setTimeout(initSortable, 100)
  }
})

watch(pendingTransfers, () => {
  if (activeTab.value === 'pending') {
    setTimeout(initSortable, 100)
  }
}, { deep: true })

onMounted(() => {
  fetchData()
})

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy()
  }
})
</script>

<style scoped>
.transfers-view {
  width: 100%;
}

.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.transfer-item {
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius);
  padding: 20px;
  transition: all var(--transition-fast);
  border-left: 4px solid transparent;
}

.transfer-item:hover {
  box-shadow: var(--shadow-md);
}

.transfer-item.triage-red {
  border-left-color: var(--color-red);
  background-color: #fef2f2;
}

.transfer-item.triage-yellow {
  border-left-color: var(--color-yellow);
  background-color: #fefce8;
}

.transfer-item.triage-green {
  border-left-color: var(--color-green);
  background-color: #f0fdf4;
}

.transfer-item.triage-blue {
  border-left-color: var(--color-blue);
  background-color: #eff6ff;
}

.queue-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.transfer-patient {
  font-size: 16px;
  color: var(--color-gray-900);
}

.tabs {
  border-bottom: 1px solid var(--color-gray-200);
  padding-bottom: 12px;
}

@media (max-width: 768px) {
  .transfer-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .transfer-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .transfer-footer .flex {
    justify-content: center;
  }
}
</style>
