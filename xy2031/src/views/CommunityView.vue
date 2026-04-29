<template>
  <div class="community-view pb-20 min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold flex-1 text-center">文创分享圈</h1>
        <button class="p-2" @click="showCreatePost = true">
          <Edit class="w-6 h-6 text-blue-500" />
        </button>
      </div>
    </div>

    <!-- 搜索和分类 -->
    <div class="bg-white px-4 py-3">
      <div class="flex gap-3">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            v-model="searchKeyword"
            placeholder="搜索帖子..."
            class="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="handleSearch"
          />
        </div>
      </div>
      <div class="flex gap-2 mt-3 overflow-x-auto pb-1">
        <button 
          v-for="tag in hotTags" 
          :key="tag"
          class="px-3 py-1 rounded-full text-xs whitespace-nowrap"
          :class="activeTag === tag ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'"
          @click="setActiveTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- 帖子列表 -->
    <div class="mt-3 space-y-3">
      <div 
        v-for="post in filteredPosts" 
        :key="post.id"
        class="bg-white mx-4 rounded-lg shadow-sm overflow-hidden"
        @click="goToPost(post.id)"
      >
        <!-- 用户信息 -->
        <div class="flex items-center gap-3 px-4 py-3">
          <img 
            :src="post.avatar" 
            :alt="post.username"
            class="w-10 h-10 rounded-full object-cover"
          />
          <div class="flex-1">
            <p class="font-medium text-sm">{{ post.username }}</p>
            <p class="text-xs text-gray-500">
              {{ post.location?.city || '未知' }} · {{ formatDate(post.createdAt) }}
            </p>
          </div>
          <button class="text-gray-400" @click.stop>
            <MoreHorizontal class="w-5 h-5" />
          </button>
        </div>

        <!-- 帖子内容 -->
        <div class="px-4 pb-3">
          <h3 class="font-medium text-gray-800 mb-2">{{ post.title }}</h3>
          <p class="text-sm text-gray-600 line-clamp-3">{{ post.content }}</p>
          
          <!-- 图片网格 -->
          <div v-if="post.images && post.images.length > 0" class="mt-3">
            <div 
              v-if="post.images.length === 1"
              class="relative"
            >
              <img 
                :src="post.images[0]" 
                class="w-full h-48 rounded-lg object-cover"
              />
            </div>
            <div 
              v-else-if="post.images.length === 2"
              class="grid grid-cols-2 gap-2"
            >
              <img 
                v-for="(img, idx) in post.images" 
                :key="idx"
                :src="img"
                class="w-full h-32 rounded-lg object-cover"
              />
            </div>
            <div 
              v-else-if="post.images.length >= 3"
              class="grid grid-cols-3 gap-2"
            >
              <div 
                v-for="(img, idx) in post.images.slice(0, 3)" 
                :key="idx"
                class="relative"
              >
                <img 
                  :src="img"
                  class="w-full h-24 rounded-lg object-cover"
                />
                <div 
                  v-if="idx === 2 && post.images.length > 3"
                  class="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center"
                >
                  <span class="text-white font-bold text-lg">+{{ post.images.length - 3 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 标签 -->
          <div v-if="post.tags && post.tags.length > 0" class="flex gap-2 mt-3 flex-wrap">
            <span 
              v-for="tag in post.tags" 
              :key="tag"
              class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
            >
              #{{ tag }}
            </span>
          </div>

          <!-- 互动按钮 -->
          <div class="flex items-center justify-between mt-4 pt-3 border-t">
            <button 
              class="flex items-center gap-1.5 text-gray-500 text-sm"
              :class="post.isLiked ? 'text-red-500' : ''"
              @click.stop="handleLike(post)"
            >
              <Heart :class="post.isLiked ? 'fill-current' : ''" class="w-5 h-5" />
              {{ post.likes }}
            </button>
            <button class="flex items-center gap-1.5 text-gray-500 text-sm">
              <MessageCircle class="w-5 h-5" />
              {{ post.comments.length }}
            </button>
            <button 
              class="flex items-center gap-1.5 text-gray-500 text-sm"
              @click.stop="handleShare(post)"
            >
              <Share2 class="w-5 h-5" />
              {{ post.shares }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredPosts.length === 0" class="flex flex-col items-center justify-center py-20">
      <MessageCircle class="w-20 h-20 text-gray-300" />
      <p class="text-gray-400 mt-4">暂无帖子</p>
      <button 
        @click="showCreatePost = true"
        class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-full text-sm"
      >
        发布帖子
      </button>
    </div>

    <!-- 发布帖子弹窗 -->
    <div v-if="showCreatePost" class="fixed inset-0 bg-black/50 z-50">
      <div class="absolute inset-0 bg-white">
        <!-- 顶部 -->
        <div class="sticky top-0 bg-white z-10 px-4 py-3 border-b flex items-center justify-between">
          <button @click="showCreatePost = false" class="text-gray-600">
            取消
          </button>
          <h2 class="font-bold">发布帖子</h2>
          <button 
            :disabled="!newPost.title || !newPost.content"
            class="px-4 py-1.5 rounded-full text-sm font-medium"
            :class="newPost.title && newPost.content ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'"
            @click="submitPost"
          >
            发布
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="p-4">
          <!-- 标题 -->
          <input 
            v-model="newPost.title"
            type="text"
            placeholder="写一个吸引人的标题..."
            class="w-full text-lg font-medium border-none focus:outline-none mb-4"
          />

          <!-- 内容 -->
          <textarea 
            v-model="newPost.content"
            placeholder="分享你的文创故事..."
            class="w-full text-sm border-none focus:outline-none resize-none"
            rows="8"
          ></textarea>

          <!-- 图片选择 -->
          <div class="mt-4">
            <div class="flex gap-2 flex-wrap">
              <div 
                v-for="(img, idx) in newPost.images" 
                :key="idx"
                class="relative w-20 h-20"
              >
                <img :src="img" class="w-full h-full rounded-lg object-cover" />
                <button 
                  class="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center"
                  @click="removeImage(idx)"
                >
                  <X class="w-3 h-3 text-white" />
                </button>
              </div>
              <button 
                v-if="newPost.images.length < 9"
                class="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center"
                @click="addImage"
              >
                <Plus class="w-6 h-6 text-gray-400" />
                <span class="text-xs text-gray-400 mt-1">添加图片</span>
              </button>
            </div>
          </div>

          <!-- 选择城市 -->
          <div class="mt-6">
            <h4 class="text-sm font-medium mb-2">选择城市</h4>
            <div class="flex gap-2 flex-wrap">
              <button 
                v-for="city in cities" 
                :key="city.id"
                class="px-3 py-1.5 rounded-full text-sm border"
                :class="newPost.location.city === city.name ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'"
                @click="selectCity(city)"
              >
                {{ city.name }}
              </button>
            </div>
          </div>

          <!-- 添加标签 -->
          <div class="mt-6">
            <h4 class="text-sm font-medium mb-2">添加标签</h4>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(tag, idx) in newPost.tags" 
                :key="idx"
                class="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full flex items-center gap-1"
              >
                #{{ tag }}
                <X class="w-4 h-4" @click="removeTag(idx)" />
              </span>
              <input 
                v-if="showTagInput"
                v-model="newTag"
                type="text"
                placeholder="输入标签"
                class="px-3 py-1 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keyup.enter="addTag"
                @blur="showTagInput = false"
              />
              <button 
                v-else
                class="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full flex items-center gap-1"
                @click="showTagInput = true"
              >
                <Plus class="w-4 h-4" />
                添加标签
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享弹窗 -->
    <div v-if="showShareModal" class="fixed inset-0 bg-black/50 z-50 flex items-end" @click="showShareModal = false">
      <div class="bg-white w-full rounded-t-2xl overflow-hidden" @click.stop>
        <div class="px-4 py-4">
          <h3 class="font-bold text-center mb-4">分享到</h3>
          <div class="grid grid-cols-4 gap-4">
            <div 
              v-for="item in shareOptions" 
              :key="item.name" 
              class="flex flex-col items-center cursor-pointer"
              @click="handleShareAction(item)"
            >
              <div class="w-12 h-12 rounded-full flex items-center justify-center" :style="{ backgroundColor: item.bgColor }">
                <component :is="item.icon" class="w-6 h-6 text-white" />
              </div>
              <span class="text-xs text-gray-600 mt-2">{{ item.name }}</span>
            </div>
          </div>
        </div>
        <button class="w-full py-4 border-t text-gray-600" @click="showShareModal = false">取消</button>
      </div>
    </div>

    <!-- 提示消息 -->
    <div 
      v-if="toast.show" 
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/75 text-white px-6 py-3 rounded-lg text-sm z-50"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Search, 
  Edit, 
  MoreHorizontal, 
  Heart, 
  MessageCircle, 
  Share2,
  Plus,
  X,
  MessageSquare,
  Send,
  ExternalLink
} from 'lucide-vue-next'
import { POSTS, searchPosts, likePost, createPost } from '@/data/posts'
import { PROVINCES } from '@/data/cities'

const router = useRouter()

const posts = ref([...POSTS])
const searchKeyword = ref('')
const activeTag = ref('全部')
const showCreatePost = ref(false)
const showShareModal = ref(false)
const selectedPost = ref(null)
const toast = ref({ show: false, message: '' })

const hotTags = ['全部', '故宫', '上海', '大理', '新疆', '文创', '美食']

const newPost = ref({
  title: '',
  content: '',
  images: [],
  location: { province: '', city: '', landmark: '' },
  tags: []
})
const showTagInput = ref(false)
const newTag = ref('')

const allCities = computed(() => {
  const cities = []
  PROVINCES.forEach(province => {
    province.cities.forEach(city => {
      cities.push({ ...city, provinceName: province.name })
    })
  })
  return cities
})

const cities = computed(() => allCities.value.slice(0, 6))

const shareOptions = [
  { name: '微信好友', icon: MessageSquare, bgColor: '#07C160' },
  { name: '朋友圈', icon: ExternalLink, bgColor: '#07C160' },
  { name: '微博', icon: Send, bgColor: '#E6162D' },
  { name: '复制链接', icon: ExternalLink, bgColor: '#666666' }
]

const filteredPosts = computed(() => {
  let result = posts.value
  
  if (activeTag.value !== '全部') {
    result = result.filter(p => p.tags?.includes(activeTag.value))
  }
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(p => 
      p.title.toLowerCase().includes(keyword) ||
      p.content.toLowerCase().includes(keyword) ||
      p.tags?.some(tag => tag.toLowerCase().includes(keyword))
    )
  }
  
  return result
})

function setActiveTag(tag) {
  activeTag.value = tag
}

function handleSearch() {
  // 搜索已通过 computed 自动过滤
}

function goToPost(postId) {
  router.push(`/post/${postId}`)
}

function handleLike(post) {
  const index = posts.value.findIndex(p => p.id === post.id)
  if (index !== -1) {
    posts.value[index].isLiked = !posts.value[index].isLiked
    posts.value[index].likes += posts.value[index].isLiked ? 1 : -1
  }
}

function handleShare(post) {
  selectedPost.value = post
  showShareModal.value = true
}

function selectCity(city) {
  newPost.value.location = {
    province: city.provinceName,
    city: city.name,
    landmark: ''
  }
}

function addImage() {
  const sampleImages = [
    'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400',
    'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=400',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'
  ]
  if (newPost.value.images.length < 9) {
    newPost.value.images.push(sampleImages[newPost.value.images.length % 3])
  }
}

function removeImage(index) {
  newPost.value.images.splice(index, 1)
}

function addTag() {
  if (newTag.value.trim() && !newPost.value.tags.includes(newTag.value.trim())) {
    newPost.value.tags.push(newTag.value.trim())
  }
  newTag.value = ''
  showTagInput.value = false
}

function removeTag(index) {
  newPost.value.tags.splice(index, 1)
}

function submitPost() {
  if (!newPost.value.title || !newPost.value.content) {
    showToast('请填写标题和内容')
    return
  }
  
  const post = createPost({
    title: newPost.value.title,
    content: newPost.value.content,
    images: newPost.value.images,
    location: newPost.value.location,
    tags: newPost.value.tags
  })
  
  posts.value.unshift(post)
  
  newPost.value = {
    title: '',
    content: '',
    images: [],
    location: { province: '', city: '', landmark: '' },
    tags: []
  }
  showCreatePost.value = false
  showToast('发布成功')
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

function handleShareAction(item) {
  if (item.name === '复制链接' && selectedPost.value) {
    const shareUrl = `${window.location.origin}/post/${selectedPost.value.id}`
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          showToast('链接已复制到剪贴板')
          showShareModal.value = false
        })
        .catch(() => {
          copyToClipboardFallback(shareUrl)
        })
    } else {
      copyToClipboardFallback(shareUrl)
    }
  } else {
    showToast(`${item.name}分享功能开发中`)
    showShareModal.value = false
  }
}

function copyToClipboardFallback(text) {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  try {
    document.execCommand('copy')
    showToast('链接已复制到剪贴板')
  } catch (err) {
    showToast('复制失败，请手动复制')
  }
  document.body.removeChild(textArea)
  showShareModal.value = false
}

function showToast(message) {
  toast.value = { show: true, message }
  setTimeout(() => {
    toast.value.show = false
  }, 2000)
}
</script>
