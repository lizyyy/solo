import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  currentUser, 
  recipes, 
  posts, 
  checkinRecords,
  coupons,
  pointsHistory,
  browseHistory,
  currentTheme,
  themes,
  followingList,
  applyTheme,
  wheelDailyChances,
  wheelExtraChances,
  getTotalWheelChances,
  useWheelChance,
  addWheelChance,
  toggleFavorite as dataToggleFavorite,
  addBrowseHistory as dataAddBrowseHistory,
  addComment as dataAddComment,
  addPost as dataAddPost,
  addPostComment as dataAddPostComment,
  addCheckin as dataAddCheckin,
  togglePostLike as dataTogglePostLike,
  toggleFollow as dataToggleFollow,
  isFollowing as dataIsFollowing
} from '@/data/mockData'

export const useUserStore = defineStore('user', () => {
  const user = ref(currentUser.value)
  const theme = ref(currentTheme.value)
  
  const favorites = computed(() => {
    return recipes.value.filter(r => r.isFavorite)
  })
  
  const history = computed(() => {
    return browseHistory.value
  })
  
  const userPoints = computed(() => user.value.points)
  const userLevel = computed(() => user.value.level)
  const userPosts = computed(() => {
    return posts.value.filter(p => p.author.id === user.value.id)
  })
  const userCheckins = computed(() => checkinRecords.value)
  const userCoupons = computed(() => coupons.value)
  const userPointsHistory = computed(() => pointsHistory.value)
  const availableThemes = computed(() => themes.value)
  
  const userFollowingList = computed(() => followingList.value)
  
  const followingRecipes = computed(() => {
    return recipes.value.filter(r => followingList.value.includes(r.author.id))
  })
  
  const followingPosts = computed(() => {
    return posts.value.filter(p => followingList.value.includes(p.author.id))
  })
  
  function toggleFavorite(recipeId) {
    dataToggleFavorite(recipeId)
  }
  
  function addBrowseHistory(recipeId) {
    dataAddBrowseHistory(recipeId)
  }
  
  function addRecipeComment(recipeId, content, rating = 5) {
    return dataAddComment(recipeId, content, rating)
  }
  
  function addNewPost(title, content, images = [], tags = []) {
    return dataAddPost(title, content, images, tags)
  }
  
  function addNewPostComment(postId, content) {
    return dataAddPostComment(postId, content)
  }
  
  function togglePostLike(postId) {
    dataTogglePostLike(postId)
  }
  
  function toggleFollow(userId) {
    return dataToggleFollow(userId)
  }
  
  function checkFollowing(userId) {
    return dataIsFollowing(userId)
  }
  
  function addNewCheckin(recipeId, note = '', images = []) {
    return dataAddCheckin(recipeId, note, images)
  }
  
  function setTheme(themeId) {
    const selectedTheme = themes.value.find(t => t.id === themeId)
    if (selectedTheme) {
      theme.value = selectedTheme
      currentTheme.value = selectedTheme
      applyTheme(selectedTheme)
    }
  }
  
  const totalWheelChances = computed(() => getTotalWheelChances())
  
  const hasWheelChance = computed(() => totalWheelChances.value > 0)
  
  function useOneWheelChance() {
    return useWheelChance()
  }
  
  function addExtraWheelChance(count = 1) {
    addWheelChance(count)
  }
  
  function addPoints(amount, description) {
    user.value.points += amount
    pointsHistory.value.unshift({
      id: pointsHistory.value.length + 1,
      type: 'income',
      amount,
      description,
      date: new Date().toLocaleString('zh-CN'),
      balance: user.value.points
    })
  }
  
  function usePoints(amount, description) {
    if (user.value.points >= amount) {
      user.value.points -= amount
      pointsHistory.value.unshift({
        id: pointsHistory.value.length + 1,
        type: 'expense',
        amount,
        description,
        date: new Date().toLocaleString('zh-CN'),
        balance: user.value.points
      })
      return true
    }
    return false
  }
  
  return {
    user,
    theme,
    favorites,
    history,
    userPoints,
    userLevel,
    userPosts,
    userCheckins,
    userCoupons,
    userPointsHistory,
    availableThemes,
    userFollowingList,
    followingRecipes,
    followingPosts,
    totalWheelChances,
    hasWheelChance,
    toggleFavorite,
    addBrowseHistory,
    addRecipeComment,
    addNewPost,
    addNewPostComment,
    togglePostLike,
    toggleFollow,
    checkFollowing,
    addNewCheckin,
    setTheme,
    useOneWheelChance,
    addExtraWheelChance,
    addPoints,
    usePoints
  }
})
