import { defineStore } from 'pinia'
import type { User, CartItem, Order, Message } from '@/types'
import { mockUser, mockMessages } from '@/data/mockData'
import { ref, computed, watch } from 'vue'

const STORAGE_KEYS = {
  USER: 'esports_user',
  CART: 'esports_cart',
  ORDERS: 'esports_orders',
  MESSAGES: 'esports_messages'
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as T
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
  }
  return defaultValue
}

function saveToStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User>(loadFromStorage(STORAGE_KEYS.USER, mockUser))
  const cart = ref<CartItem[]>(loadFromStorage(STORAGE_KEYS.CART, []))
  const orders = ref<Order[]>(loadFromStorage(STORAGE_KEYS.ORDERS, []))
  const messages = ref<Message[]>(loadFromStorage(STORAGE_KEYS.MESSAGES, mockMessages))

  watch(user, (newValue) => {
    saveToStorage(STORAGE_KEYS.USER, newValue)
  }, { deep: true })

  watch(cart, (newValue) => {
    saveToStorage(STORAGE_KEYS.CART, newValue)
  }, { deep: true })

  watch(orders, (newValue) => {
    saveToStorage(STORAGE_KEYS.ORDERS, newValue)
  }, { deep: true })

  watch(messages, (newValue) => {
    saveToStorage(STORAGE_KEYS.MESSAGES, newValue)
  }, { deep: true })

  const cartCount = computed(() => {
    return cart.value.reduce((total, item) => total + item.quantity, 0)
  })

  const cartTotal = computed(() => {
    return cart.value
      .filter(item => item.selected)
      .reduce((total, item) => total + item.product.price * item.quantity, 0)
  })

  const selectedCartItems = computed(() => {
    return cart.value.filter(item => item.selected)
  })

  function setUser(newUser: User) {
    user.value = newUser
  }

  function addToCart(productId: string, product: any, quantity: number = 1) {
    const existingItem = cart.value.find(item => item.productId === productId)
    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      cart.value.push({
        productId,
        product,
        quantity,
        selected: true
      })
    }
  }

  function removeFromCart(productId: string) {
    const index = cart.value.findIndex(item => item.productId === productId)
    if (index > -1) {
      cart.value.splice(index, 1)
    }
  }

  function updateCartQuantity(productId: string, quantity: number) {
    const item = cart.value.find(item => item.productId === productId)
    if (item) {
      if (quantity <= 0) {
        removeFromCart(productId)
      } else {
        item.quantity = quantity
      }
    }
  }

  function toggleCartItemSelection(productId: string) {
    const item = cart.value.find(item => item.productId === productId)
    if (item) {
      item.selected = !item.selected
    }
  }

  function toggleAllCartItems(selected: boolean) {
    cart.value.forEach(item => {
      item.selected = selected
    })
  }

  function clearSelectedCartItems() {
    cart.value = cart.value.filter(item => !item.selected)
  }

  function addOrder(order: Order) {
    orders.value.unshift(order)
  }

  function addMessage(message: Message) {
    messages.value.unshift(message)
  }

  function toggleFavoriteProduct(productId: string) {
    const index = user.value.favoriteProducts.indexOf(productId)
    if (index > -1) {
      user.value.favoriteProducts.splice(index, 1)
    } else {
      user.value.favoriteProducts.push(productId)
    }
  }

  function toggleFavoritePlayer(playerId: string) {
    const index = user.value.favoritePlayers.indexOf(playerId)
    if (index > -1) {
      user.value.favoritePlayers.splice(index, 1)
    } else {
      user.value.favoritePlayers.push(playerId)
    }
  }

  function addPoints(amount: number) {
    user.value.points += amount
    while (user.value.points >= user.value.nextLevelPoints) {
      user.value.level++
      user.value.nextLevelPoints += 2000
    }
  }

  return {
    user,
    cart,
    orders,
    messages,
    cartCount,
    cartTotal,
    selectedCartItems,
    setUser,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    toggleCartItemSelection,
    toggleAllCartItems,
    clearSelectedCartItems,
    addOrder,
    addMessage,
    toggleFavoriteProduct,
    toggleFavoritePlayer,
    addPoints
  }
})
