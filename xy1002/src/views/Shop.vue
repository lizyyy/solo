<template>
  <div class="shop-page">
    <div class="shop-header">
      <h1>周边商城</h1>
      <p>星芒战队官方周边，粉丝专属好物</p>
    </div>

    <div class="search-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索商品..."
          class="search-input"
        />
      </div>
      <div class="cart-icon" @click="goToCart">
        <span class="cart-badge">{{ userStore.cartCount }}</span>
        🛒
      </div>
    </div>

    <div class="category-tabs">
      <div
        v-for="cat in categories"
        :key="cat.value"
        :class="['tab-item', { active: selectedCategory === cat.value }]"
        @click="selectedCategory = cat.value"
      >
        {{ cat.label }}
      </div>
    </div>

    <div class="products-grid">
      <div
        v-for="product in filteredProducts"
        :key="product.id"
        class="product-card"
        @click="goToDetail(product.id)"
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
            @click.stop="toggleFavorite(product.id)"
          >
            <span :class="['heart', { filled: isFavorite(product.id) }]">
              {{ isFavorite(product.id) ? '❤️' : '🤍' }}
            </span>
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
            <span class="stock" :class="{ 'low-stock': product.stock < 100 }">
              库存 {{ product.stock }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredProducts.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>没有找到相关商品</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { mockProducts } from '@/data/mockData'
import type { Product } from '@/types'

const router = useRouter()
const userStore = useUserStore()

const searchKeyword = ref('')
const selectedCategory = ref('all')

const categories = [
  { label: '全部', value: 'all' },
  { label: '服饰', value: 'clothing' },
  { label: '徽章', value: 'badge' },
  { label: '键帽/外设', value: 'keycap' },
  { label: '海报', value: 'poster' }
]

const categoryLabelMap: Record<string, string> = {
  clothing: '服饰',
  badge: '徽章',
  keycap: '键帽/外设',
  poster: '海报'
}

const filteredProducts = computed<Product[]>(() => {
  let result = [...mockProducts]
  
  if (selectedCategory.value !== 'all') {
    result = result.filter(p => p.category === selectedCategory.value)
  }
  
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(
      p => p.name.toLowerCase().includes(keyword) || 
           p.description.toLowerCase().includes(keyword) ||
           p.tags.some(tag => tag.toLowerCase().includes(keyword))
    )
  }
  
  return result
})

function isFavorite(productId: string): boolean {
  return userStore.user.favoriteProducts.includes(productId)
}

function toggleFavorite(productId: string): void {
  userStore.toggleFavoriteProduct(productId)
}

function goToDetail(productId: string): void {
  router.push(`/shop/${productId}`)
}

function goToCart(): void {
  router.push('/cart')
}
</script>

<style lang="scss" scoped>
.shop-page {
  padding-bottom: 80px;
  background: linear-gradient(180deg, #fff0f5 0%, #ffffff 100%);
  min-height: 100vh;
}

.shop-header {
  background: linear-gradient(135deg, #ff6b9d 0%, #c44569 50%, #8854d0 100%);
  padding: 30px 20px;
  color: white;
  text-align: center;

  h1 {
    font-size: 24px;
    margin-bottom: 8px;
    font-weight: 700;
  }

  p {
    font-size: 14px;
    opacity: 0.9;
  }
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 25px;
  padding: 10px 16px;
  gap: 8px;

  .search-icon {
    font-size: 16px;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    outline: none;

    &::placeholder {
      color: #999;
    }
  }
}

.cart-icon {
  position: relative;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;

  .cart-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: linear-gradient(135deg, #ff6b9d, #c44569);
    color: white;
    font-size: 11px;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
  }
}

.category-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  overflow-x: auto;
  border-bottom: 1px solid #f0f0f0;

  .tab-item {
    flex-shrink: 0;
    padding: 8px 16px;
    background: #f5f5f5;
    border-radius: 20px;
    font-size: 13px;
    color: #666;
    cursor: pointer;
    transition: all 0.3s;

    &.active {
      background: linear-gradient(135deg, #ff6b9d, #c44569);
      color: white;
    }

    &:hover:not(.active) {
      background: #ebebeb;
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

    &.low-stock {
      color: #ff6b6b;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  p {
    font-size: 14px;
    color: #999;
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
