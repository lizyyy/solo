<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useProfileStore } from '@/stores/profile'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

const profileStore = useProfileStore()
const { currentTheme } = storeToRefs(profileStore)

function applyTheme() {
  const theme = currentTheme.value
  if (!theme) return
  
  const cssVars = {
    '--primary-color': theme.primaryColor,
    '--secondary-color': theme.secondaryColor,
    '--bg-color': theme.bgColor,
    '--accent-color': theme.primaryColor,
    '--border-color': adjustColor(theme.secondaryColor, 10)
  }
  
  // #ifdef H5
  Object.entries(cssVars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
  // #endif
  
  // #ifndef H5
  // 在小程序环境中，CSS变量需要通过其他方式处理
  // 这里我们只需要确保store中的主题是最新的
  // #endif
}

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '')
  const r = Math.min(255, Math.max(0, parseInt(hex.substring(0, 2), 16) + amount))
  const g = Math.min(255, Math.max(0, parseInt(hex.substring(2, 4), 16) + amount))
  const b = Math.min(255, Math.max(0, parseInt(hex.substring(4, 6), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

onLaunch(() => {
  console.log('App Launch')
  profileStore.loadProfile()
  applyTheme()
  
  watch(currentTheme, () => {
    applyTheme()
  })
})

onShow(() => {
  console.log('App Show')
  applyTheme()
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
@import './uni.scss';

:root {
  --primary-color: #FF69B4;
  --secondary-color: #FFC0CB;
  --accent-color: #FF1493;
  --bg-color: #FFF5F8;
  --border-color: #FFE4EC;
}

page {
  background-color: $bg-color;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  color: $text-color;
  min-height: 100vh;
}

.container {
  padding: 24rpx;
}

.card {
  background-color: $white;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(255, 182, 193, 0.15);
}

.btn-primary {
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: $white;
  border: none;
  border-radius: 50rpx;
  padding: 24rpx 48rpx;
  font-size: 32rpx;
  font-weight: 500;
  text-align: center;
}

.btn-secondary {
  background-color: $white;
  color: $primary-color;
  border: 2rpx solid $primary-color;
  border-radius: 50rpx;
  padding: 24rpx 48rpx;
  font-size: 32rpx;
  font-weight: 500;
  text-align: center;
}

.text-primary {
  color: $primary-color;
}

.text-secondary {
  color: $secondary-color;
}

.text-muted {
  color: $text-muted;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-column {
  display: flex;
  flex-direction: column;
}

.kitty-decoration {
  position: relative;
}

.kitty-decoration::before {
  content: '🎀';
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  font-size: 32rpx;
}

.hello-kitty {
  font-size: 48rpx;
}

.kitty-card {
  background-color: $white;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(255, 182, 193, 0.15);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -20rpx;
    right: 40rpx;
    width: 60rpx;
    height: 60rpx;
    background-color: $secondary-color;
    border-radius: 50%;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: -20rpx;
    right: 120rpx;
    width: 60rpx;
    height: 60rpx;
    background-color: $secondary-color;
    border-radius: 50%;
  }
}

.kitty-bow {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  
  &::before {
    content: '🎀';
    font-size: 32rpx;
  }
}

.kitty-ear {
  width: 60rpx;
  height: 60rpx;
  background-color: $secondary-color;
  border-radius: 50%;
  position: absolute;
  top: -30rpx;
}

.kitty-ear-left {
  @extend .kitty-ear;
  left: 40rpx;
}

.kitty-ear-right {
  @extend .kitty-ear;
  right: 40rpx;
}

.kitty-divider {
  height: 2rpx;
  background: linear-gradient(90deg, transparent, $secondary-color, $primary-color, $secondary-color, transparent);
  margin: 24rpx 0;
}

.kitty-tag {
  display: inline-block;
  padding: 8rpx 20rpx;
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: $white;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.kitty-input {
  border: 2rpx solid $secondary-color;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  background-color: $white;
  
  &:focus {
    border-color: $primary-color;
    box-shadow: 0 0 0 4rpx rgba(255, 105, 180, 0.1);
  }
}

.kitty-button {
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  color: $white;
  border: none;
  border-radius: 24rpx;
  padding: 20rpx 40rpx;
  font-size: 28rpx;
  font-weight: 500;
  text-align: center;
  position: relative;
  
  &::before {
    content: '🎀';
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    font-size: 20rpx;
  }
}

.kitty-whisker {
  position: relative;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 40rpx;
    height: 2rpx;
    background-color: $text-color;
  }
  
  &::before {
    top: 50%;
    left: -60rpx;
    transform: rotate(-15deg);
  }
  
  &::after {
    top: 50%;
    right: -60rpx;
    transform: rotate(15deg);
  }
}

.kitty-nose {
  width: 16rpx;
  height: 12rpx;
  background-color: $primary-color;
  border-radius: 50% 50% 50% 50%;
}

.kitty-eye {
  width: 12rpx;
  height: 12rpx;
  background-color: $text-color;
  border-radius: 50%;
}
</style>
