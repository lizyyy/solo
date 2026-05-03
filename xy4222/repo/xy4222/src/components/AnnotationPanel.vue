<template>
  <div class="annotation-panel">
    <!-- 批注列表 -->
    <div class="annotations-list">
      <div class="panel-header">
        <h3>批注列表</h3>
        <span class="count-badge">{{ annotations.length }} 个</span>
      </div>

      <div class="list-container">
        <div 
          v-for="(annotation, index) in annotations" 
          :key="annotation.id"
          class="annotation-item"
          :class="{ 
            'selected': selectedAnnotation?.id === annotation.id,
            [`risk-${annotation.riskLevel}`]: true
          }"
          @click="emit('select-annotation', annotation.id)"
        >
          <div class="item-header">
            <span class="annotation-number">#{{ index + 1 }}</span>
            <span class="annotation-type" :style="{ color: getAnnotationColor(annotation.type) }">
              {{ getTypeLabel(annotation.type) }}
            </span>
          </div>
          <div class="item-preview">
            <span class="risk-badge" :class="`risk-${annotation.riskLevel}`">
              {{ getRiskLabel(annotation.riskLevel) }}
            </span>
          </div>
          <p v-if="annotation.comment" class="item-comment">
            {{ annotation.comment.length > 80 ? annotation.comment.substring(0, 80) + '...' : annotation.comment }}
          </p>
        </div>

        <div v-if="annotations.length === 0" class="empty-list">
          <p>暂无批注</p>
          <p class="text-muted">在图片上框选区域添加批注</p>
        </div>
      </div>
    </div>

    <!-- 批注详情编辑 -->
    <div class="annotation-editor" v-if="selectedAnnotation">
      <div class="panel-header">
        <h3>批注详情</h3>
        <button class="btn btn-danger btn-sm" @click="confirmDelete">
          删除
        </button>
      </div>

      <div class="editor-content">
        <div class="form-group">
          <label class="form-label">批注类型</label>
          <select 
            v-model="editingAnnotation.type" 
            class="form-select"
            @change="saveChanges"
          >
            <option v-for="(label, value) in annotationTypeOptions" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">风险等级</label>
          <div class="risk-options">
            <label 
              v-for="(label, value) in riskLevelOptions" 
              :key="value"
              class="risk-option"
              :class="{ 
                'active': editingAnnotation.riskLevel === value,
                `risk-${value}`: true
              }"
              @click="setRiskLevel(value)"
            >
              {{ label }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">位置信息</label>
          <div class="position-info">
            <div class="pos-item">
              <span class="pos-label">X:</span>
              <span class="pos-value">{{ Math.round(editingAnnotation.position.x) }}</span>
            </div>
            <div class="pos-item">
              <span class="pos-label">Y:</span>
              <span class="pos-value">{{ Math.round(editingAnnotation.position.y) }}</span>
            </div>
            <div class="pos-item">
              <span class="pos-label">宽:</span>
              <span class="pos-value">{{ Math.round(editingAnnotation.position.width) }}</span>
            </div>
            <div class="pos-item">
              <span class="pos-label">高:</span>
              <span class="pos-value">{{ Math.round(editingAnnotation.position.height) }}</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">批注内容</label>
          <textarea 
            v-model="editingAnnotation.comment"
            class="form-input"
            rows="4"
            placeholder="描述这个区域的问题..."
            @blur="saveChanges"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">处理建议</label>
          <textarea 
            v-model="editingAnnotation.suggestion"
            class="form-input"
            rows="4"
            placeholder="建议的修复方案..."
            @blur="saveChanges"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- 无选择提示 -->
    <div v-else class="no-selection" v-if="annotations.length > 0">
      <div class="placeholder-icon">📍</div>
      <p>点击列表中的批注</p>
      <p class="text-muted">或在图片上框选新区域</p>
    </div>

    <!-- 确认删除模态框 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal modal-sm">
        <div class="modal-body">
          <h4>确认删除批注?</h4>
          <p class="text-muted mt-2">此操作不可撤销。</p>
          <div class="form-actions flex justify-end gap-2 mt-4">
            <button class="btn btn-secondary" @click="showDeleteConfirm = false">
              取消
            </button>
            <button class="btn btn-danger" @click="deleteAnnotation">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, reactive } from 'vue'
import { AnnotationTypeLabels, AnnotationTypeColors } from '../models/AnnotationType'
import { RiskLevelLabels } from '../models/RiskLevel'

const props = defineProps({
  image: {
    type: Object,
    default: null
  },
  annotations: {
    type: Array,
    default: () => []
  },
  selectedAnnotation: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['select-annotation', 'update-annotation', 'delete-annotation'])

const showDeleteConfirm = ref(false)
const editingAnnotation = reactive({
  type: '',
  riskLevel: '',
  position: { x: 0, y: 0, width: 0, height: 0 },
  comment: '',
  suggestion: ''
})

// 选项数据
const annotationTypeOptions = AnnotationTypeLabels
const riskLevelOptions = RiskLevelLabels

// 监听选中批注变化
watch(() => props.selectedAnnotation, (annotation) => {
  if (annotation) {
    editingAnnotation.type = annotation.type
    editingAnnotation.riskLevel = annotation.riskLevel
    editingAnnotation.position = { ...annotation.position }
    editingAnnotation.comment = annotation.comment || ''
    editingAnnotation.suggestion = annotation.suggestion || ''
  }
}, { immediate: true, deep: true })

// 获取批注颜色
function getAnnotationColor(type) {
  return AnnotationTypeColors[type] || '#778ca3'
}

// 获取类型标签
function getTypeLabel(type) {
  return AnnotationTypeLabels[type] || type
}

// 获取风险等级标签
function getRiskLabel(riskLevel) {
  return RiskLevelLabels[riskLevel] || riskLevel
}

// 设置风险等级
function setRiskLevel(riskLevel) {
  editingAnnotation.riskLevel = riskLevel
  saveChanges()
}

// 保存更改
function saveChanges() {
  if (!props.selectedAnnotation) return
  
  emit('update-annotation', props.selectedAnnotation.id, {
    type: editingAnnotation.type,
    riskLevel: editingAnnotation.riskLevel,
    comment: editingAnnotation.comment,
    suggestion: editingAnnotation.suggestion
  })
}

// 确认删除
function confirmDelete() {
  showDeleteConfirm.value = true
}

// 删除批注
function deleteAnnotation() {
  if (props.selectedAnnotation) {
    emit('delete-annotation', props.selectedAnnotation.id)
  }
  showDeleteConfirm.value = false
}
</script>

<style scoped>
.annotation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.count-badge {
  background: #e6f4ff;
  color: #1890ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
}

.annotations-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #f0f0f0;
}

.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.annotation-item {
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 8px;
  border-left: 3px solid #d9d9d9;
  background: #fafafa;
  transition: all 0.2s;
}

.annotation-item:hover {
  background: #f0f0f0;
}

.annotation-item.selected {
  background: #e6f4ff;
  border-left-color: #1890ff;
}

/* 风险等级边框颜色 */
.annotation-item.risk-low {
  border-left-color: #52c41a;
}

.annotation-item.risk-medium {
  border-left-color: #faad14;
}

.annotation-item.risk-high {
  border-left-color: #fa8c16;
}

.annotation-item.risk-critical {
  border-left-color: #ff4d4f;
}

.annotation-item.selected.risk-low {
  background: #f6ffed;
}

.annotation-item.selected.risk-medium {
  background: #fffbe6;
}

.annotation-item.selected.risk-high {
  background: #fff2e8;
}

.annotation-item.selected.risk-critical {
  background: #fff2f0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.annotation-number {
  font-weight: 600;
  color: #1890ff;
}

.annotation-type {
  font-size: 0.85rem;
  font-weight: 500;
}

.item-preview {
  margin-bottom: 6px;
}

.risk-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.risk-badge.risk-low {
  background: #f6ffed;
  color: #52c41a;
}

.risk-badge.risk-medium {
  background: #fffbe6;
  color: #faad14;
}

.risk-badge.risk-high {
  background: #fff2e8;
  color: #fa8c16;
}

.risk-badge.risk-critical {
  background: #fff2f0;
  color: #ff4d4f;
}

.item-comment {
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
  margin: 0;
}

.empty-list,
.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #999;
}

.placeholder-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.empty-list p,
.no-selection p {
  margin: 4px 0;
}

/* 批注编辑器 */
.annotation-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-input,
.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #1890ff;
}

/* 风险等级选项 */
.risk-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.risk-option {
  padding: 8px 12px;
  border: 2px solid #e8e8e8;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.risk-option:hover {
  border-color: #1890ff;
}

.risk-option.active {
  border-color: #1890ff;
  background: #e6f4ff;
  color: #1890ff;
}

/* 风险等级颜色 */
.risk-option.risk-low.active {
  border-color: #52c41a;
  background: #f6ffed;
  color: #52c41a;
}

.risk-option.risk-medium.active {
  border-color: #faad14;
  background: #fffbe6;
  color: #faad14;
}

.risk-option.risk-high.active {
  border-color: #fa8c16;
  background: #fff2e8;
  color: #fa8c16;
}

.risk-option.risk-critical.active {
  border-color: #ff4d4f;
  background: #fff2f0;
  color: #ff4d4f;
}

/* 位置信息 */
.position-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.pos-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pos-label {
  font-weight: 500;
  color: #666;
  font-size: 0.85rem;
}

.pos-value {
  font-family: monospace;
  font-size: 0.9rem;
  color: #333;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.modal-sm {
  max-width: 350px;
}

.modal-body h4 {
  margin: 0 0 8px 0;
  font-size: 1rem;
}

.form-actions {
  margin-top: 16px;
}
</style>
