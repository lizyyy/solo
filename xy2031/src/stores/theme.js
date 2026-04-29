import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const THEMES = {
  default: {
    id: 'default',
    name: '默认主题',
    description: '清新简约的默认风格',
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    accent: '#EC4899',
    bg: '#F3F4F6',
    icon: '🏠',
    image: null
  },
  beijing: {
    id: 'beijing',
    name: '北京天安门主题',
    description: '感受皇城根下的历史厚重',
    primary: '#C41E3A',
    secondary: '#FFD700',
    accent: '#8B4513',
    bg: '#FFF5E6',
    icon: '🏯',
    image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800',
    landmark: '天安门广场'
  },
  shanghai: {
    id: 'shanghai',
    name: '上海东方明珠主题',
    description: '体验魔都的现代与时尚',
    primary: '#1E90FF',
    secondary: '#FF6B6B',
    accent: '#4ECDC4',
    bg: '#F0F8FF',
    icon: '🗼',
    image: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800',
    landmark: '东方明珠'
  },
  guangzhou: {
    id: 'guangzhou',
    name: '广州塔主题',
    description: '品味岭南文化的独特魅力',
    primary: '#FF6B6B',
    secondary: '#FFD93D',
    accent: '#6BCB77',
    bg: '#FFF5F5',
    icon: '🗽',
    image: 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800',
    landmark: '广州塔'
  },
  dali: {
    id: 'dali',
    name: '大理洱海主题',
    description: '享受风花雪月的浪漫',
    primary: '#4A90A4',
    secondary: '#A8E6CF',
    accent: '#FFD3B6',
    bg: '#E8F4F8',
    icon: '🌊',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    landmark: '洱海'
  },
  xinjiang: {
    id: 'xinjiang',
    name: '新疆赛里木湖主题',
    description: '领略西域的壮美风光',
    primary: '#2E8B57',
    secondary: '#87CEEB',
    accent: '#DDA0DD',
    bg: '#F5FFFA',
    icon: '🏔️',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    landmark: '赛里木湖'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const currentThemeId = ref('default')
  
  const currentTheme = computed(() => {
    return THEMES[currentThemeId.value] || THEMES.default
  })
  
  const themeList = computed(() => {
    return Object.values(THEMES)
  })
  
  function setTheme(themeId) {
    if (THEMES[themeId]) {
      currentThemeId.value = themeId
      localStorage.setItem('theme', themeId)
      applyTheme(THEMES[themeId])
    }
  }
  
  function initTheme() {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme && THEMES[savedTheme]) {
      currentThemeId.value = savedTheme
      applyTheme(THEMES[savedTheme])
    }
  }
  
  function applyTheme(theme) {
    const root = document.documentElement
    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-bg', theme.bg)
  }
  
  return {
    currentThemeId,
    currentTheme,
    themeList,
    setTheme,
    initTheme
  }
})
