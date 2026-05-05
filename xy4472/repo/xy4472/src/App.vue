<template>
  <div class="container">
    <header class="header">
      <h1>👂 听力服务回访管理工具</h1>
      <p>社区听力服务点志愿者专用 - 智能评估回访优先级，高效管理老人助听器服务</p>
    </header>

    <div class="toolbar">
      <button class="btn btn-primary" @click="loadSampleData">
        📥 导入示例数据
      </button>
      <button class="btn btn-success" @click="importCsv">
        📄 导入CSV数据
      </button>
      <button class="btn btn-info" @click="exportMarkdown">
        📋 导出回访清单(MD)
      </button>
      <button class="btn btn-info" @click="exportJson">
        📊 导出数据明细(JSON)
      </button>
      <button class="btn btn-secondary" @click="clearAllData" v-if="elderlyList.length > 0">
        🗑️ 清空数据
      </button>
    </div>

    <div class="main-content">
      <div class="panel">
        <div class="panel-header">
          <h3>👥 老人列表</h3>
          <span class="badge" :class="getCountBadgeClass()">{{ elderlyList.length }} 人</span>
        </div>
        <div class="panel-body">
          <div class="search-box" v-if="elderlyList.length > 0">
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="搜索姓名、电话、地址..."
            />
          </div>

          <div class="filter-tabs" v-if="elderlyList.length > 0">
            <button 
              class="filter-tab" 
              :class="{ active: currentFilter === 'all' }"
              @click="currentFilter = 'all'"
            >
              全部 <span class="count">{{ elderlyList.length }}</span>
            </button>
            <button 
              class="filter-tab" 
              :class="{ active: currentFilter === 'high' }"
              @click="currentFilter = 'high'"
            >
              🔴 高风险 <span class="count">{{ getRiskCount('high') }}</span>
            </button>
            <button 
              class="filter-tab" 
              :class="{ active: currentFilter === 'medium' }"
              @click="currentFilter = 'medium'"
            >
              🟡 中风险 <span class="count">{{ getRiskCount('medium') }}</span>
            </button>
            <button 
              class="filter-tab" 
              :class="{ active: currentFilter === 'low' }"
              @click="currentFilter = 'low'"
            >
              🟢 低风险 <span class="count">{{ getRiskCount('low') }}</span>
            </button>
            <button 
              class="filter-tab" 
              :class="{ active: currentFilter === 'normal' }"
              @click="currentFilter = 'normal'"
            >
              ✅ 正常 <span class="count">{{ getRiskCount('normal') }}</span>
            </button>
          </div>

          <div v-if="filteredElderlyList.length === 0 && elderlyList.length > 0" class="empty-state">
            <div class="icon">🔍</div>
            <p>没有找到匹配的老人</p>
          </div>

          <div v-if="elderlyList.length === 0" class="empty-state">
            <div class="icon">📋</div>
            <p>暂无数据</p>
            <p style="margin-top: 10px; font-size: 12px;">
              点击"导入示例数据"或"导入CSV数据"开始使用
            </p>
          </div>

          <div 
            v-for="elderly in filteredElderlyList" 
            :key="elderly.id"
            class="elder-card"
            :class="{ 
              selected: selectedElderly?.id === elderly.id,
              'risk-high': getRiskLevel(elderly) === 'high',
              'risk-medium': getRiskLevel(elderly) === 'medium',
              'risk-low': getRiskLevel(elderly) === 'low'
            }"
            @click="selectElderly(elderly)"
          >
            <div class="elder-name">
              {{ elderly.name }}
              <span style="font-weight: normal; font-size: 13px; color: #64748b;">
                ({{ elderly.age }}岁/{{ elderly.gender }})
              </span>
            </div>
            <div class="elder-info">
              <span>📞 {{ elderly.phone || '未填写' }}</span>
              <span>📍 {{ elderly.address || '未填写' }}</span>
            </div>
            <div class="risk-tags">
              <span 
                v-for="(risk, idx) in getRiskTags(elderly)" 
                :key="idx"
                class="risk-tag"
                :class="risk.class"
              >
                {{ risk.label }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>📋 详细信息</h3>
          <span v-if="selectedElderly" class="badge" :class="getSelectedRiskBadgeClass()">
            {{ getRiskLevelLabel(selectedElderly) }}
          </span>
        </div>
        <div class="panel-body">
          <div v-if="!selectedElderly" class="empty-state">
            <div class="icon">👆</div>
            <p>请从左侧选择一位老人查看详细信息</p>
          </div>

          <div v-if="selectedElderly">
            <div class="detail-section">
              <h4>👤 基本信息</h4>
              <div class="info-grid">
                <div class="info-item">
                  <label>姓名</label>
                  <span class="value">{{ selectedElderly.name }}</span>
                </div>
                <div class="info-item">
                  <label>年龄</label>
                  <span class="value">{{ selectedElderly.age }}岁</span>
                </div>
                <div class="info-item">
                  <label>性别</label>
                  <span class="value">{{ selectedElderly.gender }}</span>
                </div>
                <div class="info-item">
                  <label>电话</label>
                  <span class="value">{{ selectedElderly.phone || '未填写' }}</span>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                  <label>地址</label>
                  <span class="value">{{ selectedElderly.address || '未填写' }}</span>
                </div>
              </div>
            </div>

            <div class="risk-analysis" v-if="getRiskAssessment(selectedElderly).hasRisks">
              <h5>⚠️ 风险评估</h5>
              <div class="risk-reason">
                <ul style="margin: 0; padding-left: 20px;">
                  <li v-for="(risk, idx) in getRiskAssessment(selectedElderly).risks" :key="idx">
                    <strong>{{ getRiskLabel(risk.type) }}：</strong>{{ risk.reason }}
                  </li>
                </ul>
              </div>
            </div>

            <div class="detail-section" v-if="selectedElderly.hearingScreening">
              <h4>🔊 听力筛查</h4>
              <div class="info-grid">
                <div class="info-item">
                  <label>筛查日期</label>
                  <span class="value">{{ selectedElderly.hearingScreening.screeningDate || '未记录' }}</span>
                </div>
                <div class="info-item">
                  <label>左耳PTA</label>
                  <span class="value">{{ selectedElderly.hearingScreening.leftEar?.pta || 0 }} dB</span>
                </div>
                <div class="info-item">
                  <label>右耳PTA</label>
                  <span class="value">{{ selectedElderly.hearingScreening.rightEar?.pta || 0 }} dB</span>
                </div>
                <div class="info-item">
                  <label>言语识别率</label>
                  <span class="value">{{ selectedElderly.hearingScreening.speechRecognition || 0 }}%</span>
                </div>
                <div class="info-item">
                  <label>耳鸣</label>
                  <span class="value">
                    <span :class="selectedElderly.hearingScreening.tinnitus ? 'badge badge-warning' : 'badge badge-success'">
                      {{ selectedElderly.hearingScreening.tinnitus ? '是' : '否' }}
                    </span>
                  </span>
                </div>
                <div class="info-item">
                  <label>耳漏</label>
                  <span class="value">
                    <span :class="selectedElderly.hearingScreening.earDischarge ? 'badge badge-danger' : 'badge badge-success'">
                      {{ selectedElderly.hearingScreening.earDischarge ? '是' : '否' }}
                    </span>
                  </span>
                </div>
              </div>
              <p v-if="selectedElderly.hearingScreening.notes" style="margin-top: 10px; font-size: 13px; color: #64748b;">
                备注：{{ selectedElderly.hearingScreening.notes }}
              </p>
            </div>

            <div class="detail-section" v-if="selectedElderly.deviceInfo">
              <h4>🦻 设备信息</h4>
              <div class="info-grid">
                <div class="info-item">
                  <label>设备型号</label>
                  <span class="value">{{ selectedElderly.deviceInfo.model || '未填写' }}</span>
                </div>
                <div class="info-item">
                  <label>厂商</label>
                  <span class="value">{{ selectedElderly.deviceInfo.manufacturer || '未填写' }}</span>
                </div>
                <div class="info-item">
                  <label>电池类型</label>
                  <span class="value">{{ selectedElderly.deviceInfo.batteryType || '未填写' }}</span>
                </div>
                <div class="info-item">
                  <label>电池寿命</label>
                  <span class="value">{{ selectedElderly.deviceInfo.batteryLifeMonths || 3 }}个月</span>
                </div>
                <div class="info-item">
                  <label>上次换电池</label>
                  <span class="value">{{ selectedElderly.deviceInfo.lastBatteryChange || '未记录' }}</span>
                </div>
                <div class="info-item">
                  <label>上次调参数</label>
                  <span class="value">{{ selectedElderly.deviceInfo.lastAdjustment || '未记录' }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="selectedElderly.repairRecords && selectedElderly.repairRecords.length > 0">
              <h4>🔧 维修记录</h4>
              <table>
                <thead>
                  <tr>
                    <th>送修日期</th>
                    <th>归还日期</th>
                    <th>问题描述</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(record, idx) in selectedElderly.repairRecords" :key="idx">
                    <td>{{ record.repairDate || '-' }}</td>
                    <td>{{ record.returnDate || '-' }}</td>
                    <td>{{ record.problemDescription || '-' }}</td>
                    <td>
                      <span :class="record.status === 'completed' ? 'badge badge-success' : 'badge badge-warning'">
                        {{ record.status === 'completed' ? '已归还' : '处理中' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="detail-section" v-if="selectedElderly.nextAppointment">
              <h4>📅 下次预约</h4>
              <div class="info-grid">
                <div class="info-item">
                  <label>日期</label>
                  <span class="value">{{ selectedElderly.nextAppointment.date || '未填写' }}</span>
                </div>
                <div class="info-item">
                  <label>时间</label>
                  <span class="value">{{ selectedElderly.nextAppointment.time || '未填写' }}</span>
                </div>
                <div class="info-item">
                  <label>目的</label>
                  <span class="value">{{ selectedElderly.nextAppointment.purpose || '未填写' }}</span>
                </div>
                <div class="info-item">
                  <label>志愿者</label>
                  <span class="value">{{ selectedElderly.nextAppointment.volunteer || '未分配' }}</span>
                </div>
              </div>
            </div>

            <div class="manual-override">
              <h5>⚙️ 人工改判</h5>
              <p style="font-size: 12px; color: #92400e; margin-bottom: 10px;">
                如系统评估不准确，可手动调整风险等级
              </p>
              <div class="override-options">
                <button 
                  class="override-btn" 
                  :class="{ active: selectedElderly.manualOverride === 'high' }"
                  @click="setManualOverride('high')"
                >
                  🔴 高风险
                </button>
                <button 
                  class="override-btn" 
                  :class="{ active: selectedElderly.manualOverride === 'medium' }"
                  @click="setManualOverride('medium')"
                >
                  🟡 中风险
                </button>
                <button 
                  class="override-btn" 
                  :class="{ active: selectedElderly.manualOverride === 'low' }"
                  @click="setManualOverride('low')"
                >
                  🟢 低风险
                </button>
                <button 
                  class="override-btn" 
                  :class="{ active: selectedElderly.manualOverride === 'normal' }"
                  @click="setManualOverride('normal')"
                >
                  ✅ 正常
                </button>
                <button 
                  class="override-btn" 
                  :class="{ active: selectedElderly.manualOverride === null }"
                  @click="setManualOverride(null)"
                >
                  🔄 自动评估
                </button>
              </div>
            </div>

            <div class="remarks-section">
              <h4>📝 志愿者备注</h4>
              <textarea 
                v-model="selectedElderly.remarks"
                placeholder="在此输入回访备注信息..."
                @blur="saveRemarks"
              ></textarea>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 5px;">
                备注将自动保存，重启应用不丢失
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar" v-if="elderlyList.length > 0">
      <div class="status-info">
        <div class="status-item">
          <span class="dot dot-high"></span>
          高风险：{{ getRiskCount('high') }}人
        </div>
        <div class="status-item">
          <span class="dot dot-medium"></span>
          中风险：{{ getRiskCount('medium') }}人
        </div>
        <div class="status-item">
          <span class="dot dot-low"></span>
          低风险：{{ getRiskCount('low') }}人
        </div>
        <div class="status-item">
          <span class="dot dot-normal"></span>
          正常：{{ getRiskCount('normal') }}人
        </div>
      </div>
      <div>
        总计：{{ elderlyList.length }} 位老人 | 上次保存：{{ lastSavedTime || '未保存' }}
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ modalTitle }}</h3>
        <div v-html="modalContent"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showModal = false">关闭</button>
          <button v-if="modalConfirmAction" class="btn btn-primary" @click="executeModalAction">
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { RISK_TAGS, RISK_LEVELS } from './utils/dataModels'
import { assessElderlyRisk, filterByRiskLevel, sortByRiskPriority } from './utils/riskAssessment'
import { 
  getSampleData, 
  saveToStore, 
  loadFromStore,
  importFromCsv,
  exportToMarkdown,
  exportToJson,
  openFileDialog,
  saveFileDialog
} from './utils/dataUtils'

export default {
  name: 'App',
  setup() {
    const elderlyList = ref([])
    const selectedElderly = ref(null)
    const searchQuery = ref('')
    const currentFilter = ref('all')
    const lastSavedTime = ref('')
    const showModal = ref(false)
    const modalTitle = ref('')
    const modalContent = ref('')
    const modalConfirmAction = ref(null)

    const filteredElderlyList = computed(() => {
      let list = [...elderlyList.value]

      if (currentFilter.value !== 'all') {
        list = list.filter(elderly => {
          const level = getRiskLevel(elderly)
          return level === currentFilter.value
        })
      }

      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        list = list.filter(elderly => 
          elderly.name.toLowerCase().includes(query) ||
          elderly.phone.includes(query) ||
          elderly.address.toLowerCase().includes(query)
        )
      }

      return sortByRiskPriority(list)
    })

    function getRiskLevel(elderly) {
      if (elderly.manualOverride) {
        return elderly.manualOverride
      }
      return assessElderlyRisk(elderly).overallLevel
    }

    function getRiskAssessment(elderly) {
      return assessElderlyRisk(elderly)
    }

    function getRiskTags(elderly) {
      const assessment = getRiskAssessment(elderly)
      return assessment.risks.map(risk => ({
        ...RISK_TAGS[risk.type],
        level: risk.level
      }))
    }

    function getRiskLabel(type) {
      return RISK_TAGS[type]?.label || '未知'
    }

    function getRiskLevelLabel(elderly) {
      const level = getRiskLevel(elderly)
      const labels = {
        high: '🔴 高风险',
        medium: '🟡 中风险',
        low: '🟢 低风险',
        normal: '✅ 正常'
      }
      return labels[level] || '未知'
    }

    function getRiskCount(level) {
      return elderlyList.value.filter(elderly => getRiskLevel(elderly) === level).length
    }

    function getCountBadgeClass() {
      if (getRiskCount('high') > 0) return 'badge-danger'
      if (getRiskCount('medium') > 0) return 'badge-warning'
      return 'badge-success'
    }

    function getSelectedRiskBadgeClass() {
      if (!selectedElderly.value) return 'badge-secondary'
      const level = getRiskLevel(selectedElderly.value)
      const classes = {
        high: 'badge-danger',
        medium: 'badge-warning',
        low: 'badge-info',
        normal: 'badge-success'
      }
      return classes[level] || 'badge-secondary'
    }

    function selectElderly(elderly) {
      selectedElderly.value = elderly
    }

    async function saveData() {
      await saveToStore(elderlyList.value)
      lastSavedTime.value = new Date().toLocaleTimeString('zh-CN')
    }

    async function loadData() {
      const data = await loadFromStore()
      if (data && data.length > 0) {
        elderlyList.value = data
      }
    }

    async function loadSampleData() {
      if (elderlyList.value.length > 0) {
        showConfirmModal(
          '确认导入',
          '<p>当前已有数据，导入示例数据将清空现有数据。</p><p>是否继续？</p>',
          () => {
            elderlyList.value = getSampleData()
            saveData()
            showModal.value = false
          }
        )
      } else {
        elderlyList.value = getSampleData()
        saveData()
        showSuccessModal('导入成功', '已导入 5 条示例数据，包括各种风险情况。')
      }
    }

    async function importCsv() {
      try {
        const result = await openFileDialog(['csv', 'txt'])
        if (result && result.content) {
          const importedData = await importFromCsv(result.content)
          if (importedData && importedData.length > 0) {
            elderlyList.value = [...elderlyList.value, ...importedData]
            await saveData()
            showSuccessModal('导入成功', `已从 ${result.name} 导入 ${importedData.length} 条数据。`)
          } else {
            showErrorModal('导入失败', 'CSV文件中没有找到有效数据。')
          }
        }
      } catch (error) {
        console.error('导入CSV失败:', error)
        showErrorModal('导入失败', `导入过程中出错：${error.message}`)
      }
    }

    async function exportMarkdown() {
      if (elderlyList.value.length === 0) {
        showErrorModal('导出失败', '当前没有数据可导出。')
        return
      }

      try {
        const mdContent = exportToMarkdown(elderlyList.value)
        const fileName = `回访清单_${new Date().toISOString().split('T')[0]}.md`
        
        if (window.electronAPI) {
          const filePath = await saveFileDialog(fileName, mdContent)
          if (filePath) {
            const fs = require('fs')
            fs.writeFileSync(filePath, mdContent, 'utf-8')
            showSuccessModal('导出成功', `回访清单已保存到：${filePath}`)
          }
        } else {
          const blob = new Blob([mdContent], { type: 'text/markdown' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          showSuccessModal('导出成功', `回访清单已下载：${fileName}`)
        }
      } catch (error) {
        console.error('导出Markdown失败:', error)
        showErrorModal('导出失败', `导出过程中出错：${error.message}`)
      }
    }

    async function exportJson() {
      if (elderlyList.value.length === 0) {
        showErrorModal('导出失败', '当前没有数据可导出。')
        return
      }

      try {
        const jsonContent = exportToJson(elderlyList.value)
        const fileName = `数据明细_${new Date().toISOString().split('T')[0]}.json`
        
        if (window.electronAPI) {
          const filePath = await saveFileDialog(fileName, jsonContent)
          if (filePath) {
            const fs = require('fs')
            fs.writeFileSync(filePath, jsonContent, 'utf-8')
            showSuccessModal('导出成功', `数据明细已保存到：${filePath}`)
          }
        } else {
          const blob = new Blob([jsonContent], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          showSuccessModal('导出成功', `数据明细已下载：${fileName}`)
        }
      } catch (error) {
        console.error('导出JSON失败:', error)
        showErrorModal('导出失败', `导出过程中出错：${error.message}`)
      }
    }

    function clearAllData() {
      showConfirmModal(
        '确认清空',
        '<p>确定要清空所有数据吗？</p><p style="color: #dc2626;"><strong>此操作不可撤销！</strong></p>',
        () => {
          elderlyList.value = []
          selectedElderly.value = null
          saveData()
          showModal.value = false
        }
      )
    }

    function setManualOverride(level) {
      if (selectedElderly.value) {
        selectedElderly.value.manualOverride = level
        const index = elderlyList.value.findIndex(e => e.id === selectedElderly.value.id)
        if (index !== -1) {
          elderlyList.value[index] = { ...selectedElderly.value }
        }
        saveData()
      }
    }

    function saveRemarks() {
      if (selectedElderly.value) {
        const index = elderlyList.value.findIndex(e => e.id === selectedElderly.value.id)
        if (index !== -1) {
          elderlyList.value[index] = { ...selectedElderly.value }
        }
        saveData()
      }
    }

    function showSuccessModal(title, message) {
      modalTitle.value = title
      modalContent.value = `<p style="color: #059669;">${message}</p>`
      modalConfirmAction.value = null
      showModal.value = true
    }

    function showErrorModal(title, message) {
      modalTitle.value = title
      modalContent.value = `<p style="color: #dc2626;">${message}</p>`
      modalConfirmAction.value = null
      showModal.value = true
    }

    function showConfirmModal(title, content, action) {
      modalTitle.value = title
      modalContent.value = content
      modalConfirmAction.value = action
      showModal.value = true
    }

    function executeModalAction() {
      if (modalConfirmAction.value) {
        modalConfirmAction.value()
      }
    }

    onMounted(async () => {
      await loadData()
    })

    return {
      elderlyList,
      selectedElderly,
      searchQuery,
      currentFilter,
      lastSavedTime,
      showModal,
      modalTitle,
      modalContent,
      modalConfirmAction,
      filteredElderlyList,
      getRiskLevel,
      getRiskAssessment,
      getRiskTags,
      getRiskLabel,
      getRiskLevelLabel,
      getRiskCount,
      getCountBadgeClass,
      getSelectedRiskBadgeClass,
      selectElderly,
      loadSampleData,
      importCsv,
      exportMarkdown,
      exportJson,
      clearAllData,
      setManualOverride,
      saveRemarks,
      executeModalAction
    }
  }
}
</script>

<style>
/* 样式已在 styles.css 中定义 */
</style>
