<template>
  <div>
    <div v-if="risks.length === 0" class="empty-state">
      <div class="empty-icon">✅</div>
      <h3 class="empty-title">暂无风险项</h3>
      <p class="empty-description">点击"重新分析"按钮运行风险检查</p>
    </div>

    <div v-else>
      <div v-if="criticalRisks.length > 0" style="margin-bottom: 1.5rem;">
        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--danger-color);">❌</span>
          严重问题 ({{ criticalRisks.length }})
          <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: normal;">
            这些问题必须解决后才能飞行
          </span>
        </h3>
        <RiskItem 
          v-for="risk in criticalRisks" 
          :key="risk.id"
          :risk="risk"
          :mission-id="missionId"
          @updated="handleRiskUpdated"
        />
      </div>

      <div v-if="warningRisks.length > 0" style="margin-bottom: 1.5rem;">
        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--warning-color);">⚠️</span>
          警告 ({{ warningRisks.length }})
          <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: normal;">
            建议关注，部分可改判
          </span>
        </h3>
        <RiskItem 
          v-for="risk in warningRisks" 
          :key="risk.id"
          :risk="risk"
          :mission-id="missionId"
          @updated="handleRiskUpdated"
        />
      </div>

      <div v-if="overriddenRisks.length > 0">
        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--gray-500);">🔄</span>
          已改判项 ({{ overriddenRisks.length }})
          <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: normal;">
            以下问题已由飞手改判放行
          </span>
        </h3>
        <RiskItem 
          v-for="risk in overriddenRisks" 
          :key="risk.id"
          :risk="risk"
          :mission-id="missionId"
          @updated="handleRiskUpdated"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { missionApi } from '@/api';
import RiskItem from './RiskItem.vue';

const props = defineProps({
  risks: {
    type: Array,
    default: () => []
  },
  missionId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['updated']);

const criticalRisks = computed(() => 
  props.risks.filter(r => r.type === 'critical' && !r.isOverridden)
);

const warningRisks = computed(() => 
  props.risks.filter(r => r.type === 'warning' && !r.isOverridden)
);

const overriddenRisks = computed(() => 
  props.risks.filter(r => r.isOverridden)
);

const handleRiskUpdated = () => {
  emit('updated');
};
</script>
