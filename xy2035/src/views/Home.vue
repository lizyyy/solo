<template>
  <div class="page">
    <div class="home-header">
      <div class="search-bar" @click="showSearch = true">
        <span class="search-icon">🔍</span>
        <span class="search-placeholder">搜索美食、菜谱、食材...</span>
      </div>
      <div class="header-actions">
        <button class="header-btn" @click="goToWheel">
          <span>🎰</span>
        </button>
        <button class="header-btn">
          <span>🔔</span>
          <span v-if="hasNotification" class="badge"></span>
        </button>
      </div>
    </div>

    <div class="page-content">
      <div class="banner-section p-4">
        <div class="banner card">
          <div class="banner-content">
            <div class="banner-text">
              <h2>今日推荐</h2>
              <p>转盘抽奖，3次机会搭配3道菜</p>
              <button class="btn btn-primary" @click="goToWheel">
                立即抽奖 →
              </button>
            </div>
            <div class="banner-image">
              <img :src="bannerRecipe.image" :alt="bannerRecipe.title" />
            </div>
          </div>
        </div>
      </div>

      <div class="category-nav p-4">
        <div class="nav-tabs">
          <button 
            v-for="tab in navTabs" 
            :key="tab.id"
            class="nav-tab"
            :class="{ active: activeTab === tab.id }"
            @click="switchTab(tab.id)"
          >
            <span class="nav-icon">{{ tab.icon }}</span>
            <span class="nav-name">{{ tab.name }}</span>
          </button>
        </div>
      </div>

      <div class="section-header px-4 mb-3">
        <div class="flex items-center justify-between">
          <h2 class="section-title">
            {{ getSectionTitle() }}
          </h2>
          <router-link to="/category" class="see-more">
            查看更多 <span>→</span>
          </router-link>
        </div>
      </div>

      <div class="recipes-list px-4">
        <div v-if="hasNoFollowingRecipes" class="empty-state py-12">
          <div class="empty-icon text-6xl mb-4">🔍</div>
          <p class="text-lg font-medium mb-2">暂未关注任何人</p>
          <p class="text-sm text-secondary">去发现喜欢的美食作者吧！</p>
          <router-link to="/category" class="btn btn-primary mt-4">
            浏览更多菜谱
          </router-link>
        </div>
        <RecipeCard 
          v-else
          v-for="recipe in displayRecipes" 
          :key="recipe.id"
          :recipe="recipe"
          @toggle-favorite="handleToggleFavorite(recipe.id)"
        />
      </div>

      <div v-if="activeTab === 'shop'" class="shop-section px-4">
        <h2 class="section-title mb-3">厨房好物推荐</h2>
        <div class="shop-grid">
          <div v-for="item in shopItems" :key="item.id" class="shop-item card card-hover cursor-pointer" @click="showShopItemDetail(item)">
            <div class="shop-item-image">
              <img :src="item.image" :alt="item.name" />
              <div v-if="item.tags.length" class="shop-item-tags">
                <span v-for="tag in item.tags.slice(0,1)" :key="tag" class="tag tag-warning">
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="shop-item-info p-3">
              <h3 class="shop-item-name text-base font-medium mb-2">{{ item.name }}</h3>
              <div class="shop-item-meta flex items-center justify-between">
                <div class="flex items-center gap-1 text-sm text-secondary">
                  <span>⭐ {{ item.rating }}</span>
                  <span>已售{{ item.sales }}</span>
                </div>
              </div>
              <div class="shop-item-price mt-2">
                <span class="price-current text-primary font-bold">¥{{ item.price }}</span>
                <span class="price-original text-sm text-light line-through ml-2">¥{{ item.originalPrice }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="load-more p-4 text-center">
        <button class="btn btn-outline" @click="loadMore">
          加载更多
        </button>
      </div>
    </div>

    <TabBar />

    <div v-if="showSearch" class="search-modal" @click.self="showSearch = false">
      <div class="search-modal-content">
        <div class="search-header flex items-center gap-3 p-4">
          <div class="search-input-wrapper flex-1">
            <span class="search-icon">🔍</span>
            <input 
              v-model="searchKeyword"
              type="text" 
              placeholder="搜索美食、菜谱、食材..."
              class="search-input"
              @keyup.enter="handleSearch"
            />
            <button v-if="searchKeyword" class="clear-btn" @click="searchKeyword = ''">
              ✕
            </button>
          </div>
          <button class="cancel-btn text-base" @click="showSearch = false">取消</button>
        </div>
        
        <div v-if="!searchKeyword" class="search-history p-4">
          <h3 class="text-base font-medium mb-3">搜索历史</h3>
          <div class="tags flex flex-wrap gap-2 mb-4">
            <span v-for="keyword in searchHistory" :key="keyword" class="tag" @click="searchKeyword = keyword">
              {{ keyword }}
            </span>
          </div>
          <h3 class="text-base font-medium mb-3">热门搜索</h3>
          <div class="tags flex flex-wrap gap-2">
            <span v-for="keyword in hotKeywords" :key="keyword" class="tag tag-primary" @click="searchKeyword = keyword">
              {{ keyword }}
            </span>
          </div>
        </div>

        <div v-else-if="searchResults.length > 0" class="search-results">
          <RecipeCard 
            v-for="recipe in searchResults" 
            :key="recipe.id"
            :recipe="recipe"
            @toggle-favorite="handleToggleFavorite(recipe.id)"
          />
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>没有找到相关菜谱</p>
        </div>
      </div>
    </div>

    <div v-if="selectedShopItem" class="modal-mask" @click="selectedShopItem = null">
      <div class="modal-content p-0" style="max-width: 90%;" @click.stop>
        <div class="shop-item-detail">
          <div class="shop-item-detail-image">
            <img :src="selectedShopItem.image" :alt="selectedShopItem.name" />
            <button class="close-btn" @click="selectedShopItem = null">×</button>
          </div>
          <div class="shop-item-detail-info p-4">
            <h3 class="text-lg font-bold mb-2">{{ selectedShopItem.name }}</h3>
            <div class="flex items-center gap-3 mb-3">
              <span class="text-primary font-bold text-2xl">¥{{ selectedShopItem.price }}</span>
              <span class="text-light text-sm line-through">¥{{ selectedShopItem.originalPrice }}</span>
            </div>
            <div class="flex items-center gap-4 text-sm text-secondary mb-4">
              <span>⭐ {{ selectedShopItem.rating }} 分</span>
              <span>已售 {{ selectedShopItem.sales }}</span>
              <span class="tag tag-success">{{ selectedShopItem.category }}</span>
            </div>
            <div class="flex flex-wrap gap-2 mb-4">
              <span v-for="tag in selectedShopItem.tags" :key="tag" class="tag tag-warning">
                {{ tag }}
              </span>
            </div>
            <div class="flex gap-3 mt-4">
              <button class="btn btn-outline flex-1" @click="addToCart(selectedShopItem)">
                加入购物车
              </button>
              <button class="btn btn-primary flex-1" @click="buyNow(selectedShopItem)">
                立即购买
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { recipes, categories, shopItems } from '@/data/mockData'
import TabBar from '@/components/TabBar.vue'
import RecipeCard from '@/components/RecipeCard.vue'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('recommend')
const showSearch = ref(false)
const searchKeyword = ref('')
const searchHistory = ref(['红烧肉', '甜品', '减脂餐', '家常菜'])
const hotKeywords = ref(['麻婆豆腐', '白切鸡', '提拉米苏', '沙拉', '番茄炒蛋'])
const displayCount = ref(4)
const hasNotification = ref(true)

const navTabs = [
  { id: 'follow', name: '关注', icon: '❤️' },
  { id: 'recommend', name: '推荐', icon: '🔥' },
  { id: 'diet', name: '减脂', icon: '🥗' },
  { id: 'shop', name: '商店', icon: '🛒' },
  { id: 'category', name: '分类', icon: '📋' }
]

const bannerRecipe = computed(() => recipes.value[2])

const displayRecipes = computed(() => {
  let filtered = []
  
  switch (activeTab.value) {
    case 'recommend':
      filtered = recipes.value
      break
    case 'diet':
      filtered = recipes.value.filter(r => r.categoryId === 11)
      break
    case 'category':
      filtered = recipes.value
      break
    case 'follow':
      filtered = userStore.followingRecipes
      break
    case 'shop':
      filtered = []
      break
    default:
      filtered = recipes.value
  }
  
  return filtered.slice(0, displayCount.value)
})

const hasNoFollowingRecipes = computed(() => {
  return activeTab.value === 'follow' && userStore.followingRecipes.length === 0
})

const searchResults = computed(() => {
  if (!searchKeyword.value) return []
  const keyword = searchKeyword.value.toLowerCase()
  return recipes.value.filter(r => 
    r.title.toLowerCase().includes(keyword) ||
    r.tags.some(t => t.toLowerCase().includes(keyword)) ||
    r.categoryName.toLowerCase().includes(keyword)
  )
})

const getSectionTitle = () => {
  switch (activeTab.value) {
    case 'recommend': return '🔥 为你推荐'
    case 'diet': return '🥗 减脂精选'
    case 'follow': return '❤️ 关注动态'
    case 'category': return '📋 热门分类'
    default: return '🔥 热门菜谱'
  }
}

const switchTab = (tabId) => {
  activeTab.value = tabId
  displayCount.value = 4
}

const goToWheel = () => {
  router.push('/wheel')
}

const handleToggleFavorite = (recipeId) => {
  userStore.toggleFavorite(recipeId)
}

const handleSearch = () => {
  if (searchKeyword.value && !searchHistory.value.includes(searchKeyword.value)) {
    searchHistory.value.unshift(searchKeyword.value)
    if (searchHistory.value.length > 10) {
      searchHistory.value.pop()
    }
  }
}

const loadMore = () => {
  displayCount.value += 4
}

const selectedShopItem = ref(null)

const showShopItemDetail = (item) => {
  selectedShopItem.value = item
}

const addToCart = (item) => {
  alert(`已将「${item.name}」加入购物车`)
  selectedShopItem.value = null
}

const buyNow = (item) => {
  alert(`正在跳转购买「${item.name}」...`)
  selectedShopItem.value = null
}
</script>

<style scoped>
.home-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--bg-primary);
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.search-icon {
  color: var(--text-light);
  font-size: 16px;
}

.search-placeholder {
  color: var(--text-light);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
}

.banner-section {
  padding-top: 16px;
}

.banner {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  padding: 20px;
}

.banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-text {
  color: white;
}

.banner-text h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.banner-text p {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 12px;
}

.banner-image {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.banner-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-nav {
  padding: 16px;
}

.nav-tabs {
  display: flex;
  justify-content: space-between;
  background-color: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 8px;
}

.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-tab.active {
  background-color: var(--primary-color);
}

.nav-tab.active .nav-name {
  color: white;
}

.nav-icon {
  font-size: 20px;
}

.nav-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.see-more {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--primary-color);
  text-decoration: none;
}

.shop-section {
  margin-top: 16px;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.shop-item {
  overflow: hidden;
}

.shop-item-image {
  position: relative;
  height: 140px;
}

.shop-item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shop-item-tags {
  position: absolute;
  top: 8px;
  left: 8px;
}

.shop-item-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text-primary);
}

.price-current {
  font-size: 18px;
}

.load-more {
  padding: 24px 16px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}

.search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.search-modal-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-primary);
  overflow-y: auto;
}

.search-header {
  position: sticky;
  top: 0;
  background-color: var(--bg-primary);
  z-index: 10;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-full);
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 14px;
  margin-left: 8px;
}

.clear-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
}

.cancel-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
}

.tags .tag {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.search-results {
  padding: 16px;
}

.shop-item-detail-image {
  position: relative;
  height: 250px;
  background-color: var(--bg-secondary);
}

.shop-item-detail-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
