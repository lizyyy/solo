<template>
  <div class="fan-service-page fade-in page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">粉丝服务</h1>
      <p class="page-subtitle">参与活动，与星芒一起成长</p>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-actions">
      <div class="action-item card" @click="activeTab = 'activities'">
        <span class="action-icon">🎉</span>
        <span class="action-text">应援活动</span>
      </div>
      <div class="action-item card" @click="activeTab = 'message'">
        <span class="action-icon">💬</span>
        <span class="action-text">留言墙</span>
      </div>
      <div class="action-item card" @click="activeTab = 'lottery'">
        <span class="action-icon">🎰</span>
        <span class="action-text">幸运抽奖</span>
      </div>
      <div class="action-item card" @click="showContactModal = true">
        <span class="action-icon">🎧</span>
        <span class="action-text">客服</span>
      </div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'activities' }"
        @click="activeTab = 'activities'"
      >
        应援活动
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'message' }"
        @click="activeTab = 'message'"
      >
        留言墙
        <span class="tab-badge" v-if="messages.length > 0">{{ messages.length }}</span>
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'lottery' }"
        @click="activeTab = 'lottery'"
      >
        幸运抽奖
      </div>
    </div>

    <!-- 应援活动 -->
    <section v-if="activeTab === 'activities'" class="activities-section">
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
          <div class="activity-content">
            <h3 class="activity-title">{{ activity.title }}</h3>
            <p class="activity-desc">{{ activity.description }}</p>
            <div class="activity-meta">
              <div class="participants">
                <span class="count">{{ activity.currentParticipants }}</span>
                <span class="total">/{{ activity.maxParticipants }} 人参与</span>
              </div>
              <div class="time-info">
                📅 {{ activity.startTime }} - {{ activity.endTime }}
              </div>
            </div>
            <div class="activity-actions">
              <button 
                class="btn btn-small btn-primary" @click="joinActivity(activity)">
                立即参与
              </button>
              <button class="btn btn-small btn-secondary" @click="shareActivity(activity)">
                分享活动
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="activities.length === 0" class="empty-state">
        <span class="empty-icon">🎭</span>
        <span class="empty-text">暂无活动，敬请期待</span>
      </div>
    </section>

    <!-- 留言墙 -->
    <section v-if="activeTab === 'message'" class="message-section">
      <!-- 发布留言 -->
      <div class="message-input-card card">
        <div class="input-header">
          <img :src="userStore.user.avatar" :alt="userStore.user.nickname" class="user-avatar" />
          <span class="user-name">{{ userStore.user.nickname }}</span>
        </div>
        <textarea 
          v-model="newMessage" 
          class="message-textarea"
          placeholder="写下你想对星芒战队说的话..."
          rows="3"
        ></textarea>
        <div class="input-actions">
          <span class="char-count">{{ newMessage.length }}/500</span>
          <button 
            class="btn btn-small btn-primary" @click="submitMessage" :disabled="!newMessage.trim()">
            发布留言
          </button>
        </div>
      </div>

      <!-- 留言列表 -->
      <div class="message-list">
        <div 
          v-for="message in allMessages" 
          :key="message.id" 
          class="message-card card"
        >
          <div class="message-header">
            <img :src="message.userAvatar" :alt="message.userName" class="user-avatar" />
            <div class="user-info">
              <span class="user-name">{{ message.userName }}</span>
              <span class="post-time">{{ message.createTime }}</span>
            </div>
          </div>
          <p class="message-content">{{ message.content }}</p>
          <div class="message-actions">
            <button class="action-btn" @click="likeMessage(message)">
              <span class="action-icon">❤️</span>
              <span class="action-text">{{ message.likes }}</span>
            </button>
            <button class="action-btn">
              <span class="action-icon">💬</span>
              <span class="action-text">{{ message.replies.length }}</span>
            </button>
          </div>
          
          <!-- 回复列表 -->
          <div v-if="message.replies.length > 0" class="replies-section">
            <div 
              v-for="reply in message.replies" 
              :key="reply.id" 
              class="reply-item"
            >
              <span class="reply-user">{{ reply.userName }}：</span>
              <span class="reply-content">{{ reply.content }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="allMessages.length === 0" class="empty-state">
        <span class="empty-icon">💬</span>
        <span class="empty-text">快来发布第一条留言吧</span>
      </div>
    </section>

    <!-- 幸运抽奖 -->
    <section v-if="activeTab === 'lottery'" class="lottery-section">
      <div class="lottery-card card">
        <div class="lottery-header">
          <h2 class="lottery-title">🎰 五周年幸运大抽奖</h2>
          <p class="lottery-desc">活动时间：2024-05-01 至 2024-05-07</p>
        </div>
        
        <!-- 抽奖转盘 -->
        <div class="lottery-wheel">
          <div class="wheel-container" :class="{ spinning: isSpinning }">
            <div class="wheel-slice" v-for="(prize, index) in prizes" :key="index" 
                 :style="getSliceStyle(index)">
              <span class="prize-text">{{ prize.name }}</span>
            </div>
            <div class="wheel-center" @click="spinWheel">
              <span v-if="!isSpinning" class="spin-text">抽奖</span>
              <span v-else class="spin-text">抽奖中</span>
            </div>
          </div>
          <div class="wheel-pointer"></div>
        </div>

        <!-- 抽奖信息 -->
        <div class="lottery-info">
          <div class="remaining-chances">
            <span class="chances-label">今日剩余抽奖次数：</span>
            <span class="chances-count">{{ remainingChances }}</span>
          </div>
          <p class="tips">
            💡 小提示：每日可抽奖 3 次，消费积分可额外获得抽奖机会
          </p>
        </div>

        <!-- 奖品列表 -->
        <div class="prizes-list">
          <h3 class="prizes-title">🎁 奖品一览</h3>
          <div class="prizes-grid">
            <div v-for="prize in prizes" :key="prize.id" class="prize-item">
              <span class="prize-icon">{{ prize.icon }}</span>
              <span class="prize-name">{{ prize.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 客服弹窗 -->
    <div v-if="showContactModal" class="modal-overlay" @click="showContactModal = false">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="showContactModal = false">✕</button>
        <h2 class="modal-title">客服支持</h2>
        <div class="contact-options">
          <div class="contact-item">
            <span class="contact-icon">💬</span>
            <div class="contact-info">
              <span class="contact-title">在线客服</span>
              <span class="contact-desc">工作时间 9:00-21:00</span>
            </div>
            <button class="btn btn-small btn-primary" @click="openOnlineService">立即咨询</button>
          </div>
          <div class="contact-item">
            <span class="contact-icon">📞</span>
            <div class="contact-info">
              <span class="contact-title">客服热线</span>
              <span class="contact-desc">400-888-8888</span>
            </div>
            <button class="btn btn-small btn-secondary" @click="callService">拨打电话</button>
          </div>
          <div class="contact-item">
            <span class="contact-icon">📧</span>
            <div class="contact-info">
              <span class="contact-title">邮箱反馈</span>
              <span class="contact-desc">support@starlight.com</span>
            </div>
            <button class="btn btn-small btn-secondary" @click="sendEmail">发送邮件</button>
          </div>
        </div>
        <div class="faq-section">
          <h3 class="faq-title">常见问题</h3>
          <div class="faq-list">
            <div class="faq-item">
              <span class="faq-question">Q: 如何查询订单物流？</span>
              <span class="faq-answer">A: 在个人中心-我的订单中可以查看物流信息</span>
            </div>
            <div class="faq-item">
              <span class="faq-question">Q: 积分如何获取？</span>
              <span class="faq-answer">A: 消费、签到、参与活动均可获得积分</span>
            </div>
            <div class="faq-item">
              <span class="faq-question">Q: 如何取消订单？</span>
              <span class="faq-answer">A: 未发货订单可在订单详情页申请取消</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 抽奖结果弹窗 -->
    <div v-if="showLotteryResult" class="modal-overlay" @click="showLotteryResult = false">
      <div class="modal-content result-modal" @click.stop>
        <div class="result-animation">
          <span class="result-icon">{{ lotteryResult?.icon }}</span>
        </div>
        <h2 class="result-title">恭喜获得！</h2>
        <p class="result-prize">{{ lotteryResult?.name }}</p>
        <p v-if="lotteryResult?.name.includes('积分')" class="result-points">
          积分已存入账户，当前积分：<span class="highlight">{{ userStore.user.points }}</span>
        </p>
        <p v-if="lotteryResult?.name.includes('积分')" class="result-hint">
          可在"我的"页面查看积分明细
        </p>
        <button class="btn btn-primary" @click="showLotteryResult = false">
          太棒了！
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mockActivities, mockMessages } from '@/data/mockData'
import { useUserStore } from '@/store/userStore'
import type { Activity, Message } from '@/types'

const userStore = useUserStore()

const activeTab = ref<'activities' | 'message' | 'lottery'>('activities')
const showContactModal = ref(false)
const newMessage = ref('')

const STORAGE_KEY_ACTIVITIES = 'esports_activities'
const STORAGE_KEY_MESSAGES_LIKES = 'esports_messages_likes'

function loadLikesFromStorage(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MESSAGES_LIKES)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load likes from storage:', e)
  }
  return {}
}

function saveLikesToStorage(likesData: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES_LIKES, JSON.stringify(likesData))
  } catch (e) {
    console.error('Failed to save likes to storage:', e)
  }
}

const storedLikes = ref<Record<string, number>>(loadLikesFromStorage())

function loadActivities() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVITIES)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load activities from storage:', e)
  }
  return mockActivities.map(a => ({ ...a }))
}

function saveActivities(activitiesList: any[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activitiesList))
  } catch (e) {
    console.error('Failed to save activities to storage:', e)
  }
}

const activities = ref(loadActivities())
const messages = computed(() => userStore.messages)

const allMessages = computed(() => {
  const mockList = mockMessages.map(m => ({
    ...m,
    likes: storedLikes.value[m.id] !== undefined ? storedLikes.value[m.id] : m.likes
  }))
  return [...mockList, ...messages.value]
})

// 抽奖相关
const isSpinning = ref(false)
const remainingChances = ref(3)
const showLotteryResult = ref(false)
const lotteryResult = ref<{ name: string; icon: string } | null>(null)

const prizes = [
  { id: 1, name: '与选手共进晚餐', icon: '🍽️', probability: 0.01 },
  { id: 2, name: '签名全套外设', icon: '⌨️', probability: 0.05 },
  { id: 3, name: '限定周边大礼包', icon: '🎁', probability: 0.10 },
  { id: 4, name: '100积分', icon: '⭐', probability: 0.20 },
  { id: 5, name: '50积分', icon: '✨', probability: 0.30 },
  { id: 6, name: '谢谢参与', icon: '💫', probability: 0.34 }
]

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    upcoming: '即将开始',
    ongoing: '进行中',
    ended: '已结束'
  }
  return statusMap[status] || status
}

function joinActivity(activity: any) {
  if (activity.status === 'ended') {
    alert('活动已结束')
    return
  }
  
  if (activity.currentParticipants >= activity.maxParticipants) {
    alert('活动参与人数已达上限')
    return
  }
  
  const activityIndex = activities.value.findIndex((a: any) => a.id === activity.id)
  if (activityIndex > -1) {
    activities.value[activityIndex].currentParticipants++
    saveActivities(activities.value)
    alert(`已成功参与活动：${activity.title}\n当前参与人数：${activities.value[activityIndex].currentParticipants}/${activity.maxParticipants}`)
  } else {
    alert(`已成功参与活动：${activity.title}`)
  }
}

function shareActivity(activity: Activity) {
  const shareText = `【星芒电竞俱乐部】${activity.title}\n\n${activity.description}\n\n快来一起参与吧！`
  
  if (navigator.share) {
    navigator.share({
      title: activity.title,
      text: shareText
    }).catch(() => {
      copyToClipboard(shareText)
    })
  } else {
    copyToClipboard(shareText)
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    alert('分享内容已复制到剪贴板！')
  }).catch(() => {
    alert(`分享内容：\n${text}`)
  })
}

function openOnlineService() {
  alert('正在连接在线客服...\n\n客服工作时间：9:00-21:00\n\n您也可以拨打客服热线：400-888-8888')
}

function callService() {
  alert('客服热线：400-888-8888\n\n工作时间：9:00-21:00\n\n请使用手机拨打')
}

function sendEmail() {
  const email = 'support@starlight.com'
  if (confirm(`是否要发送邮件到 ${email}？`)) {
    window.location.href = `mailto:${email}?subject=星芒电竞俱乐部-问题反馈`
  }
}

function submitMessage() {
  if (!newMessage.value.trim()) return
  if (newMessage.value.length > 500) {
    alert('留言内容不能超过500字')
    return
  }
  
  const message: Message = {
    id: `msg-${Date.now()}`,
    userId: userStore.user.id,
    userName: userStore.user.nickname,
    userAvatar: userStore.user.avatar,
    content: newMessage.value,
    createTime: new Date().toLocaleString('zh-CN'),
    likes: 0,
    replies: []
  }
  
  userStore.addMessage(message)
  newMessage.value = ''
  alert('留言发布成功！')
}

function likeMessage(message: Message) {
  const currentLikes = storedLikes.value[message.id] !== undefined 
    ? storedLikes.value[message.id] 
    : message.likes
  storedLikes.value = {
    ...storedLikes.value,
    [message.id]: currentLikes + 1
  }
  saveLikesToStorage(storedLikes.value)
}

// 抽奖相关函数
function getSliceStyle(index: number) {
  const angle = (360 / prizes.length) * index
  return {
    transform: `rotate(${angle}deg) skewY(${-(90 - 360 / prizes.length / 2)}deg)`
  }
}

function spinWheel() {
  if (remainingChances.value <= 0) {
    alert('今日抽奖次数已用完，明天再来吧！')
    return
  }
  
  if (isSpinning.value) return
  
  isSpinning.value = true
  remainingChances.value--
  
  // 随机选择奖品
  const random = Math.random()
  let cumulative = 0
  let selectedPrize = prizes[prizes.length - 1]
  
  for (const prize of prizes) {
    cumulative += prize.probability
    if (random < cumulative) {
      selectedPrize = prize
      break
    }
  }
  
  // 模拟抽奖动画
  setTimeout(() => {
    isSpinning.value = false
    lotteryResult.value = selectedPrize
    showLotteryResult.value = true
    
    // 如果是积分奖励
    if (selectedPrize.name.includes('积分')) {
      const points = parseInt(selectedPrize.name) === '100积分' ? 100 : 50
      userStore.addPoints(points)
    }
  }, 3000)
}
</script>

<style lang="scss" scoped>
.fan-service-page {
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

/* 快捷入口 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    transform: translateY(-4px);
    
    .action-icon {
      transform: scale(1.1);
    }
  }
}

.action-icon {
  font-size: 32px;
  margin-bottom: 12px;
  transition: var(--transition);
}

.action-text {
  font-size: 14px;
  font-weight: 500;
}

/* Tab 导航 */
.tab-nav {
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
  background: var(--primary-pink);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 活动列表 */
.activities-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.activity-card {
  display: flex;
  overflow: hidden;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.activity-image {
  position: relative;
  width: 300px;
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

.activity-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.activity-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.activity-desc {
  font-size: 14px;
  color: var(--text-gray);
  line-height: 1.6;
  margin-bottom: 16px;
}

.activity-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-gray);
}

.participants {
  .count {
    font-size: 20px;
    font-weight: 700;
    color: var(--primary-purple);
  }
  
  .total {
    color: var(--text-gray);
  }
}

.activity-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

/* 留言墙 */
.message-input-card {
  padding: 20px;
  margin-bottom: 20px;
}

.input-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-weight: 500;
}

.message-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--light-purple);
  border-radius: var(--border-radius);
  font-size: 14px;
  resize: vertical;
  transition: var(--transition);
  
  &:focus {
    outline: none;
    border-color: var(--primary-purple);
  }
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.char-count {
  font-size: 12px;
  color: var(--text-gray);
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-card {
  padding: 20px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.post-time {
  font-size: 12px;
  color: var(--text-light);
}

.message-content {
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 12px;
}

.message-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: var(--light-purple);
  border-radius: 4px;
  font-size: 13px;
  color: var(--primary-purple);
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    background: var(--primary-purple);
    color: white;
  }
}

.action-icon {
  font-size: 14px;
}

.replies-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--light-purple);
}

.reply-item {
  font-size: 13px;
  color: var(--text-gray);
  margin-bottom: 8px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.reply-user {
  font-weight: 500;
  color: var(--primary-purple);
}

/* 抽奖区域 */
.lottery-card {
  padding: 24px;
}

.lottery-header {
  text-align: center;
  margin-bottom: 30px;
}

.lottery-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.lottery-desc {
  font-size: 14px;
  color: var(--text-gray);
}

.lottery-wheel {
  position: relative;
  width: 300px;
  height: 300px;
  margin: 0 auto 30px;
}

.wheel-container {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #FF69B4 0deg 60deg,
    #9B59B6 60deg 120deg,
    #4ECDC4 120deg 180deg,
    #FFD700 180deg 240deg,
    #FF6B6B 240deg 300deg,
    #95A5A6 300deg 360deg
  );
  position: relative;
  transition: transform 3s ease-out;
  
  &.spinning {
    animation: spin-animation 3s ease-out;
  }
}

@keyframes spin-animation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(1800deg);
  }
}

.wheel-slice {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: center;
}

.prize-text {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) rotate(30deg);
  font-size: 12px;
  font-weight: 600;
  color: white;
  width: 60px;
  text-align: center;
}

.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(155, 89, 182, 0.4);
  transition: var(--transition);
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.05);
  }
}

.spin-text {
  font-size: 18px;
  font-weight: 700;
  color: white;
}

.wheel-pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 30px solid var(--primary-purple);
  z-index: 10;
}

.lottery-info {
  text-align: center;
  margin-bottom: 30px;
  padding: 16px;
  background: var(--light-purple);
  border-radius: var(--border-radius);
}

.remaining-chances {
  font-size: 16px;
  margin-bottom: 8px;
}

.chances-count {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-purple);
}

.tips {
  font-size: 13px;
  color: var(--text-gray);
}

.prizes-list {
  border-top: 1px solid var(--light-purple);
  padding-top: 20px;
}

.prizes-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.prizes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.prize-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: var(--light-purple);
  border-radius: 8px;
}

.prize-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.prize-name {
  font-size: 12px;
  text-align: center;
}

/* 弹窗样式 */
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
  padding: 24px;
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

.modal-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 20px;
}

.contact-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--light-purple);
  border-radius: var(--border-radius);
}

.contact-icon {
  font-size: 28px;
}

.contact-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.contact-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.contact-desc {
  font-size: 13px;
  color: var(--text-gray);
}

.faq-section {
  border-top: 1px solid var(--light-purple);
  padding-top: 20px;
}

.faq-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  padding: 12px;
  background: var(--cream-white);
  border-radius: 8px;
}

.faq-question {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

.faq-answer {
  display: block;
  font-size: 13px;
  color: var(--text-gray);
}

/* 抽奖结果弹窗 */
.result-modal {
  text-align: center;
}

.result-animation {
  margin-bottom: 20px;
}

.result-icon {
  font-size: 64px;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.result-title {
  font-size: 18px;
  color: var(--text-gray);
  margin-bottom: 8px;
}

.result-prize {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-purple);
  margin-bottom: 12px;
}

.result-points {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  
  .highlight {
    font-size: 20px;
    font-weight: 700;
    color: #c44569;
  }
}

.result-hint {
  font-size: 12px;
  color: #999;
  margin-bottom: 20px;
}
</style>
