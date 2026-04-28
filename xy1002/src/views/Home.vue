<template>
  <div class="home-page fade-in">
    <!-- Hero Banner -->
    <section class="hero-section">
      <div class="hero-bg">
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-content">
        <div class="hero-logo float">
          <span class="logo-text">星芒</span>
          <span class="logo-sub">STARLIGHT</span>
        </div>
        <h1 class="hero-title">星芒电竞俱乐部</h1>
        <p class="hero-subtitle">STARLIGHT ESPORTS CLUB</p>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-number">5</span>
            <span class="stat-label">年历史</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">12</span>
            <span class="stat-label">冠军</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">500K+</span>
            <span class="stat-label">粉丝</span>
          </div>
        </div>
        <div class="hero-actions">
          <router-link to="/fan-service" class="btn btn-primary btn-large">
            加入粉丝群
          </router-link>
          <router-link to="/shop" class="btn btn-outline btn-large">
            浏览周边
          </router-link>
        </div>
      </div>
    </section>

    <!-- Quick Entry -->
    <section class="quick-entry-section">
      <div class="page-container">
        <div class="quick-entry-grid">
          <router-link to="/news" class="entry-item">
            <div class="entry-icon icon-news">📰</div>
            <span class="entry-text">战队动态</span>
          </router-link>
          <router-link to="/schedule" class="entry-item">
            <div class="entry-icon icon-schedule">⚔️</div>
            <span class="entry-text">赛事赛程</span>
          </router-link>
          <router-link to="/team" class="entry-item">
            <div class="entry-icon icon-team">👥</div>
            <span class="entry-text">战队成员</span>
          </router-link>
          <router-link to="/fan-service" class="entry-item">
            <div class="entry-icon icon-fan">🎁</div>
            <span class="entry-text">粉丝活动</span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Upcoming Match -->
    <section class="upcoming-match-section">
      <div class="page-container">
        <h2 class="section-title">即将开赛</h2>
        <div class="match-card card" v-if="upcomingMatch">
          <div class="match-header">
            <span class="tournament-name">{{ upcomingMatch.tournament }}</span>
            <span class="match-time pulse">{{ upcomingMatch.date }} {{ upcomingMatch.time }}</span>
          </div>
          <div class="match-teams">
            <div class="team our-team">
              <div class="team-logo">
                <span class="logo-initial">星</span>
              </div>
              <span class="team-name">星芒战队</span>
            </div>
            <div class="vs">
              <span class="vs-text">VS</span>
            </div>
            <div class="team opponent-team">
              <img :src="upcomingMatch.opponentLogo" :alt="upcomingMatch.opponent" class="team-logo-img" />
              <span class="team-name">{{ upcomingMatch.opponent }}</span>
            </div>
          </div>
          <div class="match-footer">
            <span class="venue">📍 {{ upcomingMatch.venue }}</span>
            <router-link to="/schedule" class="btn btn-small btn-secondary">查看全部赛程</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Hot News -->
    <section class="news-section">
      <div class="page-container">
        <div class="section-header">
          <h2 class="section-title">热门动态</h2>
          <router-link to="/news" class="view-all">查看全部 →</router-link>
        </div>
        <div class="news-grid">
          <div 
            v-for="news in hotNews" 
            :key="news.id" 
            class="news-card card"
            @click="goToNewsDetail(news.id)"
          >
            <div class="news-image">
              <img :src="news.cover" :alt="news.title" />
              <span class="news-category" :class="news.category === 'match_report' ? 'report' : 'news'">
                {{ news.category === 'match_report' ? '战报' : '新闻' }}
              </span>
            </div>
            <div class="news-info">
              <h3 class="news-title">{{ news.title }}</h3>
              <p class="news-summary">{{ news.summary }}</p>
              <div class="news-meta">
                <span class="publish-date">{{ news.publishDate }}</span>
                <span class="views">👁️ {{ formatNumber(news.views) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Star Players -->
    <section class="players-section">
      <div class="page-container">
        <div class="section-header">
          <h2 class="section-title">明星选手</h2>
          <router-link to="/team" class="view-all">查看全部 →</router-link>
        </div>
        <div class="players-slider">
          <div 
            v-for="player in players" 
            :key="player.id" 
            class="player-card card"
          >
            <div class="player-avatar">
              <img :src="player.avatar" :alt="player.nickname" />
              <div class="player-overlay">
                <span class="position-badge">{{ player.position }}</span>
              </div>
            </div>
            <div class="player-info">
              <h3 class="player-name">{{ player.nickname }}</h3>
              <p class="player-real-name">{{ player.name }}</p>
              <div class="player-tags">
                <span class="tag" v-for="achievement in player.achievements.slice(0, 2)" :key="achievement">
                  {{ achievement }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Hot Products -->
    <section class="products-section">
      <div class="page-container">
        <div class="section-header">
          <h2 class="section-title">热销周边</h2>
          <router-link to="/shop" class="view-all">查看全部 →</router-link>
        </div>
        <div class="products-grid">
          <div 
            v-for="product in hotProducts" 
            :key="product.id" 
            class="product-card card"
            @click="goToProductDetail(product.id)"
          >
            <div class="product-image">
              <img :src="product.image" :alt="product.name" />
              <div class="product-badges">
                <span class="badge badge-hot" v-if="product.sales > 500">热销</span>
                <span class="badge badge-sale" v-if="product.originalPrice">特价</span>
              </div>
            </div>
            <div class="product-info">
              <h3 class="product-name">{{ product.name }}</h3>
              <div class="product-tags">
                <span class="tag" v-for="tag in product.tags.slice(0, 2)" :key="tag">{{ tag }}</span>
              </div>
              <div class="product-price">
                <span class="current-price">¥{{ product.price }}</span>
                <span class="original-price" v-if="product.originalPrice">¥{{ product.originalPrice }}</span>
              </div>
              <div class="product-sales">已售 {{ formatNumber(product.sales) }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Fan Activities -->
    <section class="activities-section">
      <div class="page-container">
        <div class="section-header">
          <h2 class="section-title">粉丝活动</h2>
          <router-link to="/fan-service" class="view-all">查看全部 →</router-link>
        </div>
        <div class="activities-list">
          <div 
            v-for="activity in activities" 
            :key="activity.id" 
            class="activity-card card"
          >
            <div class="activity-image">
              <img :src="activity.cover" :alt="activity.title" />
              <span class="activity-status" :class="activity.status">
                {{ getStatusText(activity.status) }}
              </span>
            </div>
            <div class="activity-info">
              <h3 class="activity-title">{{ activity.title }}</h3>
              <p class="activity-desc">{{ activity.description }}</p>
              <div class="activity-meta">
                <div class="participants">
                  <span class="count">{{ activity.currentParticipants }}</span>
                  <span class="total">/{{ activity.maxParticipants }} 人参与</span>
                </div>
                <div class="time-info">
                  {{ activity.startTime }}
                </div>
              </div>
              <router-link to="/fan-service" class="btn btn-small btn-primary">立即参与</router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="page-footer">
      <div class="footer-content">
        <div class="footer-logo">
          <span class="logo-text">星芒</span>
          <span class="logo-sub">STARLIGHT ESPORTS</span>
        </div>
        <div class="footer-links">
          <router-link to="/">首页</router-link>
          <router-link to="/team">战队</router-link>
          <router-link to="/news">动态</router-link>
          <router-link to="/shop">商城</router-link>
        </div>
        <p class="copyright">© 2024 星芒电竞俱乐部 版权所有</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { mockNews, mockMatches, mockPlayers, mockProducts, mockActivities } from '@/data/mockData'
import type { Match } from '@/types'

const router = useRouter()

const upcomingMatch = computed<Match | undefined>(() => {
  return mockMatches.find(m => m.status === 'upcoming')
})

const hotNews = computed(() => {
  return mockNews.slice(0, 3)
})

const players = computed(() => {
  return mockPlayers
})

const hotProducts = computed(() => {
  return mockProducts.slice(0, 4)
})

const activities = computed(() => {
  return mockActivities
})

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    upcoming: '即将开始',
    ongoing: '进行中',
    ended: '已结束'
  }
  return statusMap[status] || status
}

function goToNewsDetail(id: string) {
  router.push(`/news/${id}`)
}

function goToProductDetail(id: string) {
  router.push(`/shop/${id}`)
}
</script>

<style lang="scss" scoped>
.home-page {
  padding-bottom: 20px;
}

/* Hero Section */
.hero-section {
  position: relative;
  height: 500px;
  overflow: hidden;
  
  @media (max-width: 768px) {
    height: 400px;
  }
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url('https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=esports%20arena%20stage%20lights%20crowd%20atmosphere%20dramatic&image_size=landscape_16_9');
    background-size: cover;
    background-position: center;
    opacity: 0.3;
  }
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  padding: 20px;
}

.hero-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  
  .logo-text {
    font-size: 72px;
    font-weight: 900;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 4px 20px rgba(255, 215, 0, 0.5);
    line-height: 1;
  }
  
  .logo-sub {
    font-size: 16px;
    letter-spacing: 8px;
    opacity: 0.9;
    margin-top: 8px;
  }
}

.hero-title {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
  
  @media (max-width: 768px) {
    font-size: 28px;
  }
}

.hero-subtitle {
  font-size: 14px;
  letter-spacing: 4px;
  opacity: 0.8;
  margin-bottom: 30px;
}

.hero-stats {
  display: flex;
  gap: 40px;
  margin-bottom: 40px;
  
  @media (max-width: 768px) {
    gap: 24px;
  }
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .stat-number {
    font-size: 32px;
    font-weight: 700;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .stat-label {
    font-size: 12px;
    opacity: 0.8;
    margin-top: 4px;
  }
}

.hero-actions {
  display: flex;
  gap: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    width: 100%;
    max-width: 280px;
  }
  
  .btn {
    min-width: 140px;
    
    &.btn-outline {
      border-color: white;
      color: white;
      
      &:hover {
        background: rgba(255,255,255,0.2);
      }
    }
  }
}

/* Quick Entry */
.quick-entry-section {
  margin-top: -40px;
  position: relative;
  z-index: 10;
}

.quick-entry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.entry-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
  text-decoration: none;
  color: var(--text-dark);
  transition: var(--transition);
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--hover-shadow);
    
    .entry-icon {
      transform: scale(1.1);
    }
  }
}

.entry-icon {
  font-size: 32px;
  margin-bottom: 12px;
  transition: var(--transition);
}

.entry-text {
  font-size: 14px;
  font-weight: 500;
}

/* Section Common */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.view-all {
  font-size: 14px;
  color: var(--primary-purple);
  text-decoration: none;
  
  &:hover {
    color: var(--primary-pink);
  }
}

/* Upcoming Match */
.upcoming-match-section {
  margin-top: 40px;
}

.match-card {
  background: linear-gradient(135deg, rgba(255, 105, 180, 0.1) 0%, rgba(155, 89, 182, 0.1) 100%);
  border: 2px solid var(--light-purple);
}

.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--light-purple);
}

.tournament-name {
  font-weight: 600;
  color: var(--primary-purple);
}

.match-time {
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.match-teams {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30px 20px;
  
  @media (max-width: 768px) {
    padding: 20px 10px;
  }
}

.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.team-logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  
  .logo-initial {
    font-size: 36px;
    font-weight: 700;
    color: white;
  }
}

.team-logo-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 12px;
  background: var(--light-purple);
}

.team-name {
  font-size: 16px;
  font-weight: 600;
}

.vs {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  
  .vs-text {
    font-size: 24px;
    font-weight: 900;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.match-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-top: 1px solid var(--light-purple);
}

.venue {
  font-size: 14px;
  color: var(--text-gray);
}

/* News Section */
.news-section {
  margin-top: 40px;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.news-card {
  cursor: pointer;
}

.news-image {
  position: relative;
  height: 180px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
  }
  
  &:hover img {
    transform: scale(1.05);
  }
}

.news-category {
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
  
  &.report {
    background: linear-gradient(135deg, #FF6B6B, #FF8E53);
  }
}

.news-info {
  padding: 16px;
}

.news-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-summary {
  font-size: 14px;
  color: var(--text-gray);
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-light);
}

/* Players Section */
.players-section {
  margin-top: 40px;
}

.players-slider {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  
  &::-webkit-scrollbar {
    height: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--light-purple);
    border-radius: 3px;
  }
  
  @media (max-width: 768px) {
    margin: 0 -16px;
    padding: 0 16px 8px;
  }
}

.player-card {
  min-width: 160px;
  flex-shrink: 0;
}

.player-avatar {
  position: relative;
  height: 200px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.player-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%);
  padding: 20px 12px 12px;
  display: flex;
  justify-content: flex-end;
}

.position-badge {
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.player-info {
  padding: 12px;
}

.player-name {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.player-real-name {
  font-size: 12px;
  color: var(--text-gray);
  margin-bottom: 8px;
}

.player-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  
  .tag {
    font-size: 10px;
    padding: 2px 6px;
    margin: 0;
  }
}

/* Products Section */
.products-section {
  margin-top: 40px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.product-card {
  cursor: pointer;
}

.product-image {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: var(--cream-white);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
  }
  
  &:hover img {
    transform: scale(1.05);
  }
}

.product-badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
  
  .badge {
    font-size: 10px;
    padding: 2px 8px;
  }
}

.product-info {
  padding: 12px;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  
  .tag {
    font-size: 10px;
    padding: 2px 6px;
    margin: 0;
  }
}

.product-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.current-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-pink);
}

.original-price {
  font-size: 12px;
  color: var(--text-light);
  text-decoration: line-through;
}

.product-sales {
  font-size: 12px;
  color: var(--text-gray);
}

/* Activities Section */
.activities-section {
  margin-top: 40px;
}

.activities-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-card {
  display: flex;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.activity-image {
  position: relative;
  width: 280px;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 180px;
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.activity-status {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  
  &.upcoming {
    background: var(--warning);
    color: white;
  }
  
  &.ongoing {
    background: var(--success);
    color: white;
  }
  
  &.ended {
    background: var(--text-gray);
    color: white;
  }
}

.activity-info {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.activity-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.activity-desc {
  font-size: 14px;
  color: var(--text-gray);
  line-height: 1.6;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.activity-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.participants {
  .count {
    font-size: 20px;
    font-weight: 700;
    color: var(--primary-purple);
  }
  
  .total {
    font-size: 12px;
    color: var(--text-gray);
  }
}

.time-info {
  font-size: 12px;
  color: var(--text-gray);
}

/* Footer */
.page-footer {
  margin-top: 60px;
  padding: 40px 20px;
  background: linear-gradient(135deg, #2C3E50, #1a1a2e);
  color: white;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.footer-logo {
  margin-bottom: 20px;
  
  .logo-text {
    font-size: 32px;
    font-weight: 900;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .logo-sub {
    display: block;
    font-size: 12px;
    letter-spacing: 4px;
    opacity: 0.6;
    margin-top: 4px;
  }
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 20px;
  
  a {
    color: rgba(255,255,255,0.7);
    text-decoration: none;
    font-size: 14px;
    
    &:hover {
      color: white;
    }
  }
}

.copyright {
  font-size: 12px;
  opacity: 0.5;
}
</style>
