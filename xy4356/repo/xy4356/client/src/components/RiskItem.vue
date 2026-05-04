<template>
  <div 
    class="risk-item"
    :class="[
      risk.type === 'critical' ? 'critical' : 'warning',
      risk.isOverridden ? 'overridden' : ''
    ]"
  >
    <div class="risk-header">
      <div>
        <div class="risk-title">
          {{ getTypeIcon() }} {{ risk.title }}
        </div>
        <div class="risk-category">
          {{ getCategoryText(risk.category) }}
          <span v-if="risk.canOverride" style="margin-left: 0.5rem;">
            (可改判)
          </span>
        </div>
      </div>
      <span 
        class="status-badge"
        :class="risk.type === 'critical' ? 'status-critical' : 'status-warning'"
      >
        {{ risk.type === 'critical' ? '严重' : '警告' }}
      </span>
    </div>

    <p class="risk-description">{{ risk.description }}</p>

    <div v-if="risk.details" style="margin-bottom: 0.75rem; padding: 0.75rem; background: rgba(0,0,0,0.03); border-radius: 4px; font-size: 0.8125rem;">
      <details>
        <summary style="cursor: pointer; color: var(--primary-color);">查看详细信息</summary>
        <pre style="margin-top: 0.5rem; white-space: pre-wrap; word-break: break-all; color: var(--gray-600);">
{{ JSON.stringify(risk.details, null, 2) }}
        </pre>
      </details>
    </div>

    <div v-if="risk.isOverridden" class="override-reason">
      <div class="override-reason-label">改判理由:</div>
      <div class="override-reason-text">{{ risk.overrideReason }}</div>
      <div style="font-size: 0.7rem; color: var(--gray-400); margin-top: 0.25rem;">
        改判时间: {{ risk.overrideTime ? new Date(risk.overrideTime).toLocaleString('zh-CN') : '未知' }}
      </div>
    </div>

    <div class="risk-actions">
      <button 
        v-if="!risk.isOverridden && risk.canOverride && missionId"
        class="btn btn-sm btn-secondary"
        @click="showOverrideModal = true"
      >
        改判放行
      </button>
      <button 
        v-if="risk.isOverridden && missionId"
        class="btn btn-sm btn-secondary"
        @click="handleRevert"
        :disabled="reverting"
      >
        {{ reverting ? '恢复中...' : '恢复原判决' }}
      </button>
    </div>

    <div v-if="showOverrideModal" class="modal-overlay" @click.self="showOverrideModal = false">
      <div class="modal-content" @click.stop>
        <h3 style="margin-bottom: 1rem;">改判风险项</h3>
        <p style="margin-bottom: 1rem; color: var(--gray-600); font-size: 0.875rem;">
          您正在改判以下风险项。请提供改判理由：
        </p>
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--gray-50); border-radius: 4px;">
          <strong>{{ risk.title }}</strong><br/>
          <span style="font-size: 0.8125rem; color: var(--gray-600);">{{ risk.description }}</span>
        </div>
        <div class="form-group">
          <label class="form-label">改判理由 <span style="color: var(--danger-color);">*</span></label>
          <textarea 
            v-model="overrideReason"
            class="form-textarea"
            placeholder="请详细说明改判的理由..."
            rows="3"
          ></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button 
            class="btn btn-secondary" 
            @click="showOverrideModal = false"
          >
            取消
          </button>
          <button 
            class="btn btn-primary" 
            @click="handleOverride"
            :disabled="!overrideReason.trim() || overriding"
          >
            {{ overriding ? '提交中...' : '确认改判' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { missionApi } from '@/api';

const props = defineProps({
  risk: {
    type: Object,
    required: true
  },
  missionId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['updated']);

const showOverrideModal = ref(false);
const overrideReason = ref('');
const overriding = ref(false);
const reverting = ref(false);

const getTypeIcon = () => {
  if (props.risk.isOverridden) return '🔄';
  return props.risk.type === 'critical' ? '❌' : '⚠️';
};

const getCategoryText = (category) => {
  const map = {
    'boundary': '边界合规',
    'altitude': '高度限制',
    'battery': '电池状态',
    'battery_calc': '电量计算',
    'weather': '天气条件',
    'flight_path': '航线数据'
  };
  return map[category] || category;
};

const handleOverride = async () => {
  if (!overrideReason.value.trim() || !props.missionId) return;

  overriding.value = true;
  try {
    await missionApi.overrideRisk(props.missionId, props.risk.id, overrideReason.value.trim());
    showOverrideModal.value = false;
    overrideReason.value = '';
    emit('updated');
  } catch (error) {
    console.error('改判失败:', error);
    alert('改判失败: ' + (error.response?.data?.error || error.message));
  } finally {
    overriding.value = false;
  }
};

const handleRevert = async () => {
  if (!props.missionId) return;

  reverting.value = true;
  try {
    await missionApi.revertRisk(props.missionId, props.risk.id);
    emit('updated');
  } catch (error) {
    console.error('恢复失败:', error);
    alert('恢复失败: ' + (error.response?.data?.error || error.message));
  } finally {
    reverting.value = false;
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
</style>
