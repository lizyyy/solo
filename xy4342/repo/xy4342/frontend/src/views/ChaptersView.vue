<template>
  <div class="chapters-view">
    <div class="page-header">
      <h2>📖 章节查看</h2>
      <p>按章节查看分镜内容、对白和相关问题</p>
    </div>

    <div v-if="chapters.length > 0" class="chapter-nav">
      <div class="nav-label">选择章节:</div>
      <div class="chapter-tabs">
        <button 
          v-for="chap in chapters" 
          :key="chap.id"
          @click="selectChapter(chap)"
          class="chapter-tab"
          :class="{ 'active': selectedChapter?.id === chap.id }"
        >
          <span class="chap-num">第{{ chap.chapter_number }}章</span>
          <span class="chap-title">{{ chap.chapter_title }}</span>
          <span class="chap-count">{{ chap.panels?.length || 0 }}格</span>
        </button>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">📁</div>
      <h3>暂无章节数据</h3>
      <p>请先导入分镜CSV数据</p>
    </div>

    <div v-if="selectedChapter" class="chapter-content">
      <div class="chapter-header">
        <h3>第{{ selectedChapter.chapter_number }}章: {{ selectedChapter.chapter_title }}</h3>
        <div class="chapter-stats">
          <span>📊 分镜格数: {{ selectedChapter.panels?.length || 0 }}</span>
          <span>💬 对白数: {{ dialogues.length }}</span>
        </div>
      </div>

      <div class="panels-list">
        <div 
          v-for="panel in orderedPanels" 
          :key="panel.id"
          class="panel-card"
        >
          <div class="panel-header">
            <div class="panel-number">
              <span class="label">格</span>
              <span class="num">{{ panel.panel_number }}</span>
            </div>
            <div class="panel-meta">
              <div v-if="panel.page_number" class="meta-item">
                <span class="meta-label">页数:</span>
                <span class="meta-value">P.{{ panel.page_number }}</span>
              </div>
              <div v-if="panel.time_of_day" class="meta-item">
                <span class="meta-label">时间:</span>
                <span class="meta-value">{{ panel.time_of_day }}</span>
              </div>
              <div v-if="panel.location" class="meta-item">
                <span class="meta-label">场景:</span>
                <span class="meta-value">{{ panel.location }}</span>
              </div>
            </div>
          </div>

          <div class="panel-body">
            <div v-if="panel.characters_present" class="panel-section">
              <h4>👥 出场角色</h4>
              <div class="tags">
                <span 
                  v-for="char in parseTags(panel.characters_present)" 
                  :key="char"
                  class="tag tag-char"
                >
                  {{ char }}
                </span>
              </div>
            </div>

            <div v-if="panel.costumes" class="panel-section">
              <h4>👕 服装</h4>
              <div class="tags">
                <span 
                  v-for="item in parseTags(panel.costumes)" 
                  :key="item"
                  class="tag tag-costume"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <div v-if="panel.props" class="panel-section">
              <h4>🎒 道具</h4>
              <div class="tags">
                <span 
                  v-for="item in parseTags(panel.props)" 
                  :key="item"
                  class="tag tag-prop"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <div v-if="panel.action" class="panel-section">
              <h4>🎬 动作</h4>
              <p class="action-text">{{ panel.action }}</p>
            </div>

            <div v-if="panel.notes" class="panel-section">
              <h4>📝 备注</h4>
              <p class="notes-text">{{ panel.notes }}</p>
            </div>

            <div v-if="getPanelDialogues(panel.panel_number).length > 0" class="panel-section">
              <h4>💬 对白</h4>
              <div class="dialogues">
                <div 
                  v-for="dialogue in getPanelDialogues(panel.panel_number)" 
                  :key="dialogue.id"
                  class="dialogue-item"
                >
                  <div class="dialogue-speaker">
                    <span class="speaker-name">{{ dialogue.speaker || '未知' }}</span>
                    <span v-if="dialogue.address_to" class="address-to">
                      对 {{ dialogue.address_to }} 说
                    </span>
                  </div>
                  <div class="dialogue-content">「{{ dialogue.content }}」</div>
                </div>
              </div>
            </div>

            <div v-if="getPanelIssues(panel.panel_number).length > 0" class="panel-section">
              <h4>⚠️ 相关问题</h4>
              <div class="related-issues">
                <div 
                  v-for="issue in getPanelIssues(panel.panel_number)" 
                  :key="issue.id"
                  class="related-issue"
                  :class="`issue-${issue.severity}`"
                >
                  <span class="issue-badge">
                    {{ getSeverityLabel(issue.severity) }}
                  </span>
                  <span class="issue-title">#{{ issue.id }} {{ issue.title }}</span>
                  <span class="issue-status">[{{ getStatusLabel(issue.status) }}]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

const chapters = ref([])
const selectedChapter = ref(null)
const dialogues = ref([])
const issues = ref([])

const loadChapters = async () => {
  try {
    const response = await api.getChapters()
    chapters.value = response.data
    if (chapters.value.length > 0) {
      selectChapter(chapters.value[0])
    }
  } catch (e) {
    console.error('Failed to load chapters:', e)
  }
}

const selectChapter = (chapter) => {
  selectedChapter.value = chapter
  loadDialogues(chapter.id)
  loadIssues(chapter.chapter_number)
}

const loadDialogues = async (chapterId) => {
  try {
    const response = await api.getDialogues({ chapter_id: chapterId })
    dialogues.value = response.data
  } catch (e) {
    console.error('Failed to load dialogues:', e)
  }
}

const loadIssues = async (chapterNumber) => {
  try {
    const response = await api.getIssues()
    issues.value = response.data
  } catch (e) {
    console.error('Failed to load issues:', e)
  }
}

const orderedPanels = computed(() => {
  if (!selectedChapter.value?.panels) return []
  return [...selectedChapter.value.panels].sort((a, b) => a.panel_number - b.panel_number)
})

const parseTags = (value) => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch (e) {}
  
  return value.split(/[,，、]/).map(s => s.trim()).filter(s => s)
}

const getPanelDialogues = (panelNumber) => {
  return dialogues.value.filter(d => d.panel_number === panelNumber)
}

const getPanelIssues = (panelNumber) => {
  if (!selectedChapter.value) return []
  const chapterNum = selectedChapter.value.chapter_number
  const panelRef = `第${chapterNum}章第${panelNumber}格`
  
  return issues.value.filter(issue => 
    issue.affected_panels?.includes(panelRef) ||
    issue.affected_panels?.includes(`第${panelNumber}格`)
  )
}

const getSeverityLabel = (severity) => {
  const labels = {
    critical: '🔴 严重',
    high: '🟠 高',
    medium: '🟡 中',
    low: '🟢 低'
  }
  return labels[severity] || severity
}

const getStatusLabel = (status) => {
  const labels = {
    open: '待处理',
    confirmed: '已确认',
    dismissed: '已忽略',
    fixed: '已修复'
  }
  return labels[status] || status
}

onMounted(() => {
  loadChapters()
})
</script>

<style scoped>
.chapters-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.page-header p {
  margin: 0;
  color: #666;
}

.chapter-nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nav-label {
  font-weight: 600;
  color: #555;
}

.chapter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chapter-tab {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1.25rem;
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
}

.chapter-tab:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.chapter-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
}

.chap-num {
  font-size: 0.85rem;
  opacity: 0.8;
}

.chapter-tab.active .chap-num {
  opacity: 0.9;
}

.chap-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.chap-count {
  font-size: 0.8rem;
  opacity: 0.7;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.empty-state p {
  margin: 0;
  color: #666;
}

.chapter-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.chapter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.chapter-header h3 {
  margin: 0;
  color: #333;
}

.chapter-stats {
  display: flex;
  gap: 1.5rem;
  color: #666;
  font-size: 0.95rem;
}

.panels-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.panel-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.panel-header {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
}

.panel-number {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.panel-number .label {
  font-size: 0.75rem;
  opacity: 0.9;
}

.panel-number .num {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.panel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.meta-label {
  font-size: 0.75rem;
  color: #888;
}

.meta-value {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
}

.panel-body {
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #555;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
}

.tag-char {
  background: #e3f2fd;
  color: #1565c0;
}

.tag-costume {
  background: #fff3e0;
  color: #ef6c00;
}

.tag-prop {
  background: #f3e5f5;
  color: #7b1fa2;
}

.action-text, .notes-text {
  margin: 0;
  color: #333;
  line-height: 1.6;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #667eea;
}

.notes-text {
  background: #fff9e6;
  border-left-color: #ffc107;
  font-style: italic;
}

.dialogues {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialogue-item {
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.dialogue-speaker {
  margin-bottom: 0.25rem;
}

.speaker-name {
  font-weight: 600;
  color: #667eea;
}

.address-to {
  font-size: 0.85rem;
  color: #888;
  margin-left: 0.5rem;
}

.dialogue-content {
  color: #333;
  line-height: 1.5;
}

.related-issues {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.related-issue {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fff3cd;
  border-radius: 6px;
  font-size: 0.85rem;
}

.related-issue.issue-critical { background: #f8d7da; }
.related-issue.issue-high { background: #ffe5d0; }
.related-issue.issue-medium { background: #fff3cd; }
.related-issue.issue-low { background: #d4edda; }

.issue-badge {
  font-weight: 600;
}

.issue-title {
  flex: 1;
  color: #333;
}

.issue-status {
  color: #666;
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .panels-list {
    grid-template-columns: 1fr;
  }
  
  .chapter-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .chapter-stats {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .panel-meta {
    width: 100%;
  }
}
</style>
