<template>
  <div class="post-detail-view pb-24 min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h1 class="text-lg font-bold flex-1 text-center">帖子详情</h1>
        <button class="text-gray-400">
          <MoreHorizontal class="w-6 h-6" />
        </button>
      </div>
    </div>

    <div v-if="post" class="bg-white">
      <!-- 用户信息 -->
      <div class="flex items-center gap-3 px-4 py-3">
        <img 
          :src="post.avatar" 
          :alt="post.username"
          class="w-12 h-12 rounded-full object-cover"
        />
        <div class="flex-1">
          <p class="font-medium">{{ post.username }}</p>
          <p class="text-xs text-gray-500">
            {{ post.location?.city || '未知' }} · {{ formatDate(post.createdAt) }}
          </p>
        </div>
        <button class="px-3 py-1 text-sm border border-blue-500 text-blue-500 rounded-full">
          关注
        </button>
      </div>

      <!-- 帖子内容 -->
      <div class="px-4 pb-4">
        <h2 class="text-lg font-bold mb-3">{{ post.title }}</h2>
        <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ post.content }}</p>
        
        <!-- 图片 -->
        <div v-if="post.images && post.images.length > 0" class="mt-4">
          <div 
            v-if="post.images.length === 1"
            class="relative"
          >
            <img 
              :src="post.images[0]" 
              class="w-full rounded-lg object-cover"
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
              class="w-full h-40 rounded-lg object-cover"
            />
          </div>
          <div 
            v-else
            class="grid grid-cols-3 gap-2"
          >
            <img 
              v-for="(img, idx) in post.images" 
              :key="idx"
              :src="img"
              class="w-full h-28 rounded-lg object-cover"
            />
          </div>
        </div>

        <!-- 标签 -->
        <div v-if="post.tags && post.tags.length > 0" class="flex gap-2 mt-4 flex-wrap">
          <span 
            v-for="tag in post.tags" 
            :key="tag"
            class="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full"
          >
            #{{ tag }}
          </span>
        </div>

        <!-- 互动数据 -->
        <div class="flex items-center justify-between mt-6 pt-4 border-t text-sm text-gray-500">
          <span>{{ post.likes }} 点赞</span>
          <span>{{ post.comments.length }} 评论</span>
          <span>{{ post.shares }} 分享</span>
        </div>
      </div>
    </div>

    <!-- 评论区 -->
    <div class="bg-white mt-3">
      <div class="px-4 py-3 border-b">
        <h3 class="font-bold">评论 ({{ post?.comments?.length || 0 }})</h3>
      </div>
      
      <!-- 评论列表 -->
      <div v-if="post?.comments?.length > 0" class="divide-y">
        <div 
          v-for="comment in post.comments" 
          :key="comment.id"
          class="px-4 py-3"
        >
          <div class="flex gap-3">
            <img 
              :src="comment.avatar" 
              :alt="comment.username"
              class="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="font-medium text-sm">{{ comment.username }}</span>
                <span class="text-xs text-gray-400">{{ formatDate(comment.createdAt) }}</span>
              </div>
              <p class="text-sm text-gray-700 mt-1">{{ comment.content }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <button class="flex items-center gap-1">
                  <Heart class="w-4 h-4" />
                  {{ comment.likes }}
                </button>
                <button class="flex items-center gap-1" @click="replyToComment(comment)">
                  <MessageCircle class="w-4 h-4" />
                  回复
                </button>
              </div>
              
              <!-- 回复 -->
              <div v-if="comment.replies && comment.replies.length > 0" class="mt-3 bg-gray-50 rounded-lg p-3">
                <div 
                  v-for="reply in comment.replies" 
                  :key="reply.id"
                  class="text-sm"
                >
                  <span class="text-blue-500 font-medium">{{ reply.username }}</span>
                  <span class="text-gray-500">：</span>
                  <span class="text-gray-700">{{ reply.content }}</span>
                  <p class="text-xs text-gray-400 mt-1">{{ formatDate(reply.createdAt) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-12">
        <MessageCircle class="w-12 h-12 text-gray-300" />
        <p class="text-gray-400 mt-2">暂无评论，快来抢沙发吧！</p>
      </div>
    </div>

    <!-- 底部评论输入框 -->
    <div class="fixed bottom-20 left-0 right-0 bg-white border-t px-4 py-3 z-50" :style="{ maxWidth: '480px', margin: '0 auto' }">
      <div class="flex items-center gap-3">
        <div class="flex-1 relative">
          <input 
            v-model="commentInput"
            type="text"
            :placeholder="replyTarget ? `回复 ${replyTarget.username}` : '写评论...'"
            class="w-full px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="submitComment"
          />
          <button v-if="replyTarget" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" @click="cancelReply">
            <X class="w-4 h-4" />
          </button>
        </div>
        <button 
          :disabled="!commentInput.trim()"
          class="px-4 py-2 rounded-full text-sm font-medium"
          :class="commentInput.trim() ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'"
          @click="submitComment"
        >
          发送
        </button>
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  MoreHorizontal, 
  Heart, 
  MessageCircle,
  X
} from 'lucide-vue-next'
import { getPostById, addComment, POSTS } from '@/data/posts'

const route = useRoute()
const router = useRouter()

const post = ref(null)
const commentInput = ref('')
const replyTarget = ref(null)
const toast = ref({ show: false, message: '' })

function loadPost() {
  const postId = route.params.postId
  post.value = getPostById(postId)
  if (!post.value) {
    showToast('帖子不存在')
  }
}

function goBack() {
  router.back()
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

function replyToComment(comment) {
  replyTarget.value = comment
  commentInput.value = ''
}

function cancelReply() {
  replyTarget.value = null
  commentInput.value = ''
}

function submitComment() {
  if (!commentInput.value.trim()) return
  
  const newComment = {
    userId: 'user_001',
    username: '旅行者',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    content: commentInput.value,
    replies: []
  }
  
  if (replyTarget.value) {
    const index = post.value.comments.findIndex(c => c.id === replyTarget.value.id)
    if (index !== -1) {
      if (!post.value.comments[index].replies) {
        post.value.comments[index].replies = []
      }
      post.value.comments[index].replies.push({
        id: `reply_${Date.now()}`,
        ...newComment
      })
    }
  } else {
    post.value.comments.push({
      id: `comment_${Date.now()}`,
      ...newComment
    })
  }
  
  commentInput.value = ''
  replyTarget.value = null
  showToast('评论成功')
}

function showToast(message) {
  toast.value = { show: true, message }
  setTimeout(() => {
    toast.value.show = false
  }, 2000)
}

onMounted(() => {
  loadPost()
})
</script>
