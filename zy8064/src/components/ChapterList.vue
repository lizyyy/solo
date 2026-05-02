<template>
  <div class="chapter-list">
    <div class="chapter-header">
      <h3>章节列表</h3>
      <span class="chapter-count">{{ chapters.length }} 章</span>
    </div>

    <div class="chapter-items">
      <div
        v-for="chapter in chapters"
        :key="chapter.id"
        class="chapter-item"
        :class="{ active: selectedId === chapter.id, error: chapter.error }"
        @click="$emit('select', chapter.id)"
      >
        <div class="chapter-title">{{ chapter.title || chapter.href }}</div>
        <div v-if="chapter.error" class="chapter-error">{{ chapter.error }}</div>
        <div v-else class="chapter-meta">
          <span v-if="chapter.accessibility?.images?.length">
            🖼 {{ chapter.accessibility.images.length }}
          </span>
          <span v-if="chapter.accessibility?.headings?.length">
            📑 {{ chapter.accessibility.headings.length }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  chapters: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: null
  }
})

defineEmits(['select'])
</script>

<style scoped>
.chapter-list {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
}

.chapter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.chapter-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.chapter-count {
  font-size: 12px;
  color: #888;
}

.chapter-items {
  max-height: 400px;
  overflow-y: auto;
}

.chapter-item {
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}

.chapter-item:hover {
  background: #f9f9f9;
}

.chapter-item.active {
  background: #e3f0ff;
  border-left: 3px solid #4a90d9;
}

.chapter-item.error {
  background: #fff5f5;
}

.chapter-title {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-error {
  font-size: 11px;
  color: #c62828;
  margin-top: 2px;
}

.chapter-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 11px;
  color: #888;
}
</style>
