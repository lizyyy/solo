<template>
  <div class="news-page fade-in page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">战队动态</h1>
      <p class="page-subtitle">了解星芒战队的最新资讯和精彩战报</p>
    </div>

    <!-- 分类筛选 -->
    <div class="category-tabs">
      <div 
        class="tab-item" 
        :class="{ active: activeCategory === 'all' }"
        @click="activeCategory = 'all'"
      >
        全部
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeCategory === 'news' }"
        @click="activeCategory = 'news'"
      >
        新闻资讯
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeCategory === 'match_report' }"
        @click="activeCategory = 'match_report'"
      >
        比赛战报
      </div>
    </div>

    <!-- 新闻列表 -->
    <div class="news-list">
      <div 
        v-for="news in filteredNews" 
        :key="news.id" 
        class="news-item card"
        @click="goToDetail(news.id)"
      >
        <div class="news-image">
          <img :src="news.cover" :alt="news.title" />
          <span class="category-badge" :class="news.category">
            {{ news.category === 'match_report' ? '战报' : '新闻' }}
          </span>
        </div>
        <div class="news-content">
          <h3 class="news-title">{{ news.title }}</h3>
          <p class="news-summary">{{ news.summary }}</p>
          <div class="news-meta">
            <span class="publish-date">📅 {{ news.publishDate }}</span>
            <span class="views">👁️ {{ formatNumber(news.views) }} 阅读</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredNews.length === 0" class="empty-state">
      <span class="empty-icon">📭</span>
      <span class="empty-text">暂无相关内容</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { mockNews } from '@/data/mockData'

const router = useRouter()

const activeCategory = ref<'all' | 'news' | 'match_report'>('all')

const filteredNews = computed(() => {
  if (activeCategory.value === 'all') {
    return mockNews
  }
  return mockNews.filter(n => n.category === activeCategory.value)
})

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

function goToDetail(id: string) {
  router.push(`/news/${id}`)
}
</script>

<style lang="scss" scoped>
.news-page {
  padding-top: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-gray);
}

.category-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  background: white;
  padding: 12px;
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
  
  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
}

.tab-item {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-gray);
  cursor: pointer;
  transition: var(--transition);
  
  &.active {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white;
  }
  
  &:hover:not(.active) {
    background: var(--light-purple);
  }
  
  @media (max-width: 768px) {
    flex: 1;
    min-width: 80px;
    text-align: center;
    padding: 10px 12px;
  }
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.news-item {
  display: flex;
  overflow: hidden;
  cursor: pointer;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
  
  &:hover .news-image img {
    transform: scale(1.05);
  }
}

.news-image {
  position: relative;
  width: 320px;
  flex-shrink: 0;
  overflow: hidden;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 200px;
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
  }
}

.category-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  
  &.news {
    background: linear-gradient(135deg, #4ECDC4, #44A08D);
  }
  
  &.match_report {
    background: linear-gradient(135deg, #FF6B6B, #FF8E53);
  }
}

.news-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.news-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-summary {
  font-size: 14px;
  color: var(--text-gray);
  line-height: 1.6;
  margin-bottom: auto;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-meta {
  display: flex;
  gap: 20px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-light);
}
</style>
