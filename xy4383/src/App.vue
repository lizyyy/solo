<template>
  <div id="app">
    <header class="app-header">
      <h1>🎭 舞台安全复核工具</h1>
      <div class="header-actions">
        <button v-if="hasData" @click="runRiskAnalysis" class="btn-primary">
          🔍 重新分析风险
        </button>
        <button v-if="hasData" @click="showExportModal = true" class="btn-success">
          📤 导出报告
        </button>
        <button @click="clearAllData" class="btn-danger">
          🗑️ 清空数据
        </button>
      </div>
    </header>

    <main class="main-content">
      <div class="tab-container">
        <span 
          class="tab" 
          :class="{ active: currentTab === 'import' }"
          @click="currentTab = 'import'"
        >
          📥 数据导入
        </span>
        <span 
          class="tab" 
          :class="{ active: currentTab === 'timeline' }"
          @click="currentTab = 'timeline'"
        >
          📊 时间轴复核
          <span v-if="riskCount > 0" class="badge badge-danger">{{ riskCount }}</span>
        </span>
        <span 
          class="tab" 
          :class="{ active: currentTab === 'risks' }"
          @click="currentTab = 'risks'"
        >
          ⚠️ 风险清单
          <span v-if="riskCount > 0" class="badge badge-danger">{{ riskCount }}</span>
        </span>
      </div>

      <div v-if="currentTab === 'import'" class="tab-content">
        <div class="import-section">
          <div class="card">
            <div class="card-header">🎬 场景 Cue 表</div>
            <div class="upload-area" 
                 @click="triggerFileInput('cueTable')"
                 @dragover.prevent
                 @drop.prevent="handleFileDrop($event, 'cueTable')">
              <p v-if="!data.cueTable">点击或拖拽文件到此处上传</p>
              <p v-else>✅ 已加载 {{ data.cueTable.length }} 条 Cue</p>
            </div>
            <input type="file" ref="cueTableInput" @change="handleFileSelect($event, 'cueTable')" accept=".json,.csv" style="display:none">
            <div class="mt-8 text-small">
              支持格式: JSON, CSV | 示例数据可用
            </div>
          </div>

          <div class="card">
            <div class="card-header">🏗️ 吊杆/升降台设备清单</div>
            <div class="upload-area" 
                 @click="triggerFileInput('equipment')"
                 @dragover.prevent
                 @drop.prevent="handleFileDrop($event, 'equipment')">
              <p v-if="!data.equipment">点击或拖拽文件到此处上传</p>
              <p v-else>✅ 已加载 {{ data.equipment.length }} 台设备</p>
            </div>
            <input type="file" ref="equipmentInput" @change="handleFileSelect($event, 'equipment')" accept=".json,.csv" style="display:none">
            <div class="mt-8 text-small">
              支持格式: JSON, CSV | 包含吊杆、升降台等设备
            </div>
          </div>

          <div class="card">
            <div class="card-header">🎭 演员走位 JSON</div>
            <div class="upload-area" 
                 @click="triggerFileInput('movements')"
                 @dragover.prevent
                 @drop.prevent="handleFileDrop($event, 'movements')">
              <p v-if="!data.movements">点击或拖拽文件到此处上传</p>
              <p v-else>✅ 已加载 {{ data.movements.length }} 条走位记录</p>
            </div>
            <input type="file" ref="movementsInput" @change="handleFileSelect($event, 'movements')" accept=".json" style="display:none">
            <div class="mt-8 text-small">
              支持格式: JSON | 包含演员走位时间、路径等信息
            </div>
          </div>

          <div class="card">
            <div class="card-header">🔥 烟火许可记录</div>
            <div class="upload-area" 
                 @click="triggerFileInput('pyroPermits')"
                 @dragover.prevent
                 @drop.prevent="handleFileDrop($event, 'pyroPermits')">
              <p v-if="!data.pyroPermits">点击或拖拽文件到此处上传</p>
              <p v-else>✅ 已加载 {{ data.pyroPermits.length }} 条许可</p>
            </div>
            <input type="file" ref="pyroPermitsInput" @change="handleFileSelect($event, 'pyroPermits')" accept=".json,.csv" style="display:none">
            <div class="mt-8 text-small">
              支持格式: JSON, CSV | 包含许可有效期、使用时间等
            </div>
          </div>

          <div class="card">
            <div class="card-header">📁 加载示例数据</div>
            <p class="mb-8 text-small">加载预设的示例数据用于测试和演示</p>
            <button @click="loadSampleData" class="btn-primary">加载示例数据</button>
          </div>
        </div>
      </div>

      <div v-if="currentTab === 'timeline'" class="tab-content">
        <div v-if="!hasData" class="text-center p-16">
          <p>请先在「数据导入」标签页导入数据</p>
        </div>
        <div v-else>
          <div class="timeline-filters card">
            <div class="flex gap-8 items-center">
              <label>风险等级:</label>
              <select v-model="filterRiskLevel">
                <option value="all">全部</option>
                <option value="high">高风险</option>
                <option value="medium">中风险</option>
                <option value="low">低风险</option>
              </select>
              <label>状态:</label>
              <select v-model="filterStatus">
                <option value="all">全部</option>
                <option value="pending">待处理</option>
                <option value="resolved">已解决</option>
                <option value="dismissed">已驳回</option>
              </select>
            </div>
          </div>

          <div class="timeline">
            <div v-for="item in timelineItems" :key="item.id" class="timeline-item">
              <div class="timeline-time">{{ formatTime(item.time) }}</div>
              <div class="timeline-content">
                <div class="flex justify-between items-start mb-8">
                  <div>
                    <span class="badge" :class="getBadgeClass(item.type)">
                      {{ getTypeLabel(item.type) }}
                    </span>
                    <strong class="ml-8">{{ item.title }}</strong>
                  </div>
                </div>
                <p class="text-small">{{ item.description }}</p>

                <div v-if="item.risks && item.risks.length > 0" class="mt-8">
                  <div v-for="risk in item.risks" :key="risk.id" 
                       class="card mt-8" 
                       :class="getRiskCardClass(risk)">
                    <div class="flex justify-between items-start">
                      <div>
                        <span class="badge" :class="getRiskBadgeClass(risk.level)">
                          {{ getRiskLevelLabel(risk.level) }}
                        </span>
                        <strong class="ml-8">{{ risk.title }}</strong>
                      </div>
                      <div class="flex gap-8">
                        <button v-if="risk.status !== 'resolved'" 
                                @click="updateRiskStatus(risk.id, 'resolved')"
                                class="btn-success" style="padding: 4px 8px; font-size: 12px;">
                          ✓ 标记解决
                        </button>
                        <button v-if="risk.status !== 'dismissed'" 
                                @click="updateRiskStatus(risk.id, 'dismissed')"
                                class="btn-secondary" style="padding: 4px 8px; font-size: 12px;">
                          驳回
                        </button>
                      </div>
                    </div>
                    <p class="mt-8 text-small">{{ risk.description }}</p>
                    
                    <div class="mt-8">
                      <label class="text-small">备注:</label>
                      <textarea 
                        v-model="risk.notes"
                        @blur="saveRiskNotes(risk.id, risk.notes)"
                        placeholder="输入备注信息..."
                        style="width: 100%; margin-top: 4px;"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentTab === 'risks'" class="tab-content">
        <div v-if="!hasData" class="text-center p-16">
          <p>请先在「数据导入」标签页导入数据</p>
        </div>
        <div v-else>
          <div class="risk-summary card">
            <div class="flex gap-16">
              <div class="text-center">
                <div class="badge badge-danger" style="font-size: 24px; padding: 8px 16px;">
                  {{ stats.highRisk }}
                </div>
                <div class="text-small mt-8">高风险</div>
              </div>
              <div class="text-center">
                <div class="badge badge-warning" style="font-size: 24px; padding: 8px 16px;">
                  {{ stats.mediumRisk }}
                </div>
                <div class="text-small mt-8">中风险</div>
              </div>
              <div class="text-center">
                <div class="badge badge-info" style="font-size: 24px; padding: 8px 16px;">
                  {{ stats.lowRisk }}
                </div>
                <div class="text-small mt-8">低风险</div>
              </div>
              <div class="text-center">
                <div class="badge badge-success" style="font-size: 24px; padding: 8px 16px;">
                  {{ stats.resolved }}
                </div>
                <div class="text-small mt-8">已解决</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">风险清单</div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">时间</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">等级</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">类型</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">描述</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">状态</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="risk in allRisks" :key="risk.id">
                  <td style="padding: 12px; border-bottom: 1px solid #ddd;">{{ formatTime(risk.time) }}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <span class="badge" :class="getRiskBadgeClass(risk.level)">
                      {{ getRiskLevelLabel(risk.level) }}
                    </span>
                  </td>
                  <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <span class="badge" :class="getBadgeClass(risk.category)">
                      {{ getCategoryLabel(risk.category) }}
                    </span>
                  </td>
                  <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <strong>{{ risk.title }}</strong><br>
                    <span class="text-small">{{ risk.description }}</span>
                  </td>
                  <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <span class="badge" :class="getStatusBadgeClass(risk.status)">
                      {{ getStatusLabel(risk.status) }}
                    </span>
                  </td>
                  <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <div class="flex gap-8">
                      <button v-if="risk.status !== 'resolved'" 
                              @click="updateRiskStatus(risk.id, 'resolved')"
                              class="btn-success" style="padding: 4px 8px; font-size: 12px;">
                        ✓ 解决
                      </button>
                      <button v-if="risk.status !== 'dismissed'" 
                              @click="updateRiskStatus(risk.id, 'dismissed')"
                              class="btn-secondary" style="padding: 4px 8px; font-size: 12px;">
                        驳回
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
      <div class="modal-content">
        <div class="flex justify-between items-center mb-16">
          <h3>导出报告</h3>
          <button @click="showExportModal = false" class="btn-secondary" style="padding: 4px 8px;">✕</button>
        </div>
        
        <div class="card">
          <div class="card-header">📄 Markdown 演前安全单</div>
          <p class="mb-8 text-small">导出完整的演前安全检查报告</p>
          <button @click="exportMarkdown" class="btn-primary">导出 Markdown</button>
        </div>

        <div class="card">
          <div class="card-header">📊 CSV 风险清单</div>
          <p class="mb-8 text-small">导出所有风险为 CSV 格式</p>
          <button @click="exportCSV" class="btn-primary">导出 CSV</button>
        </div>

        <div class="card">
          <div class="card-header">📦 JSON 审计包</div>
          <p class="mb-8 text-small">导出所有数据和风险评估为 JSON 格式</p>
          <button @click="exportJSON" class="btn-primary">导出 JSON</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { riskEngine } from './utils/riskEngine'
import { sampleData } from './utils/sampleData'
import { exportUtils } from './utils/exportUtils'

export default {
  name: 'App',
  setup() {
    const currentTab = ref('import')
    const data = ref({
      cueTable: null,
      equipment: null,
      movements: null,
      pyroPermits: null
    })
    const risks = ref([])
    const showExportModal = ref(false)
    const filterRiskLevel = ref('all')
    const filterStatus = ref('all')

    const cueTableInput = ref(null)
    const equipmentInput = ref(null)
    const movementsInput = ref(null)
    const pyroPermitsInput = ref(null)

    const hasData = computed(() => {
      return data.value.cueTable || data.value.equipment || 
             data.value.movements || data.value.pyroPermits
    })

    const riskCount = computed(() => {
      return risks.value.filter(r => r.status === 'pending').length
    })

    const allRisks = computed(() => {
      let filtered = [...risks.value]
      
      if (filterRiskLevel.value !== 'all') {
        filtered = filtered.filter(r => r.level === filterRiskLevel.value)
      }
      
      if (filterStatus.value !== 'all') {
        filtered = filtered.filter(r => r.status === filterStatus.value)
      }
      
      return filtered.sort((a, b) => {
        const levelOrder = { high: 0, medium: 1, low: 2 }
        return levelOrder[a.level] - levelOrder[b.level]
      })
    })

    const stats = computed(() => {
      return {
        highRisk: risks.value.filter(r => r.level === 'high' && r.status === 'pending').length,
        mediumRisk: risks.value.filter(r => r.level === 'medium' && r.status === 'pending').length,
        lowRisk: risks.value.filter(r => r.level === 'low' && r.status === 'pending').length,
        resolved: risks.value.filter(r => r.status === 'resolved').length
      }
    })

    const timelineItems = computed(() => {
      const items = []
      
      if (data.value.cueTable) {
        data.value.cueTable.forEach(cue => {
          const cueRisks = risks.value.filter(r => r.relatedCue === cue.id)
          items.push({
            id: `cue-${cue.id}`,
            time: cue.time,
            type: 'cue',
            title: `Cue ${cue.number} - ${cue.name}`,
            description: cue.description || '',
            risks: cueRisks.length > 0 ? cueRisks : null
          })
        })
      }

      if (data.value.movements) {
        data.value.movements.forEach(movement => {
          const movementRisks = risks.value.filter(r => r.relatedMovement === movement.id)
          items.push({
            id: `movement-${movement.id}`,
            time: movement.startTime,
            type: 'movement',
            title: `${movement.actor} - ${movement.action}`,
            description: `从 ${movement.fromPosition} 到 ${movement.toPosition}`,
            risks: movementRisks.length > 0 ? movementRisks : null
          })
        })
      }

      if (data.value.pyroPermits) {
        data.value.pyroPermits.forEach(permit => {
          const permitRisks = risks.value.filter(r => r.relatedPermit === permit.id)
          items.push({
            id: `permit-${permit.id}`,
            time: permit.useTime,
            type: 'pyro',
            title: `烟火效果 - ${permit.name}`,
            description: `许可编号: ${permit.permitNumber}`,
            risks: permitRisks.length > 0 ? permitRisks : null
          })
        })
      }

      return items.sort((a, b) => parseTime(a.time) - parseTime(b.time))
    })

    function parseTime(timeStr) {
      const parts = timeStr.split(':')
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parseInt(parts[2]) || 0)
    }

    function formatTime(timeStr) {
      return timeStr
    }

    function getTypeLabel(type) {
      const labels = {
        cue: 'Cue',
        movement: '走位',
        pyro: '烟火'
      }
      return labels[type] || type
    }

    function getBadgeClass(type) {
      const classes = {
        cue: 'badge-info',
        movement: 'badge-warning',
        pyro: 'badge-danger'
      }
      return classes[type] || 'badge-secondary'
    }

    function getRiskCardClass(risk) {
      if (risk.status === 'resolved') return 'risk-resolved'
      if (risk.status === 'dismissed') return 'risk-dismissed'
      if (risk.level === 'high') return 'risk-high'
      if (risk.level === 'medium') return 'risk-medium'
      return 'risk-low'
    }

    function getRiskBadgeClass(level) {
      const classes = {
        high: 'badge-danger',
        medium: 'badge-warning',
        low: 'badge-info'
      }
      return classes[level] || 'badge-secondary'
    }

    function getRiskLevelLabel(level) {
      const labels = {
        high: '高风险',
        medium: '中风险',
        low: '低风险'
      }
      return labels[level] || level
    }

    function getCategoryLabel(category) {
      const labels = {
        overload: '超载',
        movement: '走位冲突',
        permit: '许可问题',
        timing: '时间冲突',
        other: '其他'
      }
      return labels[category] || category
    }

    function getStatusBadgeClass(status) {
      const classes = {
        pending: 'badge-warning',
        resolved: 'badge-success',
        dismissed: 'badge-secondary'
      }
      return classes[status] || 'badge-secondary'
    }

    function getStatusLabel(status) {
      const labels = {
        pending: '待处理',
        resolved: '已解决',
        dismissed: '已驳回'
      }
      return labels[status] || status
    }

    function triggerFileInput(type) {
      if (type === 'cueTable') cueTableInput.value.click()
      if (type === 'equipment') equipmentInput.value.click()
      if (type === 'movements') movementsInput.value.click()
      if (type === 'pyroPermits') pyroPermitsInput.value.click()
    }

    function handleFileSelect(event, type) {
      const file = event.target.files[0]
      if (file) {
        readFile(file, type)
      }
    }

    function handleFileDrop(event, type) {
      const file = event.dataTransfer.files[0]
      if (file) {
        readFile(file, type)
      }
    }

    function readFile(file, type) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          let parsedData
          if (file.name.endsWith('.json')) {
            parsedData = JSON.parse(e.target.result)
          } else if (file.name.endsWith('.csv')) {
            parsedData = parseCSV(e.target.result)
          }
          
          data.value[type] = parsedData
          saveData()
          analyzeRisks()
        } catch (err) {
          console.error('文件解析错误:', err)
          alert('文件解析失败，请检查格式')
        }
      }
      reader.readAsText(file)
    }

    function parseCSV(csvText) {
      const lines = csvText.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const obj = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || ''
        })
        return obj
      })
    }

    function loadSampleData() {
      data.value = { ...sampleData }
      saveData()
      analyzeRisks()
      currentTab.value = 'timeline'
    }

    function saveData() {
      if (window.electronAPI) {
        window.electronAPI.store.set('stageData', data.value)
      } else {
        localStorage.setItem('stageData', JSON.stringify(data.value))
      }
    }

    function loadSavedData() {
      if (window.electronAPI) {
        window.electronAPI.store.get('stageData').then(saved => {
          if (saved) {
            data.value = saved
            analyzeRisks()
          }
        })
      } else {
        const saved = localStorage.getItem('stageData')
        if (saved) {
          data.value = JSON.parse(saved)
          analyzeRisks()
        }
      }
    }

    function loadSavedRisks() {
      if (window.electronAPI) {
        window.electronAPI.store.get('risks').then(saved => {
          if (saved) {
            risks.value = saved
          }
        })
      } else {
        const saved = localStorage.getItem('risks')
        if (saved) {
          risks.value = JSON.parse(saved)
        }
      }
    }

    function saveRisks() {
      if (window.electronAPI) {
        window.electronAPI.store.set('risks', risks.value)
      } else {
        localStorage.setItem('risks', JSON.stringify(risks.value))
      }
    }

    function analyzeRisks() {
      const newRisks = riskEngine.analyzeAll(data.value)
      
      const existingRisksMap = {}
      risks.value.forEach(r => {
        existingRisksMap[r.id] = r
      })

      newRisks.forEach(risk => {
        if (existingRisksMap[risk.id]) {
          risk.status = existingRisksMap[risk.id].status
          risk.notes = existingRisksMap[risk.id].notes
        }
      })

      risks.value = newRisks
      saveRisks()
    }

    function runRiskAnalysis() {
      analyzeRisks()
      alert('风险分析完成')
    }

    function updateRiskStatus(riskId, status) {
      const risk = risks.value.find(r => r.id === riskId)
      if (risk) {
        risk.status = status
        saveRisks()
      }
    }

    function saveRiskNotes(riskId, notes) {
      const risk = risks.value.find(r => r.id === riskId)
      if (risk) {
        risk.notes = notes
        saveRisks()
      }
    }

    function clearAllData() {
      if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
        data.value = {
          cueTable: null,
          equipment: null,
          movements: null,
          pyroPermits: null
        }
        risks.value = []
        
        if (window.electronAPI) {
          window.electronAPI.store.clear()
        } else {
          localStorage.removeItem('stageData')
          localStorage.removeItem('risks')
        }
        
        currentTab.value = 'import'
      }
    }

    async function exportMarkdown() {
      const markdown = exportUtils.generateMarkdown(data.value, risks.value)
      saveFile(markdown, `演前安全单_${new Date().toISOString().split('T')[0]}.md`, 'text/markdown')
    }

    async function exportCSV() {
      const csv = exportUtils.generateCSV(risks.value)
      saveFile(csv, `风险清单_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
    }

    async function exportJSON() {
      const jsonPackage = exportUtils.generateJSONPackage(data.value, risks.value)
      saveFile(JSON.stringify(jsonPackage, null, 2), `审计包_${new Date().toISOString().split('T')[0]}.json`, 'application/json')
    }

    function saveFile(content, filename, type) {
      if (window.electronAPI && window.electronAPI.dialog) {
        window.electronAPI.dialog.saveFile({
          defaultPath: filename,
          filters: [{ name: type === 'text/csv' ? 'CSV' : type === 'text/markdown' ? 'Markdown' : 'JSON', extensions: [filename.split('.').pop()] }]
        }).then(result => {
          if (!result.canceled && result.filePath) {
            const fs = require('fs')
            fs.writeFileSync(result.filePath, content)
            alert('导出成功!')
          }
        })
      } else {
        const blob = new Blob([content], { type })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        alert('导出成功!')
      }
      showExportModal.value = false
    }

    onMounted(() => {
      loadSavedData()
      loadSavedRisks()
    })

    return {
      currentTab,
      data,
      risks,
      showExportModal,
      filterRiskLevel,
      filterStatus,
      cueTableInput,
      equipmentInput,
      movementsInput,
      pyroPermitsInput,
      hasData,
      riskCount,
      allRisks,
      stats,
      timelineItems,
      formatTime,
      getTypeLabel,
      getBadgeClass,
      getRiskCardClass,
      getRiskBadgeClass,
      getRiskLevelLabel,
      getCategoryLabel,
      getStatusBadgeClass,
      getStatusLabel,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      loadSampleData,
      runRiskAnalysis,
      updateRiskStatus,
      saveRiskNotes,
      clearAllData,
      exportMarkdown,
      exportCSV,
      exportJSON
    }
  }
}
</script>

<style>
.app-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  font-size: 24px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.main-content {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.tab-content {
  min-height: 400px;
}

.import-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.risk-summary {
  display: flex;
  justify-content: center;
}
</style>
