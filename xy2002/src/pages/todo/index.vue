<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useTodoStore } from '@/stores/todo';
import { useProfileStore } from '@/stores/profile';
import type { Todo, TodoCategory } from '@/types';

const todoStore = useTodoStore();
const profileStore = useProfileStore();

type ViewType = 'quadrant' | 'list' | 'completed';

const currentView = ref<ViewType>('quadrant');
const selectedTodo = ref<Todo | null>(null);
const showActionSheet = ref(false);

const categories: TodoCategory[] = [
  'important-urgent',
  'important-not-urgent',
  'not-important-urgent',
  'not-important-not-urgent'
];

const categoryIcons: Record<TodoCategory, string> = {
  'important-urgent': '🔥',
  'important-not-urgent': '⭐',
  'not-important-urgent': '⏰',
  'not-important-not-urgent': '📝'
};

const activeTodosByCategory = computed(() => todoStore.todosByCategory);

const completedTodosList = computed(() => 
  [...todoStore.completedTodos].sort((a, b) => {
    if (a.completedAt && b.completedAt) {
      return b.completedAt - a.completedAt;
    }
    return 0;
  })
);

const overdueCount = computed(() => todoStore.overdueTodos.length);
const todayCount = computed(() => todoStore.todayTodos.length);
const completedCount = computed(() => todoStore.completedTodos.length);
const totalCount = computed(() => todoStore.todos.length);

function setView(view: ViewType) {
  currentView.value = view;
}

function addTodo() {
  uni.navigateTo({
    url: '/pages/todo/add'
  });
}

function editTodo(todo: Todo) {
  uni.navigateTo({
    url: `/pages/todo/edit?id=${todo.id}`
  });
}

function toggleTodoComplete(todo: Todo) {
  if (todo.isCompleted) {
    todoStore.uncompleteTodo(todo.id);
  } else {
    todoStore.completeTodo(todo.id);
    profileStore.addCompletedTodo();
  }
}

function deleteTodo(todo: Todo) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除任务"${todo.title}"吗？`,
    success: (res) => {
      if (res.confirm) {
        todoStore.deleteTodo(todo.id);
        uni.showToast({
          title: '删除成功',
          icon: 'success'
        });
      }
    }
  });
}

function showTodoActions(todo: Todo) {
  selectedTodo.value = todo;
  uni.showActionSheet({
    itemList: ['编辑', '删除', todo.isCompleted ? '标记为未完成' : '标记为完成'],
    success: (res) => {
      if (!selectedTodo.value) return;
      switch (res.tapIndex) {
        case 0:
          editTodo(selectedTodo.value);
          break;
        case 1:
          deleteTodo(selectedTodo.value);
          break;
        case 2:
          toggleTodoComplete(selectedTodo.value);
          break;
      }
    }
  });
}

function getCategoryTodos(category: TodoCategory): Todo[] {
  return activeTodosByCategory.value[category] || [];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const compareDate = new Date(dateStr);
  compareDate.setHours(0, 0, 0, 0);
  
  if (compareDate.getTime() === today.getTime()) return '今天';
  if (compareDate.getTime() === tomorrow.getTime()) return '明天';
  if (compareDate.getTime() < today.getTime()) return '已过期';
  
  const month = compareDate.getMonth() + 1;
  const day = compareDate.getDate();
  return `${month}月${day}日`;
}

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return todo.dueDate < today && !todo.isCompleted;
}

onMounted(() => {
  todoStore.loadTodos();
});

onShow(() => {
  todoStore.loadTodos();
});
</script>

<template>
  <view class="todo-page">
    <view class="kitty-header">
      <view class="kitty-ears">
        <view class="kitty-ear left-ear"></view>
        <view class="kitty-ear right-ear"></view>
        <view class="kitty-bow">🎀</view>
      </view>
      <view class="kitty-title">
        <text class="kitty-icon">🐱</text>
        <text>我的待办</text>
      </view>
      <view class="kitty-whiskers">
        <view class="whisker whisker-left-top"></view>
        <view class="whisker whisker-left-bottom"></view>
        <view class="whisker whisker-right-top"></view>
        <view class="whisker whisker-right-bottom"></view>
      </view>
    </view>
    
    <view class="stats-section card">
      <view class="stat-item">
        <view class="stat-num">{{ totalCount }}</view>
        <view class="stat-label">全部任务</view>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <view class="stat-num">{{ todayCount }}</view>
        <view class="stat-label">今日待办</view>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <view class="stat-num">{{ completedCount }}</view>
        <view class="stat-label">已完成</view>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <view class="stat-num overdue">{{ overdueCount }}</view>
        <view class="stat-label">已过期</view>
      </view>
    </view>

    <view class="view-tabs">
      <view 
        :class="['tab-item', { active: currentView === 'quadrant' }]"
        @click="setView('quadrant')"
      >
        🎯 四象限
      </view>
      <view 
        :class="['tab-item', { active: currentView === 'list' }]"
        @click="setView('list')"
      >
        📋 列表
      </view>
      <view 
        :class="['tab-item', { active: currentView === 'completed' }]"
        @click="setView('completed')"
      >
        ✅ 已完成
      </view>
    </view>

    <view v-if="currentView === 'quadrant'" class="quadrant-container">
      <view class="quadrant-grid">
        <view 
          v-for="category in categories" 
          :key="category"
          class="quadrant-item"
          :style="{ backgroundColor: todoStore.categoryColors[category] + '33' }"
        >
          <view class="quadrant-header">
            <text class="quadrant-icon">{{ categoryIcons[category] }}</text>
            <text class="quadrant-title">{{ todoStore.categoryNames[category] }}</text>
            <text class="quadrant-count">({{ getCategoryTodos(category).length }})</text>
          </view>
          
          <scroll-view scroll-y class="quadrant-list">
            <view v-if="getCategoryTodos(category).length === 0" class="quadrant-empty">
              <text>暂无任务</text>
            </view>
            <view 
              v-for="todo in getCategoryTodos(category)" 
              :key="todo.id"
              class="todo-mini-item"
              :class="{ 'is-overdue': isOverdue(todo) }"
              @click="showTodoActions(todo)"
            >
              <view 
                class="todo-checkbox"
                :class="{ checked: todo.isCompleted }"
                @click.stop="toggleTodoComplete(todo)"
              >
                <text v-if="todo.isCompleted">✓</text>
              </view>
              <view class="todo-mini-content">
                <view class="todo-mini-title" :class="{ completed: todo.isCompleted }">
                  {{ todo.title }}
                </view>
                <view v-if="todo.dueDate" class="todo-mini-date">
                  📅 {{ formatDate(todo.dueDate) }}
                  <text v-if="todo.dueTime"> {{ todo.dueTime }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>

    <view v-if="currentView === 'list'" class="list-container">
      <view v-if="todoStore.activeTodos.length === 0" class="empty-state">
        <text class="kitty-icon">🎀</text>
        <text>暂无待办任务</text>
        <text class="empty-hint">点击右下角按钮添加新任务</text>
      </view>
      <view v-else class="todo-list">
        <view 
          v-for="todo in todoStore.activeTodos" 
          :key="todo.id"
          class="todo-item card"
          :class="{ 'is-overdue': isOverdue(todo) }"
        >
          <view class="todo-main">
            <view 
              class="todo-checkbox"
              :class="{ checked: todo.isCompleted }"
              @click="toggleTodoComplete(todo)"
            >
              <text v-if="todo.isCompleted">✓</text>
            </view>
            <view class="todo-content" @click="showTodoActions(todo)">
              <view class="todo-title" :class="{ completed: todo.isCompleted }">
                {{ todo.title }}
              </view>
              <view v-if="todo.description" class="todo-desc">
                {{ todo.description }}
              </view>
              <view class="todo-meta">
                <view 
                  class="meta-tag"
                  :style="{ backgroundColor: todoStore.categoryColors[todo.category] + '33', color: todoStore.categoryColors[todo.category] }"
                >
                  {{ categoryIcons[todo.category] }} {{ todoStore.categoryNames[todo.category] }}
                </view>
                <view v-if="todo.dueDate" class="meta-date">
                  📅 {{ formatDate(todo.dueDate) }}
                  <text v-if="todo.dueTime"> {{ todo.dueTime }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="todo-actions">
            <view class="action-btn edit" @click="editTodo(todo)">编辑</view>
            <view class="action-btn delete" @click="deleteTodo(todo)">删除</view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="currentView === 'completed'" class="completed-container">
      <view v-if="completedTodosList.length === 0" class="empty-state">
        <text class="kitty-icon">✨</text>
        <text>暂无已完成任务</text>
      </view>
      <view v-else class="completed-list">
        <view 
          v-for="todo in completedTodosList" 
          :key="todo.id"
          class="completed-item card"
          @click="showTodoActions(todo)"
        >
          <view class="todo-main">
            <view class="todo-checkbox checked">
              <text>✓</text>
            </view>
            <view class="todo-content">
              <view class="todo-title completed">
                {{ todo.title }}
              </view>
              <view v-if="todo.completedAt" class="completed-time">
                完成于: {{ new Date(todo.completedAt).toLocaleString('zh-CN') }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="add-btn" @click="addTodo">
      <text class="add-icon">+</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.todo-page {
  min-height: 100vh;
  background-color: $bg-color;
  padding: 24rpx;
  padding-bottom: 120rpx;
}

.kitty-header {
  position: relative;
  padding: 24rpx;
  padding-top: 40rpx;
  text-align: center;
  margin-bottom: 16rpx;
}

.kitty-ears {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 240rpx;
  height: 60rpx;
}

.kitty-ear {
  position: absolute;
  width: 60rpx;
  height: 60rpx;
  background-color: $secondary-color;
  border-radius: 50%;

  &.left-ear {
    left: 20rpx;
    top: 10rpx;
  }

  &.right-ear {
    right: 20rpx;
    top: 10rpx;
  }
}

.kitty-bow {
  position: absolute;
  top: 20rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 48rpx;
  z-index: 2;
}

.kitty-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding-top: 20rpx;
  margin-top: 20rpx;
}

.kitty-title .kitty-icon {
  font-size: 48rpx;
}

.kitty-title text:not(.kitty-icon) {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary-color;
}

.kitty-whiskers {
  position: absolute;
  top: 70rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 600rpx;
  pointer-events: none;
}

.whisker {
  position: absolute;
  width: 60rpx;
  height: 3rpx;
  background-color: $text-color;

  &.whisker-left-top {
    left: 40rpx;
    top: 0;
    transform: rotate(-15deg);
  }

  &.whisker-left-bottom {
    left: 30rpx;
    top: 20rpx;
    transform: rotate(15deg);
  }

  &.whisker-right-top {
    right: 40rpx;
    top: 0;
    transform: rotate(15deg);
  }

  &.whisker-right-bottom {
    right: 30rpx;
    top: 20rpx;
    transform: rotate(-15deg);
  }
}

.stats-section {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 700;
  color: $primary-color;
  margin-bottom: 8rpx;

  &.overdue {
    color: $danger-color;
  }
}

.stat-label {
  font-size: 24rpx;
  color: $text-muted;
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background-color: $border-color;
}

.view-tabs {
  display: flex;
  background-color: $white;
  border-radius: 20rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $text-muted;
  transition: all 0.3s;

  &.active {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    color: $white;
    font-weight: 500;
  }
}

.quadrant-container {
  margin-bottom: 24rpx;
}

.quadrant-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.quadrant-item {
  border-radius: 20rpx;
  padding: 20rpx;
  min-height: 300rpx;
  display: flex;
  flex-direction: column;
}

.quadrant-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
  flex-wrap: wrap;
}

.quadrant-icon {
  font-size: 32rpx;
}

.quadrant-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-color;
}

.quadrant-count {
  font-size: 24rpx;
  color: $text-muted;
}

.quadrant-list {
  flex: 1;
  max-height: 220rpx;
}

.quadrant-empty {
  text-align: center;
  padding: 20rpx 0;
  font-size: 24rpx;
  color: $text-muted;
}

.todo-mini-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 12rpx 8rpx;
  background-color: $white;
  border-radius: 12rpx;
  margin-bottom: 8rpx;

  &.is-overdue {
    border-left: 4rpx solid $danger-color;
  }
}

.todo-mini-content {
  flex: 1;
  min-width: 0;
}

.todo-mini-title {
  font-size: 26rpx;
  color: $text-color;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.completed {
    text-decoration: line-through;
    color: $text-muted;
  }
}

.todo-mini-date {
  font-size: 20rpx;
  color: $text-muted;
  margin-top: 4rpx;
}

.list-container,
.completed-container {
  margin-bottom: 24rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  color: $text-muted;
  gap: 16rpx;
}

.kitty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-hint {
  font-size: 24rpx;
}

.todo-list,
.completed-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.todo-item {
  &.is-overdue {
    border-left: 6rpx solid $danger-color;
  }
}

.todo-main {
  display: flex;
  gap: 16rpx;
}

.todo-checkbox {
  width: 44rpx;
  height: 44rpx;
  border: 3rpx solid $border-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;

  &.checked {
    background: linear-gradient(135deg, $primary-color, $secondary-color);
    border-color: $primary-color;

    text {
      color: $white;
      font-size: 24rpx;
    }
  }
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 8rpx;

  &.completed {
    text-decoration: line-through;
    color: $text-muted;
  }
}

.todo-desc {
  font-size: 26rpx;
  color: $text-muted;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.todo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
}

.meta-tag {
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
}

.meta-date {
  font-size: 22rpx;
  color: $text-muted;
}

.todo-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $border-color;
}

.action-btn {
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
  font-size: 24rpx;

  &.edit {
    background-color: $primary-color + '22';
    color: $primary-color;
  }

  &.delete {
    background-color: $danger-color + '22';
    color: $danger-color;
  }
}

.completed-item {
  .todo-title {
    text-decoration: line-through;
    color: $text-muted;
  }
}

.completed-time {
  font-size: 22rpx;
  color: $text-muted;
  margin-top: 8rpx;
}

.add-btn {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 105, 180, 0.3);
}

.add-icon {
  font-size: 48rpx;
  color: $white;
  font-weight: 300;
}
</style>
