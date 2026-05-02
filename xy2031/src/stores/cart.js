import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCartStore = defineStore('cart', () => {
  const items = ref([
    {
      id: 'cart_001',
      productId: 'prod_001',
      name: '故宫文创冰箱贴',
      image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400',
      price: 29.9,
      originalPrice: 39.9,
      quantity: 2,
      selected: true,
      specs: {
        type: '冰箱贴',
        color: '红色',
        shape: '方形',
        size: '中号'
      }
    },
    {
      id: 'cart_002',
      productId: 'prod_005',
      name: '上海外滩夜景明信片',
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
      price: 15.0,
      originalPrice: 18.0,
      quantity: 1,
      selected: true,
      specs: {
        type: '明信片',
        color: '彩色',
        shape: '长方形',
        size: '标准'
      }
    }
  ])
  
  const cartCount = computed(() => {
    return items.value.reduce((total, item) => total + item.quantity, 0)
  })
  
  const selectedItems = computed(() => {
    return items.value.filter(item => item.selected)
  })
  
  const selectedCount = computed(() => {
    return selectedItems.value.reduce((total, item) => total + item.quantity, 0)
  })
  
  const totalPrice = computed(() => {
    return selectedItems.value.reduce((total, item) => total + item.price * item.quantity, 0)
  })
  
  const totalDiscount = computed(() => {
    return selectedItems.value.reduce((total, item) => {
      return total + (item.originalPrice - item.price) * item.quantity
    }, 0)
  })
  
  function addToCart(product, quantity = 1, specs = {}) {
    const existingItem = items.value.find(item => 
      item.productId === product.id && 
      JSON.stringify(item.specs) === JSON.stringify(specs)
    )
    
    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      const newItem = {
        id: `cart_${Date.now()}`,
        productId: product.id,
        name: product.name,
        image: product.images?.[0] || product.image,
        price: product.discountPrice || product.price,
        originalPrice: product.price,
        quantity,
        selected: true,
        specs
      }
      items.value.push(newItem)
    }
    
    saveToLocalStorage()
    return true
  }
  
  function removeFromCart(cartItemId) {
    const index = items.value.findIndex(item => item.id === cartItemId)
    if (index !== -1) {
      items.value.splice(index, 1)
      saveToLocalStorage()
    }
  }
  
  function updateQuantity(cartItemId, quantity) {
    const item = items.value.find(item => item.id === cartItemId)
    if (item) {
      item.quantity = Math.max(1, quantity)
      saveToLocalStorage()
    }
  }
  
  function toggleSelect(cartItemId) {
    const item = items.value.find(item => item.id === cartItemId)
    if (item) {
      item.selected = !item.selected
      saveToLocalStorage()
    }
  }
  
  function toggleSelectAll() {
    const allSelected = items.value.every(item => item.selected)
    items.value.forEach(item => {
      item.selected = !allSelected
    })
    saveToLocalStorage()
  }
  
  function clearSelectedItems() {
    items.value = items.value.filter(item => !item.selected)
    saveToLocalStorage()
  }
  
  function clearCart() {
    items.value = []
    saveToLocalStorage()
  }
  
  function saveToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(items.value))
  }
  
  function loadFromLocalStorage() {
    const saved = localStorage.getItem('cart')
    if (saved) {
      items.value = JSON.parse(saved)
    }
  }
  
  return {
    items,
    cartCount,
    selectedItems,
    selectedCount,
    totalPrice,
    totalDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    toggleSelect,
    toggleSelectAll,
    clearSelectedItems,
    clearCart,
    loadFromLocalStorage
  }
})
