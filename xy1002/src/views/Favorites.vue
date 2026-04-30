<template>
  <div class="favorites-page">
    <div class="page-header">
      <div class="back-btn" @click="goBack">
        <span class="back-icon">←</span>
      </div>
      <h1>我的收藏</h1>
    </div>

    <div class="favorites-tabs">
      <div
        :class="['tab-item', { active: selectedTab === 'products' }]"
        @click="selectedTab = 'products'"
      >
        商品收藏
        <span v-if="favoriteProducts.length > 0" class="tab-count">
          {{ favoriteProducts.length }}
        </span>
      </div>
      <div
        :class="['tab-item', { active: selectedTab === 'players' }]"
        @click="selectedTab = 'players'"
      >
        选手收藏
        <span v-if="favoritePlayers.length > 0" class="tab-count">
          {{ favoritePlayers.length }}
        </span>
      </div>
    </div>

    <div v-if="selectedTab === 'products'">
      <div v-if="favoriteProducts.length === 0" class="empty-state">
        <div class="empty-icon">💝</div>
        <p class="empty-text">暂无收藏商品</p>
        <p class="empty-hint">快去商城发现好物吧</p>
        <button class="go-shop-btn" @click="goToShop">
          去逛逛
        </button>
      </div>

      <div v-else class="products-grid">
        <div
          v-for="product in favoriteProducts"
          :key="product.id"
          class="product-card"
          @click="goToProductDetail(product.id)"
        >
          <div class="product-image-wrapper">
            <img :src="product.image" :alt="product.name" class="product-image" />
            <div
              v-if="product.originalPrice"
              class="discount-tag"
            >
              -{{ Math.round((1 - product.price / product.originalPrice) * 100) }}%
            </div>
            <div
              class="favorite-btn"
              @click.stop="toggleProductFavorite(product.id)"
            >
              <span class="heart filled">❤️</span>
            </div>
          </div>
          <div class="product-info">
            <h3 class="product-name">{{ product.name }}</h3>
            <div class="product-tags">
              <span
                v-for="tag in product.tags.slice(0, 2)"
                :key="tag"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
            <div class="product-price-row">
              <span class="current-price">¥{{ product.price }}</span>
              <span v-if="product.originalPrice" class="original-price">
                ¥{{ product.originalPrice }}
              </span>
            </div>
            <div class="product-meta">
              <span class="sales">已售 {{ product.sales }}</span>
              <span class="stock">库存 {{ product.stock }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <div v-if="favoritePlayers.length === 0" class="empty-state">
        <div class="empty-icon">⭐</div>
        <p class="empty-text">暂无收藏选手</p>
        <p class="empty-hint">去战队页面发现喜欢的选手吧</p>
        <button class="go-shop-btn" @click="goToTeam">
          去看看
        </button>
      </div>

      <div v-else class="players-list">
        <div
          v-for="player in favoritePlayers"
          :key="player.id"
          class="player-card"
        >
          <div class="player-header">
            <div class="player-avatar-wrapper">
              <img :src="player.avatar" :alt="player.name" class="player-avatar" />
              <div class="position-badge">{{ player.position }}</div>
            </div>
            <div class="player-info">
              <h3 class="player-nickname">{{ player.nickname }}</h3>
              <p class="player-name">{{ player.name }}</p>
              <div class="player-game">
                <span class="game-icon">🎮</span>
                <span>{{ player.game }}</span>
              </div>
            </div>
            <div
              class="favorite-btn-player"
              @click="togglePlayerFavorite(player.id)"
            >
              <span class="heart filled">❤️</span>
            </div>
          </div>

          <div class="player-achievements">
            <h4 class="section-title">主要成就</h4>
            <ul class="achievements-list">
              <li
                v-for="(achievement, index) in player.achievements"
                :key="index"
                class="achievement-item"
              >
                <span class="achievement-icon">🏆</span>
                <span>{{ achievement }}</span>
              </li>
            </ul>
          </div>

          <div class="player-footer">
            <span class="join-date">加入时间：{{ player.joinDate }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showToast" class="toast" :class="{ show: showToast }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { mockProducts, mockPlayers } from '@/data/mockData'
import type { Product, Player } from '@/types'

const router = useRouter()
const userStore = useUserStore()

const selectedTab = ref<'products' | 'players'>('products')
const showToast = ref(false)
const toastMessage = ref('')

const favoriteProducts = computed<Product[]>(() => {
  return mockProducts.filter(p => 
    userStore.user.favoriteProducts.includes(p.id)
  )
})

const favoritePlayers = computed<Player[]>(() => {
  return mockPlayers.filter(p => 
    userStore.user.favoritePlayers.includes(p.id)
  )
})

function showToastMessage(message: string): void {
  toastMessage.value = message
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 2000)
}

function toggleProductFavorite(productId: string): void {
  userStore.toggleFavoriteProduct(productId)
  showToastMessage('已取消收藏')
}

function togglePlayerFavorite(playerId: string): void {
  userStore.toggleFavoritePlayer(playerId)
  showToastMessage('已取消收藏')
}

function goBack(): void {
  router.back()
}

function goToShop(): void {
  router.push('/shop')
}

function goToTeam(): void {
  router.push('/team')
}

function goToProductDetail(productId: string): void {
  router.push(`/shop/${productId}`)
}
</script>

<style lang="scss" scoped>
.favorites-page {
  padding-bottom: 80px;
  background: #f5f5f5;
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  position: relative;

  .back-btn {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;

    .back-icon {
      font-size: 20px;
      color: #333;
    }
  }

  h1 {
    flex: 1;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    color: #333;
  }
}

.favorites-tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 16px;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 14px 8px;
  font-size: 15px;
  color: #666;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;

  .tab-count {
    font-size: 11px;
    background: #ff6b9d;
    color: white;
    padding: 1px 6px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
  }

  &.active {
    color: #c44569;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 3px;
      background: linear-gradient(90deg, #ff6b9d, #8854d0);
      border-radius: 2px;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-text {
    font-size: 16px;
    color: #666;
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 13px;
    color: #999;
    margin-bottom: 24px;
  }

  .go-shop-btn {
    padding: 12px 40px;
    background: linear-gradient(135deg, #ff6b9d, #c44569, #8854d0);
    color: white;
    border: none;
    border-radius: 25px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
}

.product-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.product-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #fafafa;

  .product-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .discount-tag {
    position: absolute;
    top: 8px;
    left: 8px;
    background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .favorite-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.3s;

    &:hover {
      transform: scale(1.1);
    }

    .heart {
      transition: all 0.3s;

      &.filled {
        animation: heartBeat 0.3s ease;
      }
    }
  }
}

.product-info {
  padding: 12px;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}

.product-tags {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;

  .tag {
    font-size: 10px;
    padding: 2px 6px;
    background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(136, 84, 208, 0.1));
    color: #c44569;
    border-radius: 4px;
  }
}

.product-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;

  .current-price {
    font-size: 18px;
    font-weight: 700;
    color: #c44569;
  }

  .original-price {
    font-size: 12px;
    color: #999;
    text-decoration: line-through;
  }
}

.product-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;

  .sales {
    color: #999;
  }

  .stock {
    color: #999;
  }
}

.players-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.player-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.player-avatar-wrapper {
  position: relative;

  .player-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3px solid rgba(255, 107, 157, 0.3);
  }

  .position-badge {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #ff6b9d, #8854d0);
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 10px;
    white-space: nowrap;
  }
}

.player-info {
  flex: 1;

  .player-nickname {
    font-size: 20px;
    font-weight: 700;
    color: #333;
    margin-bottom: 4px;
  }

  .player-name {
    font-size: 13px;
    color: #999;
    margin-bottom: 8px;
  }

  .player-game {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #666;

    .game-icon {
      font-size: 14px;
    }
  }
}

.favorite-btn-player {
  width: 36px;
  height: 36px;
  background: rgba(255, 107, 157, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: scale(1.1);
  }
}

.player-achievements {
  padding: 12px;
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.05), rgba(136, 84, 208, 0.05));
  border-radius: 12px;
  margin-bottom: 12px;

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #c44569;
    margin-bottom: 8px;
  }
}

.achievements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .achievement-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #666;

    .achievement-icon {
      font-size: 14px;
    }
  }
}

.player-footer {
  padding-top: 12px;
  border-top: 1px solid #f5f5f5;

  .join-date {
    font-size: 12px;
    color: #999;
  }
}

.toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s;

  &.show {
    opacity: 1;
  }
}

@keyframes heartBeat {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
</style>
