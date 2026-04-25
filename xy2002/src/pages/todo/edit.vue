<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useTodoStore } from '@/stores/todo';
import type { Todo, TodoPriority } from '@/types';

const todoStore = useTodoStore();

const todoId = ref('');
const todo = ref<Todo | null>(null);

const title = ref('');
const description = ref('');
const isImportant = ref(false);
const isUrgent = ref(false);
const priority = ref<TodoPriority>('medium');
const dueDate = ref('');
const dueTime = ref('');
const remindAt = ref('');

const priorityOptions: { value: TodoPriority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
];

onLoad((options) => {
  if (options.id) {
    todoId.value = options.id;
    loadTodo();
  }
});

function loadTodo() {
  const found = todoStore.todos.find(t => t.id === todoId.value);
  if (found) {
    todo.value = found;
    title.value = found.title;
    description.value = found.description;
    isImportant.value = found.isImportant;
    isUrgent.value = found.isUrgent;
    priority.value = found.priority;
    dueDate.value = found.dueDate || '';
    dueTime.value = found.dueTime || '';
    remindAt.value = found.remindAt || '';
  }
}

function getCategoryName(): string {
  if (isImportant.value && isUrgent.value) return '重要且紧急 🔥';
  if (isImportant.value && !isUrgent.value) return '重要不紧急 ⭐';
  if (!isImportant.value && isUrgent.value) return '紧急不重要 ⏰';
  return '不重要不紧急 📝';
}

function saveTodo() {
  if (!title.value.trim()) {
    uni.showToast({
      title: '请输入任务标题',
      icon: 'none'
    });
    return;
  }

  todoStore.updateTodo(todoId.value, {
    title: title.value,
    description: description.value,
    isImportant: isImportant.value,
    isUrgent: isUrgent.value,
    priority: priority.value,
    dueDate: dueDate.value || null,
    dueTime: dueTime.value || null,
    remindAt: remindAt.value || null
  });

  uni.showToast({
    title: '保存成功',
    icon: 'success'
  });

  setTimeout(() => {
    uni.navigateBack();
  }, 1500);
}

function deleteTodo() {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个任务吗？',
    success: (res) => {
      if (res.confirm) {
        todoStore.deleteTodo(todoId.value);
        uni.showToast({
          title: '删除成功',
          icon: 'success'
        });
        setTimeout(() => {
          uni.navigateBack();
        }, 1500);
      }
    }
  });
}

function onDueDateChange(e: any) {
  dueDate.value = e.detail.value;
}

function onRemindAtChange(e: any) {
  remindAt.value = e.detail.value;
}

function onDueTimeChange(e: any) {
  dueTime.value = e.detail.value;
}

function clearDate(field: 'dueDate' | 'remindAt') {
  if (field === 'dueDate') {
    dueDate.value = '';
    dueTime.value = '';
  } else {
    remindAt.value = '';
  }
}
</script>

<template>
  <view class="edit-todo-page">
    <view class="form-section">
      <view class="form-item">
        <view class="form-label">任务标题</view>
        <input 
          v-model="title" 
          class="form-input" 
          placeholder="请输入任务标题"
          maxlength="100"
        />
      </view>

      <view class="form-item">
        <view class="form-label">任务描述</view>
        <textarea 
          v-model="description" 
          class="form-textarea" 
          placeholder="请输入任务描述（可选）"
          maxlength="500"
        />
      </view>

      <view class="form-item quadrant-selector">
        <view class="form-label">四象限分类</view>
        <view class="quadrant-preview">
          <text class="category-badge">{{ getCategoryName() }}</text>
        </view>
        <view class="quadrant-options">
          <view class="option-row">
            <view 
              :class="['option-cell', { selected: isImportant && isUrgent }]"
              @click="isImportant = !isImportant; isUrgent = !isUrgent"
            >
              <text class="option-icon">🔥</text>
              <text class="option-text">重要且紧急</text>
            </view>
            <view 
              :class="['option-cell', { selected: !isImportant && isUrgent }]"
              @click="isImportant = !isImportant; isUrgent = !isUrgent"
            >
              <text class="option-icon">⏰</text>
              <text class="option-text">紧急不重要</text>
            </view>
          </view>
          <view class="option-row">
            <view 
              :class="['option-cell', { selected: isImportant && !isUrgent }]"
              @click="isImportant = !isImportant; isUrgent = !isUrgent"
            >
              <text class="option-icon">⭐</text>
              <text class="option-text">重要不紧急</text>
            </view>
            <view 
              :class="['option-cell', { selected: !isImportant && !isUrgent }]"
              @click="isImportant = !isImportant; isUrgent = !isUrgent"
            >
              <text class="option-icon">📝</text>
              <text class="option-text">不重要不紧急</text>
            </view>
          </view>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">优先级</view>
        <view class="priority-options">
          <view 
            v-for="opt in priorityOptions" 
            :key="opt.value"
            :class="['priority-option', { active: priority === opt.value }]"
            @click="priority = opt.value"
          >
            {{ opt.label }}
          </view>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">截止日期</view>
        <view class="date-row">
          <picker 
            mode="date" 
            :value="dueDate"
            @change="onDueDateChange"
          >
            <view class="form-value">
              <text v-if="dueDate">{{ dueDate }}</text>
              <text v-else class="placeholder">选择日期</text>
              <text class="arrow">▶</text>
            </view>
          </picker>
          <view v-if="dueDate" class="clear-btn" @click="clearDate('dueDate')">
            <text>清除</text>
          </view>
        </view>
        <view v-if="dueDate" class="time-row">
          <view class="form-label" style="margin-bottom: 0;">截止时间</view>
          <picker 
            mode="time" 
            :value="dueTime"
            @change="onDueTimeChange"
          >
            <view class="form-value">
              <text v-if="dueTime">{{ dueTime }}</text>
              <text v-else class="placeholder">选择时间</text>
              <text class="arrow">▶</text>
            </view>
          </picker>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">提醒日期</view>
        <view class="date-row">
          <picker 
            mode="date" 
            :value="remindAt"
            @change="onRemindAtChange"
          >
            <view class="form-value">
              <text v-if="remindAt">{{ remindAt }}</text>
              <text v-else class="placeholder">选择日期</text>
              <text class="arrow">▶</text>
            </view>
          </picker>
          <view v-if="remindAt" class="clear-btn" @click="clearDate('remindAt')">
            <text>清除</text>
          </view>
        </view>
      </view>

      <view class="delete-section" @click="deleteTodo">
        <text class="delete-text">🗑️ 删除任务</text>
      </view>
    </view>

    <view class="submit-section">
      <view class="btn-primary" @click="saveTodo">
        💾 保存修改
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.edit-todo-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
  padding-bottom: 200rpx;
}

.form-section {
  background-color: $white;
  border-radius: 20rpx;
  padding: 24rpx;
}

.form-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  font-size: 28rpx;
  color: $text-color;
  font-weight: 500;
  margin-bottom: 16rpx;
}

.form-input {
  width: 100%;
  font-size: 30rpx;
  color: $text-color;
  padding: 16rpx 0;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  font-size: 30rpx;
  color: $text-color;
  padding: 16rpx 0;
}

.form-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  font-size: 30rpx;
  color: $text-color;
}

.placeholder {
  color: $text-muted;
}

.arrow {
  font-size: 24rpx;
  color: $text-muted;
}

.date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.clear-btn {
  padding: 8rpx 20rpx;
  background-color: $danger-color + '22';
  color: $danger-color;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $border-color;

  .form-value {
    flex: 1;
    padding: 0;
    margin-left: 24rpx;
  }
}

.quadrant-selector {
  .quadrant-preview {
    margin-bottom: 16rpx;
  }

  .category-badge {
    display: inline-block;
    padding: 12rpx 24rpx;
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    border-radius: 20rpx;
    font-size: 26rpx;
    font-weight: 500;
  }
}

.quadrant-options {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.option-row {
  display: flex;
  gap: 12rpx;
}

.option-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 12rpx;
  border-radius: 16rpx;
  background-color: $bg-color;
  border: 2rpx solid transparent;
  transition: all 0.3s;

  &.selected {
    background: linear-gradient(135deg, $primary-color + '22', $secondary-color + '22');
    border-color: $primary-color;
  }
}

.option-icon {
  font-size: 36rpx;
  margin-bottom: 8rpx;
}

.option-text {
  font-size: 22rpx;
  color: $text-color;
}

.priority-options {
  display: flex;
  gap: 16rpx;
}

.priority-option {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 16rpx;
  background-color: $bg-color;
  font-size: 28rpx;
  color: $text-muted;
  border: 2rpx solid transparent;

  &.active {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    border-color: $primary-color;
  }
}

.delete-section {
  padding: 24rpx 0;
  text-align: center;
}

.delete-text {
  font-size: 28rpx;
  color: $danger-color;
}

.submit-section {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx;
  background-color: $white;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}
</style>
