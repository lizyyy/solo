<template>
  <div class="team-page fade-in page-container">
    <!-- 战队概览 -->
    <section class="team-overview">
      <div class="overview-banner">
        <div class="banner-content">
          <div class="team-logo">
            <span class="logo-text">星芒</span>
            <span class="logo-sub">STARLIGHT</span>
          </div>
          <div class="team-info">
            <h1 class="team-name">星芒电竞俱乐部</h1>
            <p class="team-slogan">星光闪耀，梦想绽放 ✨</p>
            <div class="team-stats">
              <div class="stat-item">
                <span class="stat-value">5</span>
                <span class="stat-label">年历史</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">12</span>
                <span class="stat-label">冠军</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">5</span>
                <span class="stat-label">首发选手</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'players' }"
        @click="activeTab = 'players'"
      >
        成员阵容
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'honors' }"
        @click="activeTab = 'honors'"
      >
        战队荣誉
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        战队历史
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'culture' }"
        @click="activeTab = 'culture'"
      >
        战队文化
      </div>
    </div>

    <!-- 成员阵容 -->
    <section v-if="activeTab === 'players'" class="players-section">
      <h2 class="section-title">首发阵容</h2>
      <div class="players-grid">
        <div 
          v-for="player in players" 
          :key="player.id" 
          class="player-card card"
          @click="showPlayerDetail(player)"
        >
          <div class="player-avatar">
            <img :src="player.avatar" :alt="player.nickname" />
            <div class="position-badge">{{ player.position }}</div>
            <div class="favorite-btn" @click.stop="toggleFavorite(player.id)">
              <span class="heart" :class="{ liked: isFavoritePlayer(player.id) }">
                {{ isFavoritePlayer(player.id) ? '❤️' : '🤍' }}
              </span>
            </div>
          </div>
          <div class="player-info">
            <h3 class="player-nickname">{{ player.nickname }}</h3>
            <p class="player-name">{{ player.name }}</p>
            <div class="player-meta">
              <span class="game">{{ player.game }}</span>
              <span class="join-date">入队 {{ player.joinDate }}</span>
            </div>
            <div class="player-achievements">
              <span class="achievement-tag" v-for="ach in player.achievements.slice(0, 2)" :key="ach">
                🏆 {{ ach }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 战队荣誉 -->
    <section v-if="activeTab === 'honors'" class="honors-section">
      <h2 class="section-title">荣誉殿堂</h2>
      <div class="honors-timeline">
        <div 
          v-for="(honor, index) in honors" 
          :key="honor.id" 
          class="honor-item"
          :class="{ even: index % 2 === 1 }"
        >
          <div class="timeline-dot"></div>
          <div class="honor-card card">
            <div class="honor-icon">{{ honor.icon }}</div>
            <div class="honor-content">
              <h3 class="honor-title">{{ honor.title }}</h3>
              <p class="honor-tournament">{{ honor.tournament }}</p>
              <span class="honor-date">{{ honor.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 战队历史 -->
    <section v-if="activeTab === 'history'" class="history-section">
      <h2 class="section-title">发展历程</h2>
      <div class="history-timeline">
        <div 
          v-for="item in history" 
          :key="item.id" 
          class="history-item"
        >
          <div class="year-badge">{{ item.year }}</div>
          <div class="history-card card">
            <div class="history-image">
              <img :src="item.image" :alt="item.title" />
            </div>
            <div class="history-content">
              <h3 class="history-title">{{ item.title }}</h3>
              <p class="history-desc">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 战队文化 -->
    <section v-if="activeTab === 'culture'" class="culture-section">
      <h2 class="section-title">战队文化</h2>
      <div class="culture-grid">
        <div class="culture-card card">
          <div class="culture-icon">🎯</div>
          <h3 class="culture-title">我们的愿景</h3>
          <p class="culture-desc">
            成为全球最具影响力的电竞俱乐部，为电子竞技产业的发展贡献力量，让更多人看到电竞的魅力与价值。
          </p>
        </div>
        <div class="culture-card card">
          <div class="culture-icon">💪</div>
          <h3 class="culture-title">核心价值观</h3>
          <div class="value-list">
            <div class="value-item">
              <span class="value-icon">⭐</span>
              <span class="value-text">追求卓越</span>
            </div>
            <div class="value-item">
              <span class="value-icon">🤝</span>
              <span class="value-text">团队协作</span>
            </div>
            <div class="value-item">
              <span class="value-icon">💖</span>
              <span class="value-text">感恩粉丝</span>
            </div>
            <div class="value-item">
              <span class="value-icon">🔥</span>
              <span class="value-text">永不言弃</span>
            </div>
          </div>
        </div>
        <div class="culture-card card">
          <div class="culture-icon">🏠</div>
          <h3 class="culture-title">训练环境</h3>
          <p class="culture-desc">
            我们为选手提供最专业的训练环境，包括先进的设备、专业的教练团队、心理辅导师以及营养师。让选手能够专注于训练，发挥最佳状态。
          </p>
        </div>
        <div class="culture-card card">
          <div class="culture-icon">🌟</div>
          <h3 class="culture-title">青训体系</h3>
          <p class="culture-desc">
            我们拥有完善的青训体系，致力于发掘和培养年轻选手。通过科学的训练方法和丰富的比赛经验，帮助新人快速成长，为战队输送新鲜血液。
          </p>
        </div>
      </div>
    </section>

    <!-- 选手详情弹窗 -->
    <div v-if="selectedPlayer" class="modal-overlay" @click="closePlayerDetail">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="closePlayerDetail">✕</button>
        <div class="player-detail-header">
          <img :src="selectedPlayer.avatar" :alt="selectedPlayer.nickname" class="detail-avatar" />
          <div class="detail-info">
            <h2 class="detail-nickname">{{ selectedPlayer.nickname }}</h2>
            <p class="detail-name">{{ selectedPlayer.name }}</p>
            <div class="detail-tags">
              <span class="tag">{{ selectedPlayer.position }}</span>
              <span class="tag">{{ selectedPlayer.game }}</span>
            </div>
          </div>
        </div>
        <div class="player-detail-body">
          <div class="detail-section">
            <h4 class="detail-section-title">个人简介</h4>
            <p class="detail-desc">{{ selectedPlayer.description }}</p>
          </div>
          <div class="detail-section">
            <h4 class="detail-section-title">主要成就</h4>
            <div class="achievements-list">
              <div v-for="ach in selectedPlayer.achievements" :key="ach" class="achievement-item">
                <span class="achievement-icon">🏆</span>
                <span class="achievement-text">{{ ach }}</span>
              </div>
            </div>
          </div>
          <div class="detail-section">
            <h4 class="detail-section-title">入队时间</h4>
            <p class="detail-date">{{ selectedPlayer.joinDate }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button 
            class="btn btn-primary" 
            @click="toggleFavorite(selectedPlayer.id)"
          >
            {{ isFavoritePlayer(selectedPlayer.id) ? '❤️ 已收藏' : '🤍 收藏选手' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { mockPlayers, mockHonors, mockHistory } from '@/data/mockData'
import { useUserStore } from '@/store/userStore'
import type { Player } from '@/types'

const userStore = useUserStore()

const activeTab = ref<'players' | 'honors' | 'history' | 'culture'>('players')
const selectedPlayer = ref<Player | null>(null)

const players = computed(() => mockPlayers)
const honors = computed(() => mockHonors)
const history = computed(() => mockHistory)

function showPlayerDetail(player: Player) {
  selectedPlayer.value = player
}

function closePlayerDetail() {
  selectedPlayer.value = null
}

function isFavoritePlayer(playerId: string): boolean {
  return userStore.user.favoritePlayers.includes(playerId)
}

function toggleFavorite(playerId: string) {
  userStore.toggleFavoritePlayer(playerId)
}
</script>

<style lang="scss" scoped>
.team-page {
  padding-top: 20px;
}

/* 战队概览 */
.team-overview {
  margin: -20px -20px 30px -20px;
}

.overview-banner {
  background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
  padding: 40px 20px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url('https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=esports%20arena%20lights%20bokeh%20effect%20colorful%20atmosphere&image_size=landscape_16_9');
    background-size: cover;
    background-position: center;
    opacity: 0.2;
  }
}

.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
  }
}

.team-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  backdrop-filter: blur(10px);
  
  .logo-text {
    font-size: 40px;
    font-weight: 900;
    color: white;
    line-height: 1;
  }
  
  .logo-sub {
    font-size: 10px;
    color: rgba(255,255,255,0.8);
    letter-spacing: 2px;
    margin-top: 4px;
  }
}

.team-info {
  color: white;
}

.team-name {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.team-slogan {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 20px;
}

.team-stats {
  display: flex;
  gap: 30px;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 28px;
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

/* Tab 导航 */
.tab-nav {
  display: flex;
  background: white;
  border-radius: var(--border-radius);
  padding: 8px;
  margin-bottom: 30px;
  box-shadow: var(--card-shadow);
}

.tab-item {
  flex: 1;
  padding: 12px 16px;
  text-align: center;
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
    padding: 10px 8px;
    font-size: 12px;
  }
}

/* 成员阵容 */
.players-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  
  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.player-card {
  cursor: pointer;
  overflow: hidden;
  
  &:hover .player-avatar img {
    transform: scale(1.05);
  }
}

.player-avatar {
  position: relative;
  height: 220px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
  }
}

.position-badge {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

.favorite-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    transform: scale(1.1);
  }
  
  .heart {
    font-size: 18px;
  }
}

.player-info {
  padding: 16px;
}

.player-nickname {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.player-name {
  font-size: 13px;
  color: var(--text-gray);
  margin-bottom: 12px;
}

.player-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-gray);
}

.player-achievements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.achievement-tag {
  font-size: 11px;
  color: var(--primary-purple);
  background: var(--light-purple);
  padding: 4px 8px;
  border-radius: 4px;
}

/* 战队荣誉 */
.honors-timeline {
  position: relative;
  padding-left: 40px;
  
  &::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--gradient-start), var(--gradient-end));
    border-radius: 2px;
  }
  
  @media (max-width: 768px) {
    padding-left: 30px;
    
    &::before {
      left: 10px;
    }
  }
}

.honor-item {
  position: relative;
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.timeline-dot {
  position: absolute;
  left: -34px;
  top: 20px;
  width: 16px;
  height: 16px;
  background: var(--primary-purple);
  border-radius: 50%;
  border: 4px solid var(--light-purple);
  
  @media (max-width: 768px) {
    left: -24px;
    width: 12px;
    height: 12px;
  }
}

.honor-card {
  display: flex;
  align-items: center;
  padding: 20px;
  gap: 20px;
}

.honor-icon {
  font-size: 48px;
}

.honor-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.honor-tournament {
  font-size: 14px;
  color: var(--text-gray);
  margin-bottom: 8px;
}

.honor-date {
  font-size: 12px;
  color: var(--text-light);
}

/* 战队历史 */
.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.history-item {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.year-badge {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: white;
  
  @media (max-width: 768px) {
    width: 60px;
    height: 60px;
    font-size: 18px;
  }
}

.history-card {
  flex: 1;
  display: flex;
  overflow: hidden;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.history-image {
  width: 280px;
  flex-shrink: 0;
  overflow: hidden;
  
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

.history-content {
  padding: 20px;
}

.history-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.history-desc {
  font-size: 14px;
  color: var(--text-gray);
  line-height: 1.8;
}

/* 战队文化 */
.culture-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.culture-card {
  padding: 24px;
}

.culture-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.culture-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.culture-desc {
  font-size: 14px;
  color: var(--text-gray);
  line-height: 1.8;
}

.value-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.value-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.value-icon {
  font-size: 20px;
}

.value-text {
  font-size: 14px;
  font-weight: 500;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: var(--border-radius);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: var(--light-purple);
  border: none;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  
  &:hover {
    background: var(--primary-purple);
    color: white;
  }
}

.player-detail-header {
  display: flex;
  gap: 20px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(255, 105, 180, 0.1), rgba(155, 89, 182, 0.1));
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}

.detail-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--light-purple);
}

.detail-nickname {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.detail-name {
  font-size: 14px;
  color: var(--text-gray);
  margin-bottom: 12px;
}

.detail-tags {
  display: flex;
  gap: 8px;
}

.player-detail-body {
  padding: 24px;
}

.detail-section {
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-gray);
  margin-bottom: 8px;
}

.detail-desc {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-dark);
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--light-purple);
  border-radius: 8px;
}

.achievement-icon {
  font-size: 16px;
}

.achievement-text {
  font-size: 14px;
}

.detail-date {
  font-size: 14px;
  color: var(--text-dark);
}

.modal-footer {
  padding: 16px 24px 24px;
  
  .btn {
    width: 100%;
  }
}
</style>
