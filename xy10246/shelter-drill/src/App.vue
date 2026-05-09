<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <rect x="4" y="4" width="24" height="24" fill="#1976d2" rx="4" />
            <path d="M16 10 L22 16 L16 22 L10 16 Z" fill="white" />
            <circle cx="16" cy="16" r="3" fill="#1976d2" />
          </svg>
          <h1>应急避难点容量演练器</h1>
        </div>
        <div class="subtitle">社区应急避难点演练评估工具</div>
      </div>
    </header>
    
    <main class="main-content">
      <div class="intro-section">
        <div class="intro-card">
          <div class="intro-icon">📍</div>
          <div class="intro-text">
            <h3>场地布局入口</h3>
            <p>选择预设避难点布局或导入自定义 JSON 配置，包含入口、帐篷区、物资点和通道信息</p>
          </div>
        </div>
        <div class="intro-card">
          <div class="intro-icon">👥</div>
          <div class="intro-text">
            <h3>人员流入校验</h3>
            <p>设置不同场景的人员流入时间线，模拟真实演练中的人员到达情况</p>
          </div>
        </div>
        <div class="intro-card">
          <div class="intro-icon">📊</div>
          <div class="intro-text">
            <h3>容量限制证据</h3>
            <p>实时评估入口拥堵程度、帐篷区容量利用率和物资可达性，提供明确的风险提示</p>
          </div>
        </div>
      </div>
      
      <LayoutSelector @layoutChange="handleLayoutChange" />
      
      <InflowSimulator 
        :layout="currentLayout"
        :layoutValidation="layoutValidation"
        @simulationComplete="handleSimulationComplete"
      />
      
      <ResultsDisplay 
        v-if="simulationResults"
        :results="simulationResults"
      />
      
      <div v-if="!simulationResults" class="waiting-section">
        <div class="waiting-icon">⏳</div>
        <div class="waiting-text">
          <h3>等待演练开始</h3>
          <p>请选择场地布局和流入场景，然后点击「开始演练模拟」</p>
        </div>
      </div>
    </main>
    
    <footer class="footer">
      <div class="footer-content">
        <p>应急避难点容量演练器 | 用于社区应急避难点演练评估</p>
        <p class="footer-note">支持异常样例测试：重复数据、缺字段、人工改错</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LayoutSelector from './components/LayoutSelector.vue'
import InflowSimulator from './components/InflowSimulator.vue'
import ResultsDisplay from './components/ResultsDisplay.vue'

const currentLayout = ref(null)
const layoutValidation = ref(null)
const simulationResults = ref(null)

function handleLayoutChange(data) {
  currentLayout.value = data.layout
  layoutValidation.value = data.validation
  simulationResults.value = null
}

function handleSimulationComplete(results) {
  if (results.success) {
    simulationResults.value = results
  } else {
    console.error('模拟失败:', results.error, results.validation)
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #1976d2, #1565c0);
  color: white;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.logo h1 {
  font-size: 24px;
  font-weight: bold;
}

.subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.main-content {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
}

.intro-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.intro-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.intro-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.intro-text h3 {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.intro-text p {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.waiting-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  background: white;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.waiting-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.waiting-text h3 {
  font-size: 18px;
  color: #333;
  margin-bottom: 8px;
}

.waiting-text p {
  font-size: 14px;
  color: #666;
}

.footer {
  background: #333;
  color: #aaa;
  padding: 20px 24px;
  text-align: center;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-content p {
  font-size: 12px;
}

.footer-note {
  margin-top: 4px;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .header {
    padding: 16px;
  }
  
  .logo h1 {
    font-size: 18px;
  }
  
  .subtitle {
    font-size: 12px;
  }
  
  .main-content {
    padding: 16px;
  }
  
  .intro-section {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .intro-card {
    padding: 12px;
  }
  
  .waiting-section {
    padding: 40px 16px;
  }
}
</style>
