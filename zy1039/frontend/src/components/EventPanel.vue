<template>
  <div class="event-panel">
    <div v-if="!machine" class="empty-state">
      <el-icon class="empty-icon"><Document /></el-icon>
      <div class="empty-title">未加载状态机</div>
      <div class="empty-desc">请先打开一个项目</div>
    </div>
    
    <div v-else>
      <div v-if="eventSequence.length === 0" class="empty-state">
        <el-icon class="empty-icon"><List /></el-icon>
        <div class="empty-title">暂无事件序列</div>
        <div class="empty-desc">从下方选择事件添加到序列中</div>
      </div>
      
      <div v-else class="event-list">
        <div
          v-for="(event, index) in eventSequence"
          :key="index"
          class="event-item"
          :class="{
            executed: currentStep > index,
            current: currentStep === index,
            failed: isEventFailed(index)
          }"
        >
          <span class="event-index" :class="{
            executed: currentStep > index,
            current: currentStep === index,
            failed: isEventFailed(index)
          }">
            {{ index + 1 }}
          </span>
          <div class="event-info">
            <div class="event-name">{{ event.name }}</div>
            <div v-if="event.data" class="event-data">
              {{ JSON.stringify(event.data) }}
            </div>
          </div>
          <div class="event-actions">
            <el-button size="small" text @click="editEvent(index)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" text type="danger" @click="removeEvent(index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      
      <div class="add-event-section">
        <div class="section-title">
          <el-icon><Plus /></el-icon>
          添加事件
        </div>
        
        <el-form :inline="true" :model="addEventForm" class="add-event-form">
          <el-form-item label="事件">
            <el-select
              v-model="addEventForm.name"
              placeholder="选择事件"
              filterable
              style="width: 200px"
            >
              <el-option
                v-for="eventName in availableEvents"
                :key="eventName"
                :label="eventName"
                :value="eventName"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="数据">
            <el-input
              v-model="addEventForm.dataStr"
              placeholder="JSON 数据（可选）"
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="addEvent">添加</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <div class="action-buttons" style="margin-top: 16px; display: flex; gap: 8px;">
        <el-button type="primary" @click="handleRun" :loading="loading">
          <el-icon><VideoPlay /></el-icon>
          执行全部
        </el-button>
        <el-button @click="clearSequence">
          <el-icon><Delete /></el-icon>
          清空
        </el-button>
      </div>
    </div>
    
    <el-dialog v-model="editDialogVisible" title="编辑事件" width="400px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="事件名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="事件数据">
          <el-input
            v-model="editForm.dataStr"
            type="textarea"
            :rows="4"
            placeholder='{"key": "value"}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditEvent">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { StateMachine, EventItem } from '@/api';

interface Props {
  machine: StateMachine | null;
  eventSequence: EventItem[];
  currentStep: number;
  executionResults: any[];
}

const props = withDefaults(defineProps<Props>(), {
  machine: null,
  eventSequence: () => [],
  currentStep: -1,
  executionResults: () => []
});

const emit = defineEmits<{
  (e: 'update', sequence: EventItem[]): void;
  (e: 'step', event: EventItem, index: number): void;
  (e: 'run'): void;
}>();

const loading = ref(false);
const editDialogVisible = ref(false);
const editingIndex = ref(-1);

const addEventForm = ref({
  name: '',
  dataStr: ''
});

const editForm = ref({
  name: '',
  dataStr: ''
});

const availableEvents = computed(() => {
  if (!props.machine) return [];
  const events = new Set<string>();
  for (const state of Object.values(props.machine.states)) {
    for (const eventName of Object.keys(state.on)) {
      events.add(eventName);
    }
  }
  return Array.from(events).sort();
});

const isEventFailed = (index: number) => {
  if (props.executionResults[index]) {
    return !props.executionResults[index].result?.success;
  }
  return false;
};

const addEvent = () => {
  if (!addEventForm.value.name) return;
  
  const newEvent: EventItem = {
    name: addEventForm.value.name
  };
  
  if (addEventForm.value.dataStr.trim()) {
    try {
      newEvent.data = JSON.parse(addEventForm.value.dataStr);
    } catch {
      newEvent.data = { raw: addEventForm.value.dataStr };
    }
  }
  
  const newSequence = [...props.eventSequence, newEvent];
  emit('update', newSequence);
  
  addEventForm.value = { name: '', dataStr: '' };
};

const removeEvent = (index: number) => {
  const newSequence = props.eventSequence.filter((_, i) => i !== index);
  emit('update', newSequence);
};

const editEvent = (index: number) => {
  const event = props.eventSequence[index];
  editingIndex.value = index;
  editForm.value.name = event.name;
  editForm.value.dataStr = event.data ? JSON.stringify(event.data, null, 2) : '';
  editDialogVisible.value = true;
};

const saveEditEvent = () => {
  if (editingIndex.value < 0) return;
  
  const newSequence = [...props.eventSequence];
  newSequence[editingIndex.value] = {
    name: editForm.value.name,
    data: editForm.value.dataStr.trim() ? JSON.parse(editForm.value.dataStr) : undefined
  };
  
  emit('update', newSequence);
  editDialogVisible.value = false;
};

const clearSequence = () => {
  emit('update', []);
};

const handleRun = () => {
  emit('run');
};
</script>
