<template>
  <div class="news-detail-page fade-in page-container">
    <!-- 返回按钮 -->
    <div class="back-bar" @click="goBack">
      <span class="back-icon">←</span>
      <span class="back-text">返回</span>
    </div>

    <!-- 加载中 -->
    <div v-if="!news" class="loading">
      <span>加载中...</span>
    </div>

    <!-- 新闻内容 -->
    <template v-else>
      <!-- 文章头部 -->
      <article class="news-article">
        <header class="article-header">
          <span class="category-tag" :class="news.category">
            {{ news.category === 'match_report' ? '战报' : '新闻' }}
          </span>
          <h1 class="article-title">{{ news.title }}</h1>
          <div class="article-meta">
            <span class="publish-date">📅 {{ news.publishDate }}</span>
            <span class="views">👁️ {{ formatNumber(news.views) }} 阅读</span>
          </div>
        </header>

        <!-- 封面图 -->
        <div class="article-cover">
          <img :src="news.cover" :alt="news.title" />
        </div>

        <!-- 文章内容 -->
        <div class="article-content">
          <div class="content-text">
            <p v-for="(paragraph, index) in paragraphs" :key="index" class="paragraph">
              {{ paragraph }}
            </p>
          </div>
        </div>

        <!-- 分享区域 -->
        <div class="share-section">
          <h3 class="share-title">分享这篇文章</h3>
          <div class="share-buttons">
            <button class="share-btn wechat">
              <span class="share-icon">💬</span>
              <span>微信</span>
            </button>
            <button class="share-btn weibo">
              <span class="share-icon">📢</span>
              <span>微博</span>
            </button>
            <button class="share-btn qq">
              <span class="share-icon">🐧</span>
              <span>QQ</span>
            </button>
            <button class="share-btn copy" @click="copyLink">
              <span class="share-icon">🔗</span>
              <span>复制链接</span>
            </button>
          </div>
        </div>
      </article>

      <!-- 相关推荐 -->
      <section class="related-section">
        <h2 class="section-title">相关推荐</h2>
        <div class="related-list">
          <div 
            v-for="item in relatedNews" 
            :key="item.id" 
            class="related-item card"
            @click="goToDetail(item.id)"
          >
            <div class="related-image">
              <img :src="item.cover" :alt="item.title" />
            </div>
            <div class="related-info">
              <h3 class="related-title">{{ item.title }}</h3>
              <span class="related-date">{{ item.publishDate }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { mockNews } from '@/data/mockData'
import type { NewsItem } from '@/types'

const router = useRouter()
const route = useRoute()

const news = ref<NewsItem | null>(null)

onMounted(() => {
  const id = route.params.id as string
  news.value = mockNews.find(n => n.id === id) || null
})

const paragraphs = computed(() => {
  if (!news.value) return []
  return news.value.content.split('\n\n').filter(p => p.trim())
})

const relatedNews = computed(() => {
  if (!news.value) return []
  return mockNews.filter(n => n.id !== news.value!.id).slice(0, 3)
})

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

function goBack() {
  router.back()
}

function goToDetail(id: string) {
  router.push(`/news/${id}`)
}

function copyLink() {
  const url = window.location.href
  navigator.clipboard.writeText(url).then(() => {
    alert('链接已复制到剪贴板！')
  }).catch(() => {
    alert('复制失败，请手动复制')
  })
}
</script>

<style lang="scss" scoped>
.news-detail-page {
  padding-top: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.back-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  cursor: pointer;
  color: var(--text-gray);
  font-size: 14px;
  transition: var(--transition);
  
  &:hover {
    color: var(--primary-purple);
  }
}

.back-icon {
  font-size: 18px;
}

/* 文章内容 */
.news-article {
  background: white;
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.article-header {
  padding: 24px;
  
  @media (max-width: 768px) {
    padding: 16px;
  }
}

.category-tag {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  margin-bottom: 16px;
  
  &.news {
    background: linear-gradient(135deg, #4ECDC4, #44A08D);
  }
  
  &.match_report {
    background: linear-gradient(135deg, #FF6B6B, #FF8E53);
  }
}

.article-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    font-size: 20px;
  }
}

.article-meta {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--text-gray);
}

.article-cover {
  width: 100%;
  height: 400px;
  
  @media (max-width: 768px) {
    height: 250px;
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.article-content {
  padding: 24px;
  
  @media (max-width: 768px) {
    padding: 16px;
  }
}

.content-text {
  .paragraph {
    font-size: 16px;
    line-height: 2;
    color: var(--text-dark);
    margin-bottom: 20px;
    text-indent: 2em;
  }
}

/* 分享区域 */
.share-section {
  padding: 24px;
  border-top: 1px solid var(--light-purple);
  
  @media (max-width: 768px) {
    padding: 16px;
  }
}

.share-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-dark);
}

.share-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &.wechat {
    background: #07C160;
    color: white;
  }
  
  &.weibo {
    background: #E6162D;
    color: white;
  }
  
  &.qq {
    background: #12B7F5;
    color: white;
  }
  
  &.copy {
    background: var(--light-purple);
    color: var(--primary-purple);
  }
}

.share-icon {
  font-size: 18px;
}

/* 相关推荐 */
.related-section {
  margin-top: 30px;
}

.related-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.related-item {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  
  &:hover .related-image img {
    transform: scale(1.05);
  }
}

.related-image {
  height: 120px;
  overflow: hidden;
  
  @media (max-width: 768px) {
    height: 150px;
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
  }
}

.related-info {
  padding: 12px;
}

.related-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.related-date {
  font-size: 12px;
  color: var(--text-gray);
}
</style>
