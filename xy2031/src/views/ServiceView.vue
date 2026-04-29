<template>
  <div class="service-view pb-20 min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="sticky top-0 bg-white z-10 px-4 py-3 shadow-sm">
      <div class="flex items-center">
        <button @click="goBack" class="p-1">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <h1 class="text-lg font-bold flex-1 text-center">客服中心</h1>
        <div class="w-8"></div>
      </div>
    </div>

    <!-- 客服入口 -->
    <div class="bg-white mt-3 px-4 py-6">
      <div class="text-center">
        <div class="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Headphones class="w-10 h-10 text-blue-500" />
        </div>
        <h2 class="text-xl font-bold mb-2">需要帮助？</h2>
        <p class="text-gray-500 text-sm">我们随时为您提供帮助</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mt-6">
        <button 
          class="bg-blue-50 rounded-2xl p-4 flex flex-col items-center"
          @click="callService"
        >
          <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-2">
            <Phone class="w-6 h-6 text-white" />
          </div>
          <span class="font-medium text-sm">客服热线</span>
          <span class="text-xs text-gray-500 mt-1">400-123-4567</span>
        </button>
        
        <button 
          class="bg-green-50 rounded-2xl p-4 flex flex-col items-center"
          @click="startChat"
        >
          <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
            <MessageCircle class="w-6 h-6 text-white" />
          </div>
          <span class="font-medium text-sm">在线客服</span>
          <span class="text-xs text-gray-500 mt-1">即时沟通</span>
        </button>
      </div>
    </div>

    <!-- 常见问题 -->
    <div class="bg-white mt-3 px-4 py-4">
      <h3 class="font-bold mb-4">常见问题</h3>
      <div class="space-y-2">
        <div 
          v-for="(faq, index) in faqs" 
          :key="index"
          class="border rounded-lg overflow-hidden"
        >
          <button 
            class="w-full px-4 py-3 flex items-center justify-between text-left"
            @click="toggleFaq(index)"
          >
            <span class="font-medium text-sm">{{ faq.question }}</span>
            <ChevronDown 
              class="w-5 h-5 text-gray-400 transition-transform"
              :class="expandedFaqs.includes(index) ? 'rotate-180' : ''"
            />
          </button>
          <div 
            v-if="expandedFaqs.includes(index)"
            class="px-4 pb-3 text-sm text-gray-600 bg-gray-50"
          >
            {{ faq.answer }}
          </div>
        </div>
      </div>
    </div>

    <!-- 订单快捷操作 -->
    <div class="bg-white mt-3 px-4 py-4">
      <h3 class="font-bold mb-4">订单快捷操作</h3>
      <div class="grid grid-cols-4 gap-4">
        <router-link to="/orders" class="flex flex-col items-center">
          <div class="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-2">
            <Clock class="w-6 h-6 text-orange-500" />
          </div>
          <span class="text-xs text-gray-600">待支付</span>
        </router-link>
        <router-link to="/orders" class="flex flex-col items-center">
          <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
            <Package class="w-6 h-6 text-blue-500" />
          </div>
          <span class="text-xs text-gray-600">待发货</span>
        </router-link>
        <router-link to="/orders" class="flex flex-col items-center">
          <div class="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-2">
            <Truck class="w-6 h-6 text-purple-500" />
          </div>
          <span class="text-xs text-gray-600">已发货</span>
        </router-link>
        <router-link to="/orders" class="flex flex-col items-center">
          <div class="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-2">
            <Undo2 class="w-6 h-6 text-green-500" />
          </div>
          <span class="text-xs text-gray-600">退换货</span>
        </router-link>
      </div>
    </div>

    <!-- 工作时间 -->
    <div class="bg-white mt-3 px-4 py-4">
      <h3 class="font-bold mb-3">服务时间</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">在线客服</span>
          <span class="font-medium">09:00 - 22:00</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">客服热线</span>
          <span class="font-medium">09:00 - 18:00</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">售后服务</span>
          <span class="font-medium">09:00 - 21:00</span>
        </div>
      </div>
    </div>

    <!-- 联系方式 -->
    <div class="bg-white mt-3 px-4 py-4 mb-4">
      <h3 class="font-bold mb-3">其他联系方式</h3>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
            <Mail class="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p class="text-sm text-gray-500">邮箱</p>
            <p class="text-sm font-medium">service@tourculture.com</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
            <MessageCircle class="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p class="text-sm text-gray-500">微信公众号</p>
            <p class="text-sm font-medium">旅游文创官方</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
            <MapPin class="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p class="text-sm text-gray-500">公司地址</p>
            <p class="text-sm font-medium">北京市朝阳区建国路88号</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 在线聊天弹窗 -->
    <div v-if="showChatModal" class="fixed inset-0 bg-black/50 z-50">
      <div class="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl h-3/4 flex flex-col">
        <!-- 聊天头部 -->
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Bot class="w-6 h-6 text-white" />
            </div>
            <div>
              <p class="font-medium">智能客服</p>
              <p class="text-xs text-green-500">在线</p>
            </div>
          </div>
          <button @click="showChatModal = false" class="text-gray-400">
            <X class="w-6 h-6" />
          </button>
        </div>

        <!-- 聊天内容 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div 
            v-for="msg in chatMessages" 
            :key="msg.id"
            :class="['flex gap-3', msg.type === 'user' ? 'justify-end' : '']"
          >
            <template v-if="msg.type === 'bot'">
              <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot class="w-4 h-4 text-white" />
              </div>
              <div class="flex-1">
                <div class="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 inline-block max-w-xs">
                  <p class="text-sm whitespace-pre-wrap">{{ msg.content }}</p>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex-1 text-right">
                <div class="bg-blue-500 text-white rounded-2xl rounded-tr-none px-4 py-3 inline-block max-w-xs">
                  <p class="text-sm whitespace-pre-wrap">{{ msg.content }}</p>
                </div>
              </div>
              <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <User class="w-4 h-4 text-gray-500" />
              </div>
            </template>
          </div>
        </div>

        <!-- 快捷问题 -->
        <div class="px-4 py-2 border-t">
          <div class="flex gap-2 overflow-x-auto pb-1">
            <button 
              v-for="q in quickQuestions" 
              :key="q"
              class="px-3 py-1.5 bg-gray-100 rounded-full text-xs whitespace-nowrap"
              @click="sendQuickQuestion(q)"
            >
              {{ q }}
            </button>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="px-4 py-3 border-t">
          <div class="flex items-center gap-3">
            <input 
              v-model="chatInput"
              type="text"
              placeholder="输入消息..."
              class="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              @keyup.enter="sendMessage"
            />
            <button 
              class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center"
              @click="sendMessage"
            >
              <Send class="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  ChevronDown, 
  Headphones, 
  Phone, 
  MessageCircle,
  Clock,
  Package,
  Truck,
  Undo2,
  Mail,
  MapPin,
  Bot,
  User,
  X,
  Send
} from 'lucide-vue-next'

const router = useRouter()

const expandedFaqs = ref([0])
const showChatModal = ref(false)
const chatInput = ref('')
const toast = ref({ show: false, message: '' })

const chatMessages = ref([
  {
    id: 1,
    type: 'bot',
    content: '您好！我是智能客服小助手，有什么可以帮您的吗？',
    time: new Date()
  }
])

const faqs = [
  {
    question: '如何下单购买文创产品？',
    answer: '您可以在商城页面浏览喜欢的文创产品，点击商品查看详情后选择规格加入购物车，然后在购物车页面结算下单。也支持在商品详情页直接点击"立即购买"快速下单。'
  },
  {
    question: '定制文创产品需要多久能发货？',
    answer: '定制文创产品因为需要单独制作，一般需要3-5个工作日，具体时间根据定制内容的复杂程度可能有所不同。制作完成后会尽快为您发货，您可以在订单详情页查看实时物流信息。'
  },
  {
    question: '收到商品不满意可以退换吗？',
    answer: '我们支持7天无理由退换货（定制商品除外）。如果您收到的商品有质量问题，我们承担来回运费。非质量问题的退换货，需要您自行承担往返运费。定制商品由于是个性化制作，不支持7天无理由退换，如有质量问题请及时联系客服。'
  },
  {
    question: '如何查看订单物流信息？',
    answer: '您可以通过"我的-我的订单"进入订单列表，点击对应订单查看详情，在订单详情页可以看到完整的物流信息，包括快递公司、快递单号以及物流时间线。发货后我们也会通过短信通知您快递信息。'
  },
  {
    question: '积分如何获得和使用？',
    answer: '每消费1元可获得1积分，积分可以在积分商城兑换优惠券或文创产品，也可以在下单时抵扣现金（100积分=1元）。新用户注册还可以获得100积分奖励，完成任务也可获得额外积分。'
  }
]

const quickQuestions = [
  '如何退换货',
  '物流查询',
  '订单修改',
  '优惠券使用',
  '积分规则'
]

function goBack() {
  router.back()
}

function toggleFaq(index) {
  const idx = expandedFaqs.value.indexOf(index)
  if (idx > -1) {
    expandedFaqs.value.splice(idx, 1)
  } else {
    expandedFaqs.value.push(index)
  }
}

function callService() {
  showToast('正在拨打客服热线：400-123-4567')
}

function startChat() {
  showChatModal.value = true
}

function sendQuickQuestion(question) {
  chatInput.value = question
  sendMessage()
}

function sendMessage() {
  if (!chatInput.value.trim()) return
  
  const userMsg = {
    id: Date.now(),
    type: 'user',
    content: chatInput.value.trim(),
    time: new Date()
  }
  chatMessages.value.push(userMsg)
  
  const inputText = chatInput.value.trim()
  chatInput.value = ''
  
  setTimeout(() => {
    let botReply = ''
    
    if (inputText.includes('退货') || inputText.includes('退换')) {
      botReply = '您好，退货流程如下：\n1. 在"我的订单"中找到需要退货的订单\n2. 点击"申请退货"按钮\n3. 填写退货原因并提交\n4. 等待客服审核（一般1-2个工作日）\n5. 审核通过后按照提示寄回商品\n\n如有其他问题，请随时告诉我！'
    } else if (inputText.includes('物流') || inputText.includes('快递') || inputText.includes('发货')) {
      botReply = '您好，您可以通过以下方式查询物流：\n1. 进入"我的订单"\n2. 点击对应订单查看详情\n3. 在订单详情页可以看到完整的物流信息\n\n发货后我们也会通过短信通知您快递单号。'
    } else if (inputText.includes('订单') || inputText.includes('修改')) {
      botReply = '您好，订单修改规则如下：\n- 未支付订单：可以直接取消重下单\n- 已支付未发货：可以联系客服修改地址/规格\n- 已发货订单：暂不支持修改，可拒收后重新下单\n\n如需帮助，请拨打客服热线 400-123-4567'
    } else if (inputText.includes('优惠') || inputText.includes('券') || inputText.includes('折扣')) {
      botReply = '您好，优惠券使用规则：\n1. 每张订单只能使用一张优惠券\n2. 优惠券有使用期限，请在有效期内使用\n3. 部分商品不支持优惠券\n\n您可以在"我的-优惠券"中查看所有可用优惠券。'
    } else if (inputText.includes('积分')) {
      botReply = '您好，积分规则如下：\n- 每消费1元获得1积分\n- 100积分=1元（可抵扣现金）\n- 新用户注册送100积分\n- 积分可在积分商城兑换优惠券或礼品\n\n您可以在"我的-积分商城"查看更多信息。'
    } else if (inputText.includes('你好') || inputText.includes('您好') || inputText.includes('hi')) {
      botReply = '您好！我是智能客服小助手，请问有什么可以帮您的吗？\n\n您可以点击下方快捷问题，或者直接输入：\n- 如何退换货\n- 物流查询\n- 订单修改\n- 优惠券使用\n- 积分规则'
    } else {
      botReply = '您好，我理解您的问题。如果以上快捷问题没有解决您的疑问，您可以：\n\n1. 拨打客服热线：400-123-4567（工作时间 09:00-18:00）\n2. 或留下您的问题，我们会尽快安排人工客服回复您。\n\n感谢您的理解！'
    }
    
    const botMsg = {
      id: Date.now() + 1,
      type: 'bot',
      content: botReply,
      time: new Date()
    }
    chatMessages.value.push(botMsg)
  }, 800)
}

function showToast(message) {
  toast.value = { show: true, message }
  setTimeout(() => {
    toast.value.show = false
  }, 2000)
}
</script>
