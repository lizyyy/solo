<template>
  <div class="control-panel">
    <div class="panel-header">
      <h2>弹道参数控制</h2>
      <div class="validation-status" :class="validationClass">
        {{ validationStatus }}
      </div>
    </div>

    <div class="param-section">
      <h3>弹丸参数</h3>
      <div class="param-group">
        <label>
          <span>初速 (m/s)</span>
          <input type="number" v-model.number="params.initialVelocity" min="100" max="1500" step="10" />
        </label>
        <label>
          <span>弹丸质量 (kg)</span>
          <input type="number" v-model.number="params.bulletMass" min="0.001" max="0.1" step="0.001" />
        </label>
        <label>
          <span>弹丸直径 (mm)</span>
          <input type="number" v-model.number="bulletDiameterMm" min="4" max="20" step="0.1" />
        </label>
      </div>
    </div>

    <div class="param-section">
      <h3>环境参数</h3>
      <div class="param-group">
        <label>
          <span>射击距离 (m)</span>
          <input type="number" v-model.number="params.distance" min="10" max="5000" step="50" />
        </label>
        <label>
          <span>射角 (°)</span>
          <input type="number" v-model.number="params.elevationAngle" min="-10" max="45" step="0.5" />
        </label>
      </div>
    </div>

    <div class="param-section">
      <h3>风场参数</h3>
      <div class="param-group">
        <label>
          <span>风速 (m/s)</span>
          <input type="range" v-model.number="params.windSpeed" min="0" max="30" step="0.5" />
          <span class="value-display">{{ params.windSpeed }}</span>
        </label>
        <label>
          <span>风向 (°)</span>
          <input type="range" v-model.number="params.windAngle" min="-180" max="180" step="5" />
          <span class="value-display">{{ params.windAngle }}°</span>
        </label>
        <div class="wind-direction-indicator">
          <div class="wind-arrow" :style="{ transform: `rotate(${params.windAngle}deg)` }">→</div>
          <span class="wind-label">{{ windDirectionLabel }}</span>
        </div>
      </div>
    </div>

    <div class="param-section">
      <h3>单位设置</h3>
      <div class="param-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="useImperial" />
          <span>使用英制单位 (风险警告)</span>
        </label>
      </div>
    </div>

    <div class="validation-messages" v-if="validation.messages.length > 0">
      <div v-for="(msg, idx) in validation.messages" :key="idx" :class="['msg-item', msg.type]">
        <span class="msg-icon">{{ msg.icon }}</span>
        <span>{{ msg.message }}</span>
      </div>
    </div>

    <div class="action-buttons">
      <button class="btn-primary" @click="handleSubmit" :disabled="!validation.isValid">
        提交记录
      </button>
      <button class="btn-secondary" @click="handleReset">
        重置参数
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { validateParams } from '../utils/physics.js';

const emit = defineEmits(['paramsChange', 'submit', 'reset']);

const params = ref({
  initialVelocity: 800,
  bulletMass: 0.01,
  bulletDiameter: 0.00762,
  windSpeed: 5,
  windAngle: 90,
  distance: 500,
  elevationAngle: 0,
  units: 'metric'
});

const useImperial = ref(false);
const bulletDiameterMm = computed({
  get: () => params.value.bulletDiameter * 1000,
  set: (v) => params.value.bulletDiameter = v / 1000
});

const windDirectionLabel = computed(() => {
  const angle = params.value.windAngle;
  if (angle >= -22.5 && angle < 22.5) return '顺风';
  if (angle >= 22.5 && angle < 67.5) return '右顺风';
  if (angle >= 67.5 && angle < 112.5) return '正横风（右）';
  if (angle >= 112.5 && angle < 157.5) return '右逆风';
  if (angle >= 157.5 || angle < -157.5) return '逆风';
  if (angle >= -157.5 && angle < -112.5) return '左逆风';
  if (angle >= -112.5 && angle < -67.5) return '正横风（左）';
  if (angle >= -67.5 && angle < -22.5) return '左顺风';
  return '未知';
});

const validation = computed(() => {
  const checkParams = { ...params.value };
  if (useImperial.value) {
    checkParams.units = 'imperial';
  }
  const result = validateParams(checkParams);
  const messages = [];

  result.errors.forEach(e => messages.push({ ...e, icon: '✕' }));
  result.warnings.forEach(w => messages.push({ ...w, icon: '⚠' }));
  result.info.forEach(i => messages.push({ ...i, icon: 'ℹ' }));

  return {
    isValid: result.isValid,
    hasWarnings: result.warnings.length > 0,
    hasInfo: result.info.length > 0,
    messages
  };
});

const validationClass = computed(() => {
  if (!validation.value.isValid) return 'invalid';
  if (validation.value.hasWarnings) return 'warning';
  if (validation.value.hasInfo) return 'info';
  return 'valid';
});

const validationStatus = computed(() => {
  if (!validation.value.isValid) return '参数异常';
  if (validation.value.hasWarnings) return '存在警告';
  if (validation.value.hasInfo) return '待确认';
  return '参数正常';
});

watch(params, (newParams) => {
  emit('paramsChange', { ...newParams });
}, { deep: true, immediate: true });

watch(useImperial, (val) => {
  params.value.units = val ? 'imperial' : 'metric';
});

function handleSubmit() {
  emit('submit', { ...params.value });
}

function handleReset() {
  params.value = {
    initialVelocity: 800,
    bulletMass: 0.01,
    bulletDiameter: 0.00762,
    windSpeed: 5,
    windAngle: 90,
    distance: 500,
    elevationAngle: 0,
    units: 'metric'
  };
  useImperial.value = false;
  emit('reset');
}
</script>

<style scoped>
.control-panel {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-right: 1px solid #2a2a4e;
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #2a2a4e;
}

.panel-header h2 {
  font-size: 18px;
  color: #e0e0e0;
  font-weight: 600;
}

.validation-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.validation-status.valid { background: #10b98120; color: #10b981; }
.validation-status.warning { background: #f59e0b20; color: #f59e0b; }
.validation-status.info { background: #3b82f620; color: #3b82f6; }
.validation-status.invalid { background: #ef444420; color: #ef4444; }

.param-section {
  margin-bottom: 24px;
}

.param-section h3 {
  font-size: 14px;
  color: #8888aa;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-group label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-group label span {
  font-size: 13px;
  color: #aaaacc;
}

.param-group input[type="number"] {
  background: #0a0a15;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 14px;
  transition: all 0.2s;
}

.param-group input[type="number"]:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px #3b82f620;
}

.param-group input[type="range"] {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: #2a2a4e;
  border-radius: 3px;
  outline: none;
}

.param-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s;
}

.param-group input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.value-display {
  color: #3b82f6;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.wind-direction-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #0a0a15;
  border-radius: 8px;
  border: 1px solid #2a2a4e;
}

.wind-arrow {
  font-size: 24px;
  color: #00aaff;
  transition: transform 0.3s;
}

.wind-label {
  font-size: 13px;
  color: #aaaacc;
}

.checkbox-label {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #f59e0b;
}

.validation-messages {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
}

.msg-item.error { background: #ef444415; color: #ef4444; }
.msg-item.wind_direction { background: #f59e0b15; color: #f59e0b; }
.msg-item.units { background: #f59e0b15; color: #f59e0b; }
.msg-item.wind_reverse { background: #3b82f615; color: #3b82f6; }

.msg-icon {
  font-size: 14px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.action-buttons button {
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px #3b82f640;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #2a2a4e;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background: #3a3a5e;
}
</style>
