<template>
  <div class="import-view">
    <div class="page-header">
      <h2>📥 导入数据</h2>
      <p>将分镜CSV、角色设定JSON、对白稿和草图路径导入系统进行连续性检查</p>
    </div>

    <div class="import-sections">
      <div class="import-card">
        <div class="card-header">
          <h3>📊 分镜 CSV</h3>
          <span class="file-info">{{ storyboardFile?.name || '未选择文件' }}</span>
        </div>
        <div class="card-body">
          <p class="help-text">
            支持的列名：panel_number/格数, page_number/页数, time_of_day/时间段, 
            location/场景, characters_present/出场角色, costumes/服装, 
            props/道具, action/动作, sketch_path/草图路径, notes/备注
          </p>
          <div class="import-controls">
            <div class="form-group">
              <label>章节号</label>
              <input v-model.number="chapterNumber" type="number" min="1" class="form-input" />
            </div>
            <div class="form-group">
              <label>章节标题 (可选)</label>
              <input v-model="chapterTitle" type="text" placeholder="例如：第一章 相遇" class="form-input" />
            </div>
            <input 
              ref="storyboardInput"
              type="file" 
              accept=".csv"
              @change="onStoryboardSelect"
              class="file-input"
            />
            <button 
              @click="triggerStoryboardInput"
              class="btn btn-secondary"
            >
              选择文件
            </button>
            <button 
              @click="importStoryboard"
              :disabled="!storyboardFile || importingStoryboard"
              class="btn btn-primary"
            >
              {{ importingStoryboard ? '导入中...' : '导入分镜' }}
            </button>
          </div>
        </div>
      </div>

      <div class="import-card">
        <div class="card-header">
          <h3>👥 角色设定 JSON</h3>
          <span class="file-info">{{ charactersFile?.name || '未选择文件' }}</span>
        </div>
        <div class="card-body">
          <p class="help-text">
            JSON格式：每个角色包含 name/姓名, full_name/全名, aliases/别名, 
            costume_default/默认服装, props_default/默认道具 等字段
          </p>
          <div class="import-controls">
            <input 
              ref="charactersInput"
              type="file" 
              accept=".json"
              @change="onCharactersSelect"
              class="file-input"
            />
            <button 
              @click="triggerCharactersInput"
              class="btn btn-secondary"
            >
              选择文件
            </button>
            <button 
              @click="importCharacters"
              :disabled="!charactersFile || importingCharacters"
              class="btn btn-primary"
            >
              {{ importingCharacters ? '导入中...' : '导入角色' }}
            </button>
          </div>
        </div>
      </div>

      <div class="import-card">
        <div class="card-header">
          <h3>💬 对白稿</h3>
          <span class="file-info">{{ dialoguesFile?.name || '未选择文件' }}</span>
        </div>
        <div class="card-body">
          <p class="help-text">
            文本格式：支持【第X格】标记格数，对白格式为"角色名: 对白内容"或"角色名对XX说: 对白内容"
          </p>
          <div class="import-controls">
            <div class="form-group">
              <label>章节号</label>
              <input v-model.number="dialogueChapterNumber" type="number" min="1" class="form-input" />
            </div>
            <input 
              ref="dialoguesInput"
              type="file" 
              accept=".txt,.md"
              @change="onDialoguesSelect"
              class="file-input"
            />
            <button 
              @click="triggerDialoguesInput"
              class="btn btn-secondary"
            >
              选择文件
            </button>
            <button 
              @click="importDialogues"
              :disabled="!dialoguesFile || importingDialogues"
              class="btn btn-primary"
            >
              {{ importingDialogues ? '导入中...' : '导入对白' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button 
        @click="runValidation"
        :disabled="runningValidation"
        class="btn btn-primary btn-large"
      >
        {{ runningValidation ? '🔄 校验中...' : '🔍 开始连续性检查' }}
      </button>
      <button 
        @click="clearAllData"
        class="btn btn-danger"
      >
        🗑️ 清除所有数据
      </button>
    </div>

    <div v-if="messages.length" class="messages">
      <div 
        v-for="(msg, idx) in messages" 
        :key="idx"
        class="message"
        :class="msg.type"
      >
        {{ msg.text }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const router = useRouter()

const chapterNumber = ref(1)
const chapterTitle = ref('')
const dialogueChapterNumber = ref(1)

const storyboardFile = ref(null)
const charactersFile = ref(null)
const dialoguesFile = ref(null)

const importingStoryboard = ref(false)
const importingCharacters = ref(false)
const importingDialogues = ref(false)
const runningValidation = ref(false)

const messages = ref([])

const storyboardInput = ref(null)
const charactersInput = ref(null)
const dialoguesInput = ref(null)

const addMessage = (text, type = 'info') => {
  messages.value.push({ text, type })
  setTimeout(() => {
    const idx = messages.value.findIndex(m => m.text === text)
    if (idx > -1) messages.value.splice(idx, 1)
  }, 5000)
}

const triggerStoryboardInput = () => storyboardInput.value?.click()
const triggerCharactersInput = () => charactersInput.value?.click()
const triggerDialoguesInput = () => dialoguesInput.value?.click()

const onStoryboardSelect = (e) => {
  storyboardFile.value = e.target.files?.[0] || null
}

const onCharactersSelect = (e) => {
  charactersFile.value = e.target.files?.[0] || null
}

const onDialoguesSelect = (e) => {
  dialoguesFile.value = e.target.files?.[0] || null
}

const importStoryboard = async () => {
  if (!storyboardFile.value) return
  
  importingStoryboard.value = true
  try {
    const formData = new FormData()
    formData.append('file', storyboardFile.value)
    formData.append('chapter_number', chapterNumber.value)
    if (chapterTitle.value) {
      formData.append('chapter_title', chapterTitle.value)
    }
    
    const response = await api.importStoryboard(formData)
    addMessage(response.data.message || '分镜导入成功', 'success')
    storyboardFile.value = null
    storyboardInput.value.value = ''
  } catch (e) {
    addMessage(`导入失败: ${e.response?.data?.detail || e.message}`, 'error')
  } finally {
    importingStoryboard.value = false
  }
}

const importCharacters = async () => {
  if (!charactersFile.value) return
  
  importingCharacters.value = true
  try {
    const formData = new FormData()
    formData.append('file', charactersFile.value)
    
    const response = await api.importCharacters(formData)
    addMessage(response.data.message || '角色设定导入成功', 'success')
    charactersFile.value = null
    charactersInput.value.value = ''
  } catch (e) {
    addMessage(`导入失败: ${e.response?.data?.detail || e.message}`, 'error')
  } finally {
    importingCharacters.value = false
  }
}

const importDialogues = async () => {
  if (!dialoguesFile.value) return
  
  importingDialogues.value = true
  try {
    const formData = new FormData()
    formData.append('file', dialoguesFile.value)
    formData.append('chapter_number', dialogueChapterNumber.value)
    
    const response = await api.importDialogues(formData)
    addMessage(response.data.message || '对白导入成功', 'success')
    dialoguesFile.value = null
    dialoguesInput.value.value = ''
  } catch (e) {
    addMessage(`导入失败: ${e.response?.data?.detail || e.message}`, 'error')
  } finally {
    importingDialogues.value = false
  }
}

const runValidation = async () => {
  runningValidation.value = true
  try {
    const response = await api.runValidation()
    const result = response.data
    addMessage(`校验完成！发现 ${result.total_issues} 个问题`, 'success')
    
    if (result.total_issues > 0) {
      setTimeout(() => {
        router.push('/issues')
      }, 1000)
    }
  } catch (e) {
    addMessage(`校验失败: ${e.response?.data?.detail || e.message}`, 'error')
  } finally {
    runningValidation.value = false
  }
}

const clearAllData = async () => {
  if (!confirm('确定要清除所有数据吗？此操作不可撤销！')) {
    return
  }
  
  try {
    await api.clearAllData()
    addMessage('所有数据已清除', 'info')
  } catch (e) {
    addMessage(`清除失败: ${e.message}`, 'error')
  }
}
</script>

<style scoped>
.import-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  margin-bottom: 1rem;
}

.page-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.page-header p {
  margin: 0;
  color: #666;
}

.import-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.import-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  background: #f8f9fa;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e9ecef;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.file-info {
  color: #888;
  font-size: 0.875rem;
}

.card-body {
  padding: 1.5rem;
}

.help-text {
  color: #666;
  font-size: 0.875rem;
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
}

.import-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.875rem;
  color: #555;
  font-weight: 500;
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
  min-width: 120px;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.file-input {
  display: none;
}

.btn {
  padding: 0.6rem 1.25rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-large {
  padding: 0.85rem 2rem;
  font-size: 1.05rem;
}

.action-bar {
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

@media (max-width: 768px) {
  .import-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-bar {
    flex-direction: column;
  }
}
</style>
