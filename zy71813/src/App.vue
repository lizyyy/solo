<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200">
      <div class="max-w-screen-2xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">门店短款追踪</h1>
            <p class="text-sm text-gray-500 mt-0.5">月底关账 · 差异追溯 · 版本留痕</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <p class="text-sm font-medium text-gray-900">{{ currentUser.name }}</p>
              <p class="text-xs text-gray-500">{{ roleLabel }}</p>
            </div>
            <button @click="showEditModal = true; editingRecord = null;" class="btn-primary">
              + 新增记录
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-screen-2xl mx-auto px-6 py-6">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatsCard title="全部记录" :value="stats.total" icon="📋" />
        <StatsCard title="待处理" :value="stats.pending" icon="⏳" valueClass="text-amber-600" />
        <StatsCard title="核查中" :value="stats.investigating" icon="🔍" valueClass="text-blue-600" />
        <StatsCard title="已解决" :value="stats.resolved" icon="✅" valueClass="text-green-600" />
        <StatsCard title="有争议" :value="stats.disputed" icon="⚠️" valueClass="text-red-600" />
        <StatsCard title="需关注" :value="stats.hasAlerts" icon="🔴" valueClass="text-red-600" />
      </div>

      <FilterBar />

      <div class="flex gap-6" :class="{ 'h-[calc(100vh-280px)]': selectedRecord }">
        <div class="flex-1 min-w-0">
          <RecordList
            :records="records"
            :selected-id="selectedRecordId"
            @select="selectRecord"
          />
        </div>
        <div v-if="selectedRecordId" class="w-[480px] flex-shrink-0">
          <RecordDetail
            :record="selectedRecord"
            @close="selectRecord(null)"
            @edit="openEditModal"
            @add-attachment="openAddAttachmentModal"
          />
        </div>
      </div>
    </main>

    <EditRecordModal
      :visible="showEditModal"
      :record="editingRecord"
      @close="showEditModal = false"
      @submit="handleEditSubmit"
    />

    <AddAttachmentModal
      :visible="showAddAttachmentModal"
      :record="selectedRecord"
      @close="showAddAttachmentModal = false"
      @submit="handleAddAttachment"
    />

    <div v-if="notification.show" class="fixed top-4 right-4 z-50">
      <div :class="[
        'px-4 py-3 rounded-lg shadow-lg border',
        notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
        notification.type === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' :
        'bg-blue-50 border-blue-200 text-blue-800'
      ]">
        {{ notification.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import StatsCard from './components/StatsCard.vue';
import FilterBar from './components/FilterBar.vue';
import RecordList from './components/RecordList.vue';
import RecordDetail from './components/RecordDetail.vue';
import EditRecordModal from './components/EditRecordModal.vue';
import AddAttachmentModal from './components/AddAttachmentModal.vue';
import { useShortageStore } from './composables/useShortageStore';
import { currentUser } from './data/sampleData';
import type { ShortageRecord, Attachment } from './types';

const {
  records,
  selectedRecord,
  selectedRecordId,
  stats,
  selectRecord,
  updateRecord,
  createRecord,
  addAttachment
} = useShortageStore();

const showEditModal = ref(false);
const showAddAttachmentModal = ref(false);
const editingRecord = ref<ShortageRecord | null>(null);

const notification = ref({
  show: false,
  message: '',
  type: 'info' as 'success' | 'warning' | 'info'
});

const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    store_accountant: '门店财务',
    hq_accountant: '总部会计',
    finance_manager: '财务经理'
  };
  return labels[currentUser.role] || currentUser.role;
});

function showNotification(message: string, type: 'success' | 'warning' | 'info' = 'info') {
  notification.value = { show: true, message, type };
  setTimeout(() => {
    notification.value.show = false;
  }, 3000);
}

function openEditModal() {
  editingRecord.value = selectedRecord.value;
  showEditModal.value = true;
}

function openAddAttachmentModal() {
  showAddAttachmentModal.value = true;
}

function handleEditSubmit(data: Partial<ShortageRecord>, reason: string) {
  if (editingRecord.value) {
    const result = updateRecord(editingRecord.value.id, data, reason);
    if (result.hasAlert) {
      showNotification(result.alertMessage || '检测到结论变更或版本问题，请关注', 'warning');
    } else if (result.changes.length > 0) {
      showNotification(`已更新记录，共 ${result.changes.length} 处变更`, 'success');
    }
  } else {
    createRecord(data as Omit<ShortageRecord, 'id' | 'versionHistory' | 'currentVersion' | 'createdAt' | 'updatedAt' | 'hasUnresolvedChanges' | 'latestAlert'>);
    showNotification('已创建新记录', 'success');
  }
  showEditModal.value = false;
}

function handleAddAttachment(attachment: Omit<Attachment, 'id' | 'uploadedAt' | 'uploadedBy'>, reason: string) {
  if (!selectedRecord.value) return;
  const result = addAttachment(selectedRecord.value.id, attachment, reason);
  if (result?.hasAlert) {
    showNotification('⚠️ 检测到附件版本异常，已标记提醒', 'warning');
  } else {
    showNotification('附件已上传', 'success');
  }
  showAddAttachmentModal.value = false;
}
</script>
