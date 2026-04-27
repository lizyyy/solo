<template>
  <div class="schedule-page fade-in page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">赛事赛程</h1>
      <p class="page-subtitle">关注星芒战队的每一场比赛</p>
    </div>

    <!-- 分类标签 -->
    <div class="category-tabs">
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        全部赛程
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'upcoming' }"
        @click="activeTab = 'upcoming'"
      >
        即将开始
        <span class="tab-badge" v-if="upcomingCount > 0">{{ upcomingCount }}</span>
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'finished' }"
        @click="activeTab = 'finished'"
      >
        已结束
      </div>
    </div>

    <!-- 即将开始的比赛 -->
    <section v-if="activeTab === 'all' || activeTab === 'upcoming'" class="upcoming-section">
      <h2 class="section-title">即将开始</h2>
      <div v-if="filteredUpcoming.length > 0" class="match-list">
        <div 
          v-for="match in filteredUpcoming" 
          :key="match.id" 
          class="match-card upcoming-card card"
        >
          <div class="match-header">
            <span class="tournament">{{ match.tournament }}</span>
            <span class="match-time pulse">⏰ {{ match.date }} {{ match.time }}</span>
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
              <img :src="match.opponentLogo" :alt="match.opponent" class="team-logo-img" />
              <span class="team-name">{{ match.opponent }}</span>
            </div>
          </div>
          <div class="match-footer">
            <span class="venue">📍 {{ match.venue }}</span>
            <button class="btn btn-small btn-primary" @click="setReminder(match)">预约提醒</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <span class="empty-icon">📅</span>
        <span class="empty-text">暂无即将开始的比赛</span>
      </div>
    </section>

    <!-- 已结束的比赛 -->
    <section v-if="activeTab === 'all' || activeTab === 'finished'" class="finished-section">
      <h2 class="section-title">已结束</h2>
      
      <!-- 时间轴视图 -->
      <div class="timeline-container">
        <div 
          v-for="(group, dateKey) in groupedMatches" 
          :key="dateKey" 
          class="timeline-group"
        >
          <div class="timeline-date">{{ dateKey }}</div>
          <div class="timeline-items">
            <div 
              v-for="match in group" 
              :key="match.id" 
              class="timeline-item card"
            >
              <div class="timeline-dot"></div>
              <div class="match-content">
                <div class="match-info-header">
                  <span class="tournament">{{ match.tournament }}</span>
                  <span class="match-time">{{ match.time }}</span>
                </div>
                <div class="match-result">
                  <div class="team-info">
                    <div class="team-logo-small">
                      <span class="logo-initial">星</span>
                    </div>
                    <span class="team-name">星芒战队</span>
                  </div>
                  <div class="score-display" :class="match.result">
                    <span class="our-score">{{ match.score?.our }}</span>
                    <span class="score-separator">:</span>
                    <span class="opponent-score">{{ match.score?.opponent }}</span>
                  </div>
                  <div class="team-info">
                    <img :src="match.opponentLogo" :alt="match.opponent" class="team-logo-img-small" />
                    <span class="team-name">{{ match.opponent }}</span>
                  </div>
                </div>
                <div class="result-badge" :class="match.result">
                  {{ match.result === 'win' ? '胜利' : match.result === 'lose' ? '失败' : '平局' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredFinished.length === 0" class="empty-state">
        <span class="empty-icon">🏆</span>
        <span class="empty-text">暂无已结束的比赛</span>
      </div>
    </section>

    <!-- 战绩统计 -->
    <section class="stats-section">
      <h2 class="section-title">战绩统计</h2>
      <div class="stats-card card">
        <div class="stats-grid">
          <div class="stat-item">
          <span class="stat-value win-count">{{ winCount }}</span>
          <span class="stat-label">胜场</span>
        </div>
        <div class="stat-item">
          <span class="stat-value lose-count">{{ loseCount }}</span>
          <span class="stat-label">负场</span>
        </div>
        <div class="stat-item">
          <span class="stat-value total-count">{{ totalCount }}</span>
          <span class="stat-label">总场次</span>
        </div>
        <div class="stat-item">
          <span class="stat-value rate">{{ winRate }}%</span>
          <span class="stat-label">胜率</span>
        </div>
      </div>
        <div class="win-rate-bar">
          <div class="rate-fill" :style="{ width: winRate + '%' }"></div>
          <div class="rate-text">{{ winRate }}% 胜率</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { mockMatches } from '@/data/mockData'
import type { Match } from '@/types'

const activeTab = ref<'all' | 'upcoming' | 'finished'>('all')

const upcomingMatches = computed(() => {
  return mockMatches.filter(m => m.status === 'upcoming')
})

const finishedMatches = computed(() => {
  return mockMatches.filter(m => m.status === 'finished')
})

const upcomingCount = computed(() => upcomingMatches.value.length)

const filteredUpcoming = computed(() => {
  if (activeTab.value === 'all' || activeTab.value === 'upcoming') {
    return upcomingMatches.value
  }
  return []
})

const filteredFinished = computed(() => {
  if (activeTab.value === 'all' || activeTab.value === 'finished') {
    return finishedMatches.value
  }
  return []
})

const groupedMatches = computed(() => {
  const groups: Record<string, Match[]> = {}
  filteredFinished.value.forEach(match => {
    const date = match.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(match)
  })
  return groups
})

const winCount = computed(() => {
  return finishedMatches.value.filter(m => m.result === 'win').length
})

const loseCount = computed(() => {
  return finishedMatches.value.filter(m => m.result === 'lose').length
})

const totalCount = computed(() => {
  return finishedMatches.value.length
})

const winRate = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((winCount.value / totalCount.value) * 100)
})

function setReminder(match: Match) {
  alert(`已为您设置比赛提醒：\n\n比赛：${match.tournament}\n对阵：星芒战队 VS ${match.opponent}\n时间：${match.date} ${match.time}\n地点：${match.venue}\n\n比赛开始前会提醒您！`)
}
</script>

<style lang="scss" scoped>
.schedule-page {
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
  margin-bottom: 30px;
  background: white;
  padding: 12px;
  border-radius: var(--border-radius);
  box-shadow: var(--card-shadow);
  
  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
}

.tab-item {
  position: relative;
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

.tab-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  background: var(--danger);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 比赛卡片 */
.match-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.match-card {
  overflow: hidden;
}

.upcoming-card {
  background: linear-gradient(135deg, rgba(255, 105, 180, 0.05) 0%, rgba(155, 89, 182, 0.05) 100%);
  border: 2px solid var(--light-purple);
}

.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--light-purple);
}

.tournament {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-purple);
}

.match-time {
  font-size: 13px;
  color: var(--text-gray);
  background: var(--light-purple);
  padding: 4px 12px;
  border-radius: 4px;
}

.match-teams {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30px 40px;
  
  @media (max-width: 768px) {
    padding: 20px 20px;
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
    font-size: 32px;
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
  padding: 16px 20px;
  border-top: 1px solid var(--light-purple);
}

.venue {
  font-size: 14px;
  color: var(--text-gray);
}

/* 时间轴视图 */
.timeline-container {
  position: relative;
  padding-left: 30px;
  
  &::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, var(--gradient-start), var(--gradient-end));
    border-radius: 2px;
  }
}

.timeline-group {
  margin-bottom: 30px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.timeline-date {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-purple);
  margin-bottom: 16px;
  padding-left: 10px;
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timeline-item {
  position: relative;
  margin-left: 20px;
}

.timeline-dot {
  position: absolute;
  left: -35px;
  top: 24px;
  width: 12px;
  height: 12px;
  background: var(--primary-purple);
  border-radius: 50%;
  border: 3px solid var(--light-purple);
}

.match-content {
  padding: 16px 20px;
}

.match-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.match-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.team-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.team-logo-small {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  
  .logo-initial {
    font-size: 20px;
    font-weight: 700;
    color: white;
  }
}

.team-logo-img-small {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 8px;
  background: var(--light-purple);
}

.score-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 700;
  
  &.win {
    background: rgba(39, 174, 96, 0.1);
  }
  
  &.lose {
    background: rgba(231, 76, 60, 0.1);
  }
}

.our-score {
  font-size: 28px;
  color: var(--text-dark);
}

.score-separator {
  font-size: 20px;
  color: var(--text-light);
}

.opponent-score {
  font-size: 28px;
  color: var(--text-dark);
}

.result-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  
  &.win {
    background: var(--success);
    color: white;
  }
  
  &.lose {
    background: var(--danger);
    color: white;
  }
  
  &.draw {
    background: var(--warning);
    color: white;
  }
}

/* 统计卡片 */
.stats-section {
  margin-top: 40px;
}

.stats-card {
  padding: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  
  &.win-count {
    color: var(--success);
  }
  
  &.lose-count {
    color: var(--danger);
  }
  
  &.total-count {
    color: var(--primary-purple);
  }
  
  &.rate {
    color: var(--warning);
  }
}

.win-rate-bar {
  position: relative;
  height: 24px;
  background: var(--light-purple);
  border-radius: 12px;
  overflow: hidden;
}

.rate-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--gradient-start), var(--gradient-end));
  border-radius: 12px;
  transition: width 0.5s ease;
}

.rate-text {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 600;
  color: white;
}
</style>
