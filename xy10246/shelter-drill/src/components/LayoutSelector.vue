<template>
  <div class="layout-selector">
    <h3>1. 选择场地布局</h3>
    <div class="preset-layouts">
      <div 
        v-for="layout in sampleLayouts" 
        :key="layout.id"
        :class="['layout-card', { active: selectedLayoutId === layout.id }]"
        @click="selectPresetLayout(layout.id)"
      >
        <div class="layout-icon">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect x="5" y="5" width="30" height="30" fill="#e3f2fd" stroke="#1976d2" stroke-width="2" />
            <circle cx="12" cy="20" r="4" fill="#66bb6a" />
            <circle cx="28" cy="20" r="4" fill="#66bb6a" />
            <rect x="14" y="28" width="12" height="6" fill="#42a5f5" />
          </svg>
        </div>
        <div class="layout-info">
          <div class="layout-name">{{ layout.name }}</div>
          <div class="layout-desc">{{ layout.description }}</div>
          <div class="layout-stats">
            <span>入口: {{ layout.layout.entrances.length }}</span>
            <span>帐篷区: {{ layout.layout.tentZones.length }}</span>
            <span>物资点: {{ layout.layout.supplyPoints.length }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="custom-input-section">
      <h4>或导入自定义布局 (JSON)</h4>
      <textarea 
        v-model="customJsonText"
        placeholder="粘贴场地布局 JSON 数据..."
        @input="parseCustomJson"
      ></textarea>
      <div v-if="customJsonError" class="error-message">{{ customJsonError }}</div>
    </div>
    
    <div class="anomaly-test-section">
      <h4>异常样例测试</h4>
      <div class="anomaly-buttons">
        <button 
          class="anomaly-btn duplicate"
          @click="testAnomaly('duplicateData')"
        >
          测试重复数据
        </button>
        <button 
          class="anomaly-btn missing"
          @click="testAnomaly('missingFields')"
        >
          测试缺字段
        </button>
        <button 
          class="anomaly-btn manual"
          @click="testAnomaly('manualError')"
        >
          测试人工改错
        </button>
      </div>
    </div>
    
    <div v-if="validationResult" class="validation-result">
      <div :class="['validation-header', validationResult.valid ? 'valid' : 'invalid']">
        {{ validationResult.valid ? '数据校验通过' : '数据校验失败' }}
      </div>
      <div v-if="validationResult.errors.length > 0" class="validation-errors">
        <div class="validation-title">错误:</div>
        <ul>
          <li v-for="(error, idx) in validationResult.errors" :key="idx">{{ error }}</li>
        </ul>
      </div>
      <div v-if="validationResult.warnings.length > 0" class="validation-warnings">
        <div class="validation-title">警告:</div>
        <ul>
          <li v-for="(warning, idx) in validationResult.warnings" :key="idx">{{ warning }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, watch } from 'vue';
import { sampleLayouts, anomalySamples } from '../data/sampleData';
import { validateLayout } from '../utils/calculator';
const emit = defineEmits(['layoutChange']);
const selectedLayoutId = ref(null);
const customJsonText = ref('');
const customJsonError = ref('');
const currentLayout = ref(null);
const validationResult = ref(null);
function selectPresetLayout(layoutId) {
 selectedLayoutId.value = layoutId;
 customJsonText.value = '';
 customJsonError.value = '';
 const layout = sampleLayouts.find(l => l.id === layoutId);
 if (layout) {
 currentLayout.value = JSON.parse(JSON.stringify(layout.layout));
 validateCurrentLayout();
 emitLayoutChange();
 }
}
function parseCustomJson() {
 if (!customJsonText.value.trim()) {
 customJsonError.value = '';
 currentLayout.value = null;
 validationResult.value = null;
 return;
 }
 try {
 const parsed = JSON.parse(customJsonText.value);
 currentLayout.value = parsed;
 customJsonError.value = '';
 selectedLayoutId.value = null;
 validateCurrentLayout();
 emitLayoutChange();
 }
 catch (e) {
 customJsonError.value = `JSON 解析错误: ${e.message}`;
 currentLayout.value = null;
 validationResult.value = null;
 }
}
function testAnomaly(anomalyType) {
 const sample = anomalySamples[anomalyType];
 if (sample) {
 customJsonText.value = JSON.stringify(sample.layout, null, 2);
 parseCustomJson();
 }
}
function validateCurrentLayout() {
 if (currentLayout.value) {
 validationResult.value = validateLayout(currentLayout.value);
 }
}
function emitLayoutChange() {
 emit('layoutChange', {
 layout: currentLayout.value,
 validation: validationResult.value,
 layoutId: selectedLayoutId.value
 });
}
watch([currentLayout, validationResult], () => {
}, { deep: true });
selectPresetLayout('community-park');
</script>

<style scoped>
.layout-selector {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

h4 {
  margin-top: 20px;
  margin-bottom: 12px;
  color: #555;
  font-size: 14px;
}

.preset-layouts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.layout-card {
  display: flex;
  padding: 12px;
  background: white;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.layout-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border-color: #90caf9;
}

.layout-card.active {
  border-color: #1976d2;
  background: #e3f2fd;
}

.layout-icon {
  margin-right: 12px;
  flex-shrink: 0;
}

.layout-info {
  flex: 1;
}

.layout-name {
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.layout-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.layout-stats {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #888;
}

.custom-input-section {
  margin-top: 20px;
}

textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
}

textarea:focus {
  outline: none;
  border-color: #1976d2;
}

.error-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  font-size: 13px;
}

.anomaly-test-section {
  margin-top: 20px;
}

.anomaly-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.anomaly-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: opacity 0.2s;
}

.anomaly-btn:hover {
  opacity: 0.85;
}

.anomaly-btn.duplicate {
  background: #fff3e0;
  color: #ef6c00;
}

.anomaly-btn.missing {
  background: #ffebee;
  color: #c62828;
}

.anomaly-btn.manual {
  background: #fce4ec;
  color: #c2185b;
}

.validation-result {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  background: white;
}

.validation-header {
  font-weight: bold;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.validation-header.valid {
  background: #e8f5e9;
  color: #2e7d32;
}

.validation-header.invalid {
  background: #ffebee;
  color: #c62828;
}

.validation-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 4px;
}

.validation-errors {
  margin-bottom: 12px;
  padding: 8px;
  background: #ffebee;
  border-radius: 4px;
}

.validation-errors li {
  color: #c62828;
  font-size: 13px;
  margin: 4px 0;
}

.validation-warnings {
  padding: 8px;
  background: #fff3e0;
  border-radius: 4px;
}

.validation-warnings li {
  color: #ef6c00;
  font-size: 13px;
  margin: 4px 0;
}

@media (max-width: 768px) {
  .layout-selector {
    padding: 12px;
  }
  
  .preset-layouts {
    grid-template-columns: 1fr;
  }
  
  .anomaly-buttons {
    flex-direction: column;
  }
  
  .anomaly-btn {
    width: 100%;
  }
}
</style>
