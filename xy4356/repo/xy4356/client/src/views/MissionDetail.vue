<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">
          {{ isNew ? '新建任务' : mission?.name || '任务详情' }}
        </h1>
        <p v-if="!isNew" class="mission-description" style="margin-top: 0.25rem;">
          {{ mission?.description || '暂无描述' }}
        </p>
      </div>
      <div class="page-actions">
        <button 
          v-if="!isNew" 
          class="btn btn-secondary" 
          @click="handleAnalyze"
          :disabled="analyzing"
        >
          {{ analyzing ? '分析中...' : '🔄 重新分析' }}
        </button>
        <button 
          v-if="!isNew" 
          class="btn btn-secondary" 
          @click="exportApi.downloadChecklist(mission.id)"
        >
          📝 导出检查单
        </button>
        <button 
          v-if="!isNew" 
          class="btn btn-secondary" 
          @click="exportApi.downloadAuditPackage(mission.id)"
        >
          📦 导出审计包
        </button>
        <button 
          v-if="!isNew" 
          class="btn btn-primary" 
          @click="handleSave"
          :disabled="saving"
        >
          {{ saving ? '保存中...' : '💾 保存' }}
        </button>
        <button 
          v-if="isNew" 
          class="btn btn-primary" 
          @click="handleCreate"
          :disabled="creating"
        >
          {{ creating ? '创建中...' : '✅ 创建任务' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else>
      <div v-if="!isNew && mission?.summary" class="card" style="margin-bottom: 1.5rem;">
        <div class="card-body">
          <div 
            class="alert" 
            :class="getAlertClass(mission.summary.status)"
          >
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong style="font-size: 1rem;">
                  {{ getStatusIcon(mission.summary.status) }} 
                  {{ mission.summary.message }}
                </strong>
                <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                  严重问题: <strong>{{ mission.summary.criticalCount }}</strong> 项 | 
                  警告: <strong>{{ mission.summary.warningCount }}</strong> 项 | 
                  已改判: <strong>{{ mission.summary.overriddenCount }}</strong> 项
                </div>
              </div>
              <span 
                class="status-badge" 
                :class="getStatusClass(mission.summary.status)"
                style="font-size: 0.875rem;"
              >
                {{ getStatusText(mission.summary.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="tabs">
        <div 
          class="tab" 
          :class="{ active: activeTab === 'basic' }"
          @click="activeTab = 'basic'"
        >
          📝 基本信息
        </div>
        <div 
          class="tab" 
          :class="{ active: activeTab === 'map' }"
          @click="activeTab = 'map'"
        >
          🗺️ 地图视图
        </div>
        <div 
          class="tab" 
          :class="{ active: activeTab === 'altitude' }"
          @click="activeTab = 'altitude'"
        >
          📊 高度剖面
        </div>
        <div 
          class="tab" 
          :class="{ active: activeTab === 'risks' }"
          @click="activeTab = 'risks'"
        >
          ⚠️ 风险清单
          <span v-if="unresolvedRisksCount > 0" style="margin-left: 0.25rem; padding: 0 0.375rem; background: var(--danger-color); color: white; border-radius: 9999px; font-size: 0.75rem;">
            {{ unresolvedRisksCount }}
          </span>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'basic' }">
        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <span class="card-title">任务信息</span>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">任务名称</label>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="formData.name"
                  placeholder="请输入任务名称"
                />
              </div>
              <div class="form-group">
                <label class="form-label">任务描述</label>
                <textarea 
                  class="form-textarea" 
                  v-model="formData.description"
                  placeholder="请输入任务描述"
                  rows="3"
                ></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">标签</label>
                <input 
                  type="text" 
                  class="form-input" 
                  :value="formData.tags?.join(', ') || ''"
                  @input="handleTagsInput"
                  placeholder="用逗号分隔多个标签"
                />
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">航线 KML</span>
            </div>
            <div class="card-body">
              <FileUpload 
                accept=".kml,.kmz"
                label="上传航线 KML 文件"
                hint="支持 .kml 格式文件"
                @upload="handleKMLUpload"
                :fileInfo="files.kml"
              />
              <div v-if="formData.flightPath?.length > 0" class="file-info" style="margin-top: 0.75rem;">
                <div class="file-info-name">
                  <span class="file-icon">📍</span>
                  <span class="file-name">航线数据已加载</span>
                </div>
                <span class="file-status">{{ formData.flightPath.length }} 个航点</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">限制区域 GeoJSON</span>
            </div>
            <div class="card-body">
              <FileUpload 
                accept=".geojson,.json"
                label="上传限制区域 GeoJSON 文件"
                hint="支持 .geojson 格式文件，包含禁飞区和限高区"
                @upload="handleGeoJSONUpload"
                :fileInfo="files.geojson"
              />
              <div v-if="formData.restrictedZones?.features?.length > 0" class="file-info" style="margin-top: 0.75rem;">
                <div class="file-info-name">
                  <span class="file-icon">🚫</span>
                  <span class="file-name">限制区域已加载</span>
                </div>
                <span class="file-status">{{ formData.restrictedZones.features.length }} 个区域</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">电池循环记录 CSV</span>
            </div>
            <div class="card-body">
              <FileUpload 
                accept=".csv"
                label="上传电池循环记录 CSV 文件"
                hint="支持 .csv 格式文件，包含电池编号、循环次数等"
                @upload="handleCSVUpload"
                :fileInfo="files.csv"
              />
              <div v-if="formData.batteryData?.batteries?.length > 0" class="file-info" style="margin-top: 0.75rem;">
                <div class="file-info-name">
                  <span class="file-icon">🔋</span>
                  <span class="file-name">电池数据已加载</span>
                </div>
                <span class="file-status">{{ formData.batteryData.batteries.length }} 块电池</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">天气窗口</span>
            </div>
            <div class="card-body">
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">日期</label>
                  <input 
                    type="date" 
                    class="form-input" 
                    v-model="formData.weatherWindow.date"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">开始时间</label>
                  <input 
                    type="time" 
                    class="form-input" 
                    v-model="formData.weatherWindow.startTime"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">结束时间</label>
                  <input 
                    type="time" 
                    class="form-input" 
                    v-model="formData.weatherWindow.endTime"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">风速 (m/s)</label>
                  <input 
                    type="number" 
                    class="form-input" 
                    v-model.number="formData.weatherWindow.windSpeed"
                    placeholder="如: 5"
                    step="0.1"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">能见度 (km)</label>
                  <input 
                    type="number" 
                    class="form-input" 
                    v-model.number="formData.weatherWindow.visibility"
                    placeholder="如: 10"
                    step="0.1"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">气温 (°C)</label>
                  <input 
                    type="number" 
                    class="form-input" 
                    v-model.number="formData.weatherWindow.temperature"
                    placeholder="如: 25"
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">备注</label>
                <textarea 
                  class="form-textarea" 
                  v-model="formData.weatherWindow.notes"
                  placeholder="其他天气相关信息"
                  rows="2"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">飞手与飞行器信息</span>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">飞手姓名</label>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="formData.pilotInfo.name"
                  placeholder="请输入飞手姓名"
                />
              </div>
              <div class="form-group">
                <label class="form-label">执照编号</label>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="formData.pilotInfo.licenseNumber"
                  placeholder="请输入执照编号"
                />
              </div>
              <div class="form-group">
                <label class="form-label">联系方式</label>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="formData.pilotInfo.contact"
                  placeholder="请输入联系方式"
                />
              </div>
              <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);" />
              <div class="form-group">
                <label class="form-label">飞行器型号</label>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="formData.aircraftInfo.model"
                  placeholder="如: DJI Mavic 3"
                />
              </div>
              <div class="form-group">
                <label class="form-label">飞行器序列号</label>
                <input 
                  type="text" 
                  class="form-input" 
                  v-model="formData.aircraftInfo.serialNumber"
                  placeholder="请输入序列号"
                />
              </div>
              <div class="form-group">
                <label class="form-label">最大飞行时间 (分钟)</label>
                <input 
                  type="number" 
                  class="form-input" 
                  v-model.number="formData.aircraftInfo.maxFlightTime"
                  placeholder="如: 30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'map' }">
        <div class="card">
          <div class="card-header">
            <span class="card-title">地图视图</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <MapView 
              :flightPath="formData.flightPath"
              :restrictedZones="formData.restrictedZones"
              :risks="mission?.risks"
            />
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'altitude' }">
        <div class="card">
          <div class="card-header">
            <span class="card-title">高度剖面图</span>
          </div>
          <div class="card-body">
            <AltitudeChart :flightPath="formData.flightPath" />
          </div>
        </div>
      </div>

      <div class="tab-content" :class="{ active: activeTab === 'risks' }">
        <div class="card">
          <div class="card-header">
            <span class="card-title">风险清单</span>
          </div>
          <div class="card-body">
            <RiskList 
              :risks="mission?.risks || []"
              :missionId="mission?.id"
              @updated="handleRiskUpdated"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { missionApi, uploadApi, exportApi } from '@/api';
import FileUpload from '@/components/FileUpload.vue';
import MapView from '@/components/MapView.vue';
import AltitudeChart from '@/components/AltitudeChart.vue';
import RiskList from '@/components/RiskList.vue';

const route = useRoute();
const router = useRouter();

const isNew = computed(() => route.path === '/new');
const missionId = computed(() => route.params.id);

const loading = ref(true);
const saving = ref(false);
const creating = ref(false);
const analyzing = ref(false);
const mission = ref(null);
const activeTab = ref('basic');

const files = ref({
  kml: null,
  geojson: null,
  csv: null
});

const formData = ref({
  name: '',
  description: '',
  tags: [],
  flightPath: [],
  restrictedZones: { type: 'FeatureCollection', features: [] },
  batteryData: { batteries: [], rawData: [] },
  weatherWindow: {
    date: null,
    startTime: null,
    endTime: null,
    windSpeed: null,
    windDirection: null,
    visibility: null,
    temperature: null,
    notes: ''
  },
  pilotInfo: {
    name: '',
    licenseNumber: '',
    contact: ''
  },
  aircraftInfo: {
    model: '',
    serialNumber: '',
    maxFlightTime: 30
  }
});

const unresolvedRisksCount = computed(() => {
  if (!mission.value?.risks) return 0;
  return mission.value.risks.filter(r => !r.isOverridden).length;
});

const getAlertClass = (status) => {
  switch (status) {
    case 'ok': return 'alert-success';
    case 'warning': return 'alert-warning';
    case 'critical': return 'alert-danger';
    default: return 'alert-info';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'ok': return '✅';
    case 'warning': return '⚠️';
    case 'critical': return '❌';
    default: return 'ℹ️';
  }
};

const getStatusClass = (status) => {
  switch (status) {
    case 'ok': return 'status-ok';
    case 'warning': return 'status-warning';
    case 'critical': return 'status-critical';
    default: return 'status-draft';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'ok': return '检查通过';
    case 'warning': return '有警告';
    case 'critical': return '不通过';
    default: return '待检查';
  }
};

const handleTagsInput = (event) => {
  const value = event.target.value;
  formData.value.tags = value.split(',').map(t => t.trim()).filter(t => t);
};

const handleKMLUpload = async (file) => {
  files.value.kml = { name: file.name, status: 'uploading' };
  try {
    const result = await uploadApi.uploadKML(file);
    formData.value.flightPath = result.data.flightPath || result.data.waypoints || [];
    if (!formData.value.name && result.data.name) {
      formData.value.name = result.data.name;
    }
    files.value.kml = { name: file.name, status: 'success' };
  } catch (error) {
    console.error('上传 KML 失败:', error);
    files.value.kml = { name: file.name, status: 'error', error: error.message };
  }
};

const handleGeoJSONUpload = async (file) => {
  files.value.geojson = { name: file.name, status: 'uploading' };
  try {
    const result = await uploadApi.uploadGeoJSON(file);
    formData.value.restrictedZones = result.data;
    files.value.geojson = { name: file.name, status: 'success' };
  } catch (error) {
    console.error('上传 GeoJSON 失败:', error);
    files.value.geojson = { name: file.name, status: 'error', error: error.message };
  }
};

const handleCSVUpload = async (file) => {
  files.value.csv = { name: file.name, status: 'uploading' };
  try {
    const result = await uploadApi.uploadCSV(file);
    formData.value.batteryData = result.data;
    files.value.csv = { name: file.name, status: 'success' };
  } catch (error) {
    console.error('上传 CSV 失败:', error);
    files.value.csv = { name: file.name, status: 'error', error: error.message };
  }
};

const handleCreate = async () => {
  creating.value = true;
  try {
    const newMission = await missionApi.create(formData.value);
    router.push(`/mission/${newMission.id}`);
  } catch (error) {
    console.error('创建任务失败:', error);
    alert('创建任务失败: ' + (error.response?.data?.error || error.message));
  } finally {
    creating.value = false;
  }
};

const handleSave = async () => {
  saving.value = true;
  try {
    const updated = await missionApi.update(missionId.value, formData.value);
    mission.value = updated;
    alert('保存成功');
  } catch (error) {
    console.error('保存任务失败:', error);
    alert('保存任务失败: ' + (error.response?.data?.error || error.message));
  } finally {
    saving.value = false;
  }
};

const handleAnalyze = async () => {
  analyzing.value = true;
  try {
    const result = await missionApi.analyze(missionId.value);
    mission.value = result.mission;
    activeTab.value = 'risks';
  } catch (error) {
    console.error('分析任务失败:', error);
    alert('分析任务失败: ' + (error.response?.data?.error || error.message));
  } finally {
    analyzing.value = false;
  }
};

const handleRiskUpdated = async () => {
  try {
    mission.value = await missionApi.getById(missionId.value);
  } catch (error) {
    console.error('刷新任务数据失败:', error);
  }
};

onMounted(async () => {
  if (isNew.value) {
    loading.value = false;
    return;
  }

  try {
    mission.value = await missionApi.getById(missionId.value);
    formData.value = {
      name: mission.value.name || '',
      description: mission.value.description || '',
      tags: mission.value.tags || [],
      flightPath: mission.value.flightPath || [],
      restrictedZones: mission.value.restrictedZones || { type: 'FeatureCollection', features: [] },
      batteryData: mission.value.batteryData || { batteries: [], rawData: [] },
      weatherWindow: mission.value.weatherWindow || {
        date: null,
        startTime: null,
        endTime: null,
        windSpeed: null,
        windDirection: null,
        visibility: null,
        temperature: null,
        notes: ''
      },
      pilotInfo: mission.value.pilotInfo || {
        name: '',
        licenseNumber: '',
        contact: ''
      },
      aircraftInfo: mission.value.aircraftInfo || {
        model: '',
        serialNumber: '',
        maxFlightTime: 30
      }
    };
  } catch (error) {
    console.error('加载任务失败:', error);
    alert('加载任务失败: ' + (error.response?.data?.error || error.message));
  } finally {
    loading.value = false;
  }
});
</script>
