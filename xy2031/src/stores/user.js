import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({
    id: 'user_001',
    username: '旅行者',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    phone: '138****8888',
    email: 'traveler@example.com',
    level: '金牌会员',
    points: 2580,
    createdAt: '2024-01-15'
  })
  
  const isLoggedIn = ref(true)
  
  const addresses = ref([
    {
      id: 'addr_001',
      name: '张三',
      phone: '13812345678',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号SOHO现代城A座1201室',
      isDefault: true
    },
    {
      id: 'addr_002',
      name: '李四',
      phone: '13987654321',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '陆家嘴环路1000号恒生银行大厦',
      isDefault: false
    }
  ])
  
  const favoriteProducts = ref([
    'prod_001',
    'prod_005',
    'prod_010'
  ])
  
  const userLevel = computed(() => {
    const points = userInfo.value.points
    if (points >= 5000) return { name: '钻石会员', icon: '💎', color: 'text-blue-500' }
    if (points >= 2000) return { name: '金牌会员', icon: '🥇', color: 'text-yellow-500' }
    if (points >= 500) return { name: '银牌会员', icon: '🥈', color: 'text-gray-400' }
    return { name: '普通会员', icon: '⭐', color: 'text-gray-500' }
  })
  
  function login(username, password) {
    isLoggedIn.value = true
    userInfo.value = {
      ...userInfo.value,
      username
    }
    localStorage.setItem('user', JSON.stringify(userInfo.value))
    return true
  }
  
  function logout() {
    isLoggedIn.value = false
    userInfo.value = null
    localStorage.removeItem('user')
  }
  
  function updateUserInfo(newInfo) {
    userInfo.value = { ...userInfo.value, ...newInfo }
    localStorage.setItem('user', JSON.stringify(userInfo.value))
  }
  
  function addAddress(address) {
    if (address.isDefault) {
      addresses.value.forEach(addr => {
        addr.isDefault = false
      })
    }
    address.id = `addr_${Date.now()}`
    addresses.value.push(address)
  }
  
  function updateAddress(id, updatedAddress) {
    const index = addresses.value.findIndex(addr => addr.id === id)
    if (index !== -1) {
      if (updatedAddress.isDefault) {
        addresses.value.forEach(addr => {
          addr.isDefault = addr.id === id
        })
      }
      addresses.value[index] = { ...addresses.value[index], ...updatedAddress }
    }
  }
  
  function deleteAddress(id) {
    const index = addresses.value.findIndex(addr => addr.id === id)
    if (index !== -1) {
      addresses.value.splice(index, 1)
    }
  }
  
  function setDefaultAddress(id) {
    addresses.value.forEach(addr => {
      addr.isDefault = addr.id === id
    })
  }
  
  function toggleFavorite(productId) {
    const index = favoriteProducts.value.indexOf(productId)
    if (index === -1) {
      favoriteProducts.value.push(productId)
    } else {
      favoriteProducts.value.splice(index, 1)
    }
  }
  
  function isFavorite(productId) {
    return favoriteProducts.value.includes(productId)
  }
  
  function addPoints(amount) {
    userInfo.value.points += amount
  }
  
  return {
    userInfo,
    isLoggedIn,
    addresses,
    favoriteProducts,
    userLevel,
    login,
    logout,
    updateUserInfo,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    toggleFavorite,
    isFavorite,
    addPoints
  }
})
