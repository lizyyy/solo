<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useInspectorStore } from './stores/inspectorStore';
import type { Defect } from './types';
import { Building2, Shield, AlertTriangle, Info, Play, RotateCcw } from 'lucide-vue-next';

import FacadeGrid from './components/FacadeGrid.vue';
import DefectForm from './components/DefectForm.vue';
import DefectDetail from './components/DefectDetail.vue';
import FilterPanel from './components/FilterPanel.vue';
import DefectList from './components/DefectList.vue';

const store = useInspectorStore();

const showForm = ref(false);
const showEditForm = ref(false);
const newDefectPosition = ref<{ floor: number; column: number } | null>(null);
const showWelcome = ref(true);
const activeTab = ref<'grid' | 'list'>('grid');

onMounted(() => {
  store.initializeStore();
  console.log('[初始化] 商店已初始化，加载了', store.buildings.length, '个建筑和', store.defects.length, '条缺陷记录');
  console.log('[样例] 数据位置: src/data/sampleData.ts');
});

const handleCreateDefect = (position: { floor: number; column: number }) => {
  if (!store.selectedBuildingId) {
    console.error('[创建] 请先选择建筑');
    alert('请先在顶部选择一个建筑');
    return;
  }
  newDefectPosition.value = position;
  showForm.value = true;
  console.log(`[创建] 打开表单: ${position.floor}F-${position.column}列`);
};

const handleSelectBuilding = (buildingId: string) => {
  store.selectBuilding(buildingId);
};

const handleSelectDefect = (defect: Defect) => {
  store.selectDefect(defect);
};

const handleEditDefect = () => {
  showEditForm.value = true;
};

const handleFormSuccess = () => {
  console.log('[表单] 操作成功');
};

const handleCloseDetail = () => {
  store.selectDefect(null);
};

const handleDismissWelcome = () => {
  showWelcome.value = false;
};

const handleQuickStart = () => {
  showWelcome.value = false;
  if (store.buildings.length > 0) {
    store.selectBuilding(store.buildings[0].id);
    console.log('[演示] 快速开始 - 选择第一个建筑:', store.buildings[0].name);
  }
};

const handleResetAll = () => {
  if (confirm('确定要重置所有数据为样例数据吗？')) {
    store.resetToSampleData();
    showWelcome.value = true;
  }
};

const currentBuildingInfo = computed(() => {
  if (!store.selectedBuilding) return null;
  const defects = store.buildingDefects;
  const activeDefects = defects.filter(d => d.status !== 'closed');
  return {
    name: store.selectedBuilding.name,
    floors: store.selectedBuilding.floors,
    columns: store.selectedBuilding.columns,
    totalCells: store.selectedBuilding.floors * store.selectedBuilding.columns,
    totalDefects: defects.length,
    activeDefects: activeDefects.length
  };
});
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <Shield :size="28" />
          <div class="logo-text">
            <h1>玻璃幕墙巡检缺陷标注器</h1>
            <span>Glass Curtain Wall Inspection Tool</span>
          </div>
        </div>
      </div>
      
      <div class="header-center">
        <div class="building-selector">
          <label><Building2 :size="16" /> 选择建筑:</label>
          <select 
            :value="store.selectedBuildingId || ''"
            @change="(e) => handleSelectBuilding((e.target as HTMLSelectElement).value)"
            class="building-select"
          >
            <option value="" disabled>-- 请选择建筑 --</option>
            <option v-for="b in store.buildings" :key="b.id" :value="b.id">
              {{ b.name }} ({{ b.floors }}F × {{ b.columns }}列)
            </option>
          </select>
          <button 
            v-if="store.selectedBuildingId"
            class="reset-btn" 
            title="重置所有数据为样例"
            @click="handleResetAll"
          >
            <RotateCcw :size="14" />
          </button>
        </div>
      </div>
      
      <div class="header-right">
        <div class="quick-stats">
          <span class="stat-badge pending">待处理 {{ store.defectStats.pending }}</span>
          <span class="stat-badge progress">处理中 {{ store.defectStats.inProgress }}</span>
          <span class="stat-badge reinspect">已复检 {{ store.defectStats.reinspected }}</span>
        </div>
      </div>
    </header>
    
    <main class="app-main">
      <div v-if="showWelcome" class="welcome-modal">
        <div class="welcome-content">
          <div class="welcome-icon">
            <Shield :size="64" />
          </div>
          <h2>玻璃幕墙巡检缺陷标注器</h2>
          <p class="subtitle">专业的物业巡检缺陷管理工具</p>
          
          <div class="welcome-sections">
            <div class="welcome-section">
              <h3><Info :size="18" /> 系统特点</h3>
              <ul>
                <li>✅ 建筑立面网格可视化展示</li>
                <li>✅ 裂纹、松动两类缺陷标注</li>
                <li>✅ 待处理→处理中→已复检→已关闭 完整流转</li>
                <li>✅ 照片附件支持</li>
                <li>✅ 多维度筛选（建筑、状态、类型）</li>
                <li>✅ JSON/CSV 本地导出</li>
                <li>✅ 浏览器本地存储持久化</li>
              </ul>
            </div>
            
            <div class="welcome-section">
              <h3><Play :size="18" /> 快速开始</h3>
              <ol>
                <li>选择顶部的建筑（金融中心A座 或 科技园B栋）</li>
                <li>点击立面网格上的彩色单元格查看已有缺陷</li>
                <li>点击空白单元格创建新缺陷</li>
                <li>在右侧详情面板中进行状态流转</li>
                <li>使用筛选功能快速定位问题</li>
                <li>导出报告完成巡检归档</li>
              </ol>
            </div>
          </div>
          
          <div class="welcome-buttons">
            <button class="btn-primary" @click="handleQuickStart">
              <Play :size="18" />
              开始演示
            </button>
            <button class="btn-secondary" @click="handleDismissWelcome">
              稍后再说
            </button>
          </div>
          
          <div class="welcome-note">
            <AlertTriangle :size="14" />
            <span>本应用为纯前端演示，数据存储于浏览器 localStorage。点击筛选面板的 🔄 按钮可重置为样例数据。</span>
          </div>
        </div>
      </div>
      
      <div v-else class="main-layout">
        <aside class="left-panel">
          <FilterPanel />
          
          <div class="panel-tabs">
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'grid' }"
              @click="activeTab = 'grid'"
            >
              立面网格
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'list' }"
              @click="activeTab = 'list'"
            >
              缺陷列表
            </button>
          </div>
          
          <div v-if="activeTab === 'grid'" class="tab-content">
            <div v-if="!store.selectedBuilding" class="empty-grid">
              <Building2 :size="48" />
              <p>请选择一个建筑以查看立面网格</p>
            </div>
            <div v-else class="grid-wrapper">
              <div class="building-info">
                <div class="info-card">
                  <span class="info-label">建筑名称</span>
                  <span class="info-value">{{ currentBuildingInfo?.name }}</span>
                </div>
                <div class="info-card">
                  <span class="info-label">网格规模</span>
                  <span class="info-value">{{ currentBuildingInfo?.floors }}F × {{ currentBuildingInfo?.columns }}列</span>
                </div>
                <div class="info-card">
                  <span class="info-label">活跃缺陷</span>
                  <span class="info-value highlight">{{ currentBuildingInfo?.activeDefects }} / {{ currentBuildingInfo?.totalDefects }}</span>
                </div>
              </div>
              <FacadeGrid @create-defect="handleCreateDefect" />
            </div>
          </div>
          
          <div v-else class="tab-content list-tab">
            <DefectList @select-defect="handleSelectDefect" />
          </div>
        </aside>
        
        <aside v-if="store.selectedDefect" class="right-panel">
          <DefectDetail 
            @close="handleCloseDetail" 
            @edit="handleEditDefect"
          />
        </aside>
      </div>
    </main>
    
    <DefectForm 
      :show="showForm"
      :position="newDefectPosition || undefined"
      @close="showForm = false; newDefectPosition = null"
      @success="handleFormSuccess"
    />
    
    <DefectForm 
      :show="showEditForm"
      :defect="store.selectedDefect"
      @close="showEditForm = false"
      @success="handleFormSuccess"
    />
    
    <footer class="app-footer">
      <div class="footer-content">
        <span>玻璃幕墙巡检缺陷标注器 v1.0.0</span>
        <span class="footer-dot">•</span>
        <span>样例数据: <code>src/data/sampleData.ts</code></span>
        <span class="footer-dot">•</span>
        <span>按 F12 查看控制台操作日志</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--code-bg, #f4f3ec);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: var(--bg, #fff);
  border-bottom: 1px solid var(--border, #e5e4e7);
  flex-wrap: wrap;
  gap: 12px;
}

.header-left .logo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--accent, #aa3bff);
}

.logo-text h1 {
  margin: 0;
  font-size: 18px;
  color: var(--text-h, #08060d);
}

.logo-text span {
  font-size: 11px;
  color: var(--text, #6b6375);
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.building-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.building-selector label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #6b6375);
}

.building-select {
  padding: 8px 14px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  min-width: 240px;
  cursor: pointer;
}

.building-select:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(170, 59, 255, 0.1));
}

.reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(245, 124, 0, 0.1);
  border-color: #f57c00;
  color: #f57c00;
}

.header-right .quick-stats {
  display: flex;
  gap: 8px;
}

.stat-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.stat-badge.pending {
  background: rgba(229, 57, 53, 0.1);
  color: #e53935;
}

.stat-badge.progress {
  background: rgba(245, 124, 0, 0.1);
  color: #f57c00;
}

.stat-badge.reinspect {
  background: rgba(124, 179, 66, 0.1);
  color: #7cb342;
}

.app-main {
  flex: 1;
  padding: 16px;
}

.welcome-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.welcome-content {
  background: var(--bg, #fff);
  border-radius: 16px;
  padding: 32px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
}

.welcome-icon {
  text-align: center;
  color: var(--accent, #aa3bff);
  margin-bottom: 16px;
}

.welcome-content h2 {
  text-align: center;
  margin: 0 0 8px;
  font-size: 24px;
  color: var(--text-h, #08060d);
}

.subtitle {
  text-align: center;
  color: var(--text, #6b6375);
  font-size: 14px;
  margin-bottom: 24px;
}

.welcome-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.welcome-section {
  padding: 16px;
  background: var(--code-bg, #f4f3ec);
  border-radius: 8px;
}

.welcome-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-h, #08060d);
}

.welcome-section ul,
.welcome-section ol {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--text, #6b6375);
  line-height: 1.8;
}

.welcome-section ol li {
  padding-left: 4px;
}

.welcome-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent, #aa3bff);
  color: white;
  border-color: var(--accent, #aa3bff);
}

.btn-primary:hover {
  background: #8a2be2;
  transform: translateY(-1px);
}

.btn-secondary {
  background: transparent;
  color: var(--text, #6b6375);
  border-color: var(--border, #e5e4e7);
}

.btn-secondary:hover {
  background: var(--code-bg, #f4f3ec);
}

.welcome-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(245, 124, 0, 0.1);
  border-radius: 6px;
  font-size: 12px;
  color: #f57c00;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
  height: calc(100vh - 120px);
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: hidden;
}

.right-panel {
  height: 100%;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  gap: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px 6px 0 0;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: none;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 0 8px 8px 8px;
}

.tab-content.list-tab {
  border-radius: 8px;
}

.empty-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text, #6b6375);
  gap: 12px;
}

.empty-grid p {
  font-size: 14px;
}

.grid-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
}

.building-info {
  display: flex;
  gap: 12px;
}

.info-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  background: var(--code-bg, #f4f3ec);
  border-radius: 6px;
}

.info-label {
  font-size: 11px;
  color: var(--text, #6b6375);
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.info-value.highlight {
  color: var(--accent, #aa3bff);
}

.app-footer {
  background: var(--bg, #fff);
  border-top: 1px solid var(--border, #e5e4e7);
  padding: 10px 24px;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text, #6b6375);
  flex-wrap: wrap;
}

.footer-dot {
  width: 4px;
  height: 4px;
  background: var(--border, #e5e4e7);
  border-radius: 50%;
}

.footer-content code {
  background: var(--code-bg, #f4f3ec);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

@media (max-width: 900px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  
  .welcome-sections {
    grid-template-columns: 1fr;
  }
  
  .right-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 400px;
    z-index: 50;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
  }
}
</style>
