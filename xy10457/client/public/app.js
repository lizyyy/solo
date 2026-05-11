const { createApp, ref, reactive, computed, onMounted, watch } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

const API_BASE = 'http://localhost:3000/api';

const statusMap = {
  pending: { text: '待处理', icon: 'bi-clock', color: 'warning' },
  return_received: { text: '已退回', icon: 'bi-box-arrow-in-down', color: 'info' },
  quality_passed: { text: '质检通过', icon: 'bi-check-circle', color: 'success' },
  quality_failed: { text: '质检失败', icon: 'bi-x-circle', color: 'danger' },
  difference_paid: { text: '已补差价', icon: 'bi-cash-stack', color: 'secondary' },
  difference_refunded: { text: '已退差价', icon: 'bi-reply', color: 'secondary' },
  shipped: { text: '已发货', icon: 'bi-truck', color: 'info' },
  completed: { text: '已完成', icon: 'bi-check2-circle', color: 'success' },
  cancelled: { text: '已取消', icon: 'bi-x-octagon', color: 'danger' }
};

async function apiCall(url, options = {}) {
  try {
    const response = await fetch(API_BASE + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return await response.json();
  } catch (error) {
    return { success: false, message: '网络错误：' + error.message };
  }
}

const ExchangeList = {
  template: `
    <div>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-list-ul me-2"></i>换货申请列表</h2>
        <router-link to="/create" class="btn btn-primary">
          <i class="bi bi-plus-lg me-1"></i>新建换货申请
        </router-link>
      </div>
      
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">状态筛选</label>
              <select v-model="filterStatus" class="form-select">
                <option value="">全部状态</option>
                <option v-for="(info, key) in statusMap" :key="key" :value="key">
                  {{ info.text }}
                </option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">订单号搜索</label>
              <input v-model="searchOrderId" type="text" class="form-control" placeholder="输入订单号">
            </div>
            <div class="col-md-3">
              <label class="form-label">客户搜索</label>
              <input v-model="searchCustomer" type="text" class="form-control" placeholder="客户姓名/电话">
            </div>
            <div class="col-md-3 d-flex align-items-end">
              <button @click="loadExchanges" class="btn btn-outline-primary w-100">
                <i class="bi bi-search me-1"></i>搜索
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body p-0">
          <div v-if="exchanges.length === 0" class="text-center py-5 text-muted">
            <i class="bi bi-inbox display-4"></i>
            <p class="mt-2">暂无换货申请</p>
          </div>
          <table v-else class="table table-hover mb-0">
            <thead>
              <tr>
                <th>换货单号</th>
                <th>原订单</th>
                <th>客户</th>
                <th>商品</th>
                <th>尺码变更</th>
                <th>差价</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exchange in filteredExchanges" :key="exchange.id">
                <td class="fw-bold">{{ exchange.id }}</td>
                <td>{{ exchange.orderId }}</td>
                <td>
                  {{ exchange.customerName }}<br>
                  <small class="text-muted">{{ exchange.customerPhone }}</small>
                </td>
                <td>{{ exchange.originalProduct }}</td>
                <td>
                  <span class="text-muted">{{ exchange.originalSize }}</span>
                  <i class="bi bi-arrow-right mx-1"></i>
                  <span class="fw-bold">{{ exchange.targetSize }}</span>
                </td>
                <td>
                  <span v-if="exchange.priceDifference > 0" class="difference-positive">
                    +¥{{ exchange.priceDifference.toFixed(2) }}
                  </span>
                  <span v-else-if="exchange.priceDifference < 0" class="difference-negative">
                    -¥{{ Math.abs(exchange.priceDifference).toFixed(2) }}
                  </span>
                  <span v-else class="text-muted">¥0.00</span>
                </td>
                <td>
                  <span :class="['status-badge', 'status-' + exchange.status]">
                    {{ statusMap[exchange.status]?.text }}
                  </span>
                </td>
                <td>{{ formatDate(exchange.createdAt) }}</td>
                <td>
                  <router-link :to="'/exchange/' + exchange.id" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-eye me-1"></i>处理
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  setup() {
    const exchanges = ref([]);
    const filterStatus = ref('');
    const searchOrderId = ref('');
    const searchCustomer = ref('');
    
    const filteredExchanges = computed(() => {
      return exchanges.value.filter(e => {
        if (filterStatus.value && e.status !== filterStatus.value) return false;
        if (searchOrderId.value && !e.orderId.includes(searchOrderId.value)) return false;
        if (searchCustomer.value && !e.customerName.includes(searchCustomer.value) && !e.customerPhone.includes(searchCustomer.value)) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });
    
    async function loadExchanges() {
      const result = await apiCall('/exchanges');
      if (result.success) {
        exchanges.value = result.data;
      }
    }
    
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadExchanges();
    });
    
    return {
      exchanges,
      filterStatus,
      searchOrderId,
      searchCustomer,
      filteredExchanges,
      statusMap,
      loadExchanges,
      formatDate
    };
  }
};

const CreateExchange = {
  template: `
    <div>
      <h2 class="mb-4"><i class="bi bi-plus-circle me-2"></i>新建换货申请</h2>
      
      <div class="row">
        <div class="col-lg-8">
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-receipt me-1"></i>选择订单
            </div>
            <div class="card-body">
              <div class="input-group mb-3">
                <input v-model="orderSearch" type="text" class="form-control" placeholder="输入订单号搜索">
                <button @click="searchOrders" class="btn btn-outline-primary">
                  <i class="bi bi-search"></i>
                </button>
              </div>
              
              <div v-if="orderSearch && !selectedOrder" class="mb-3">
                <div v-if="searchingOrders" class="text-center py-3">
                  <div class="spinner-border spinner-border-sm text-primary"></div>
                </div>
                <div v-else-if="searchedOrders.length === 0" class="alert alert-warning">
                  未找到订单
                </div>
                <div v-else class="list-group">
                  <div v-for="order in searchedOrders" :key="order.id" 
                       class="list-group-item list-group-item-action"
                       @click="selectOrder(order)"
                       style="cursor: pointer;">
                    <div class="d-flex justify-content-between">
                      <strong>{{ order.id }}</strong>
                      <span :class="order.status === 'completed' ? 'text-success' : 'text-warning'">
                        {{ order.status === 'completed' ? '已完成' : '处理中' }}
                      </span>
                    </div>
                    <small class="text-muted">
                      {{ order.customerName }} - {{ formatDate(order.orderDate) }}
                    </small>
                  </div>
                </div>
              </div>
              
              <div v-if="selectedOrder" class="border rounded p-3 bg-light">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h6 class="fw-bold">{{ selectedOrder.id }}</h6>
                    <p class="mb-1">{{ selectedOrder.customerName }} ({{ selectedOrder.customerPhone }})</p>
                    <small class="text-muted">{{ selectedOrder.shippingAddress }}</small>
                  </div>
                  <button @click="selectedOrder = null; selectedItem = null" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>
                <div class="row g-3">
                  <div v-for="item in selectedOrder.items" :key="item.id" 
                       class="col-md-6"
                       :class="{ 'border-primary': selectedItem?.id === item.id }"
                       style="cursor: pointer; border: 2px solid transparent; border-radius: 8px; padding: 12px; background: white;"
                       @click="selectItem(item)">
                    <div class="d-flex justify-content-between">
                      <strong>{{ item.productName }}</strong>
                      <span class="fw-bold">¥{{ item.price }}</span>
                    </div>
                    <small class="text-muted">
                      尺码: {{ item.size }} | 颜色: {{ item.color }} | 数量: {{ item.quantity }}
                    </small>
                    <div v-if="selectedItem?.id === item.id" class="mt-2 text-primary">
                      <i class="bi bi-check-circle-fill"></i> 已选择
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="selectedItem" class="card mb-4">
            <div class="card-header">
              <i class="bi bi-arrows-angle-expand me-1"></i>选择目标尺码
            </div>
            <div class="card-body">
              <div class="size-compare mb-4">
                <div class="size-item size-original">
                  <div class="text-muted small">原尺码</div>
                  <div class="fw-bold fs-4">{{ selectedItem.size }}</div>
                  <div class="text-muted small">{{ selectedItem.color }}</div>
                  <div class="mt-2">¥{{ selectedItem.price }}</div>
                </div>
                <i class="bi bi-arrow-right arrow-icon"></i>
                <div class="size-item size-target">
                  <div class="text-muted small">目标尺码</div>
                  <div class="fw-bold fs-4">{{ targetSize || '请选择' }}</div>
                  <div class="text-muted small">{{ targetColor || '请选择' }}</div>
                  <div class="mt-2">¥{{ targetPrice || '--' }}</div>
                </div>
              </div>
              
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">目标尺码 <span class="text-danger">*</span></label>
                  <select v-model="targetSize" class="form-select" @change="checkInventory">
                    <option value="">请选择尺码</option>
                    <option v-for="size in availableSizes" :key="size" :value="size">
                      {{ size }}
                    </option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">目标颜色 <span class="text-danger">*</span></label>
                  <select v-model="targetColor" class="form-select" @change="checkInventory">
                    <option value="">请选择颜色</option>
                    <option v-for="color in availableColors" :key="color" :value="color">
                      {{ color }}
                    </option>
                  </select>
                </div>
              </div>
              
              <div v-if="targetSize && targetColor" class="mt-3">
                <div v-if="inventoryCheck.available" class="alert alert-success">
                  <i class="bi bi-check-circle-fill me-2"></i>
                  库存充足 ({{ inventoryCheck.quantity }}件)，价格: ¥{{ inventoryCheck.price }}
                </div>
                <div v-else class="alert alert-danger">
                  <i class="bi bi-x-circle-fill me-2"></i>
                  库存不足！该尺码颜色暂无库存
                </div>
              </div>
              
              <div v-if="targetSize && targetColor && inventoryCheck.available" class="mt-3">
                <label class="form-label">换货原因</label>
                <textarea v-model="reason" class="form-control" rows="2" placeholder="请输入换货原因..."></textarea>
              </div>
            </div>
          </div>
          
          <div v-if="selectedItem && targetSize && targetColor && inventoryCheck.available" class="card mb-4">
            <div class="card-header">
              <i class="bi bi-calculator me-1"></i>费用明细
            </div>
            <div class="card-body">
              <table class="table table-borderless">
                <tr>
                  <td class="text-muted">原商品价格</td>
                  <td class="text-end">¥{{ selectedItem.price.toFixed(2) }}</td>
                </tr>
                <tr>
                  <td class="text-muted">新商品价格</td>
                  <td class="text-end">¥{{ targetPrice.toFixed(2) }}</td>
                </tr>
                <tr class="border-top">
                  <td class="fw-bold">
                    差价
                    <span v-if="priceDifference > 0" class="text-danger">(需补)</span>
                    <span v-else-if="priceDifference < 0" class="text-success">(需退)</span>
                  </td>
                  <td class="text-end fw-bold">
                    <span v-if="priceDifference > 0" class="difference-positive">
                      +¥{{ priceDifference.toFixed(2) }}
                    </span>
                    <span v-else-if="priceDifference < 0" class="difference-negative">
                      -¥{{ Math.abs(priceDifference).toFixed(2) }}
                    </span>
                    <span v-else>¥0.00</span>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          
          <div v-if="selectedItem && targetSize && targetColor && inventoryCheck.available" class="d-grid">
            <button @click="submitExchange" :disabled="submitting" class="btn btn-primary btn-lg">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
              <i class="bi bi-send me-1"></i>提交换货申请
            </button>
          </div>
        </div>
        
        <div class="col-lg-4">
          <div class="card">
            <div class="card-header">
              <i class="bi bi-lightbulb me-1"></i>操作提示
            </div>
            <div class="card-body">
              <div class="alert alert-info">
                <strong>注意事项：</strong>
                <ul class="mb-0 mt-2">
                  <li>同一订单商品只能有一个进行中的换货申请</li>
                  <li>目标尺码必须有库存才能创建申请</li>
                  <li>差价将在质检通过后处理</li>
                  <li>请确认客户已了解换货流程</li>
                </ul>
              </div>
              
              <h6 class="fw-bold mt-4">换货流程</h6>
              <div class="timeline mt-3">
                <div class="timeline-item">
                  <div class="fw-bold">1. 创建申请</div>
                  <div class="text-muted small">选择订单和目标尺码</div>
                </div>
                <div class="timeline-item">
                  <div class="fw-bold">2. 客户退回</div>
                  <div class="text-muted small">登记退回物流单号</div>
                </div>
                <div class="timeline-item">
                  <div class="fw-bold">3. 质量检验</div>
                  <div class="text-muted small">检查退回商品状态</div>
                </div>
                <div class="timeline-item">
                  <div class="fw-bold">4. 差价处理</div>
                  <div class="text-muted small">补差或退差</div>
                </div>
                <div class="timeline-item">
                  <div class="fw-bold">5. 发出新货</div>
                  <div class="text-muted small">登记新物流单号</div>
                </div>
                <div class="timeline-item">
                  <div class="fw-bold">6. 完成</div>
                  <div class="text-muted small">客户签收确认</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const router = VueRouter.useRouter();
    const { showNotification } = Vue.inject('notification');
    
    const orderSearch = ref('');
    const selectedOrder = ref(null);
    const selectedItem = ref(null);
    const searchedOrders = ref([]);
    const searchingOrders = ref(false);
    const targetSize = ref('');
    const targetColor = ref('');
    const reason = ref('尺码不合适');
    const inventoryCheck = reactive({ available: false, quantity: 0, price: 0 });
    const targetPrice = ref(0);
    const submitting = ref(false);
    
    const availableSizes = computed(() => {
      if (!selectedItem.value) return [];
      const baseSizes = ['S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44'];
      return baseSizes.filter(s => s !== selectedItem.value.size);
    });
    
    const availableColors = computed(() => {
      return ['白色', '黑色', '灰色', '藏青', '卡其', '蓝色'];
    });
    
    const priceDifference = computed(() => {
      if (!selectedItem.value || !targetPrice.value) return 0;
      return targetPrice.value - selectedItem.value.price;
    });
    
    async function searchOrders() {
      if (!orderSearch.value) return;
      searchingOrders.value = true;
      const result = await apiCall('/orders');
      if (result.success) {
        searchedOrders.value = result.data.filter(o => 
          o.id.toLowerCase().includes(orderSearch.value.toLowerCase())
        );
      }
      searchingOrders.value = false;
    }
    
    function selectOrder(order) {
      selectedOrder.value = order;
      selectedItem.value = null;
      targetSize.value = '';
      targetColor.value = '';
    }
    
    function selectItem(item) {
      selectedItem.value = item;
      targetSize.value = '';
      targetColor.value = '';
      inventoryCheck.available = false;
    }
    
    async function checkInventory() {
      if (!selectedItem.value || !targetSize.value || !targetColor.value) {
        inventoryCheck.available = false;
        return;
      }
      
      const result = await apiCall(
        `/inventory/check?productId=${selectedItem.value.productId}&size=${targetSize.value}&color=${targetColor.value}`
      );
      
      if (result.success) {
        inventoryCheck.available = result.data.available;
        inventoryCheck.quantity = result.data.quantity;
        inventoryCheck.price = result.data.price;
        targetPrice.value = result.data.price;
      }
    }
    
    async function submitExchange() {
      if (!selectedItem.value || !targetSize.value || !targetColor.value) {
        showNotification('请完善所有必填项', 'error');
        return;
      }
      
      submitting.value = true;
      const result = await apiCall('/exchanges', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selectedOrder.value.id,
          orderItemId: selectedItem.value.id,
          targetSize: targetSize.value,
          targetColor: targetColor.value,
          reason: reason.value,
          operator: '客服'
        })
      });
      
      submitting.value = false;
      
      if (result.success) {
        showNotification('换货申请创建成功！单号：' + result.data.id, 'success');
        router.push('/exchange/' + result.data.id);
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleString('zh-CN');
    }
    
    return {
      orderSearch,
      selectedOrder,
      selectedItem,
      searchedOrders,
      searchingOrders,
      targetSize,
      targetColor,
      reason,
      inventoryCheck,
      targetPrice,
      submitting,
      availableSizes,
      availableColors,
      priceDifference,
      searchOrders,
      selectOrder,
      selectItem,
      checkInventory,
      submitExchange,
      formatDate
    };
  }
};

const ExchangeDetail = {
  template: `
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">加载中...</p>
    </div>
    
    <div v-else-if="!exchange" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      换货申请不存在
    </div>
    
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>
            <i class="bi bi-file-earmark-text me-2"></i>
            换货详情
            <span class="fs-5 text-muted ms-2">{{ exchange.id }}</span>
          </h2>
          <span :class="['status-badge', 'status-' + exchange.status]">
            {{ statusMap[exchange.status]?.text }}
          </span>
        </div>
        <router-link to="/" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>返回列表
        </router-link>
      </div>
      
      <div class="progress-step">
        <div :class="['step-item', { completed: currentStep >= 1, active: currentStep === 1 }]">
          <div class="step-circle"><i class="bi bi-file-earmark-plus"></i></div>
          <div class="step-label">创建申请</div>
        </div>
        <div :class="['step-item', { completed: currentStep >= 2, active: currentStep === 2 }]">
          <div class="step-circle"><i class="bi bi-box-arrow-in-down"></i></div>
          <div class="step-label">客户退回</div>
        </div>
        <div :class="['step-item', { completed: currentStep >= 3, active: currentStep === 3 }]">
          <div class="step-circle"><i class="bi bi-shield-check"></i></div>
          <div class="step-label">质量检验</div>
        </div>
        <div :class="['step-item', { completed: currentStep >= 4, active: currentStep === 4 }]">
          <div class="step-circle"><i class="bi bi-cash-stack"></i></div>
          <div class="step-label">差价处理</div>
        </div>
        <div :class="['step-item', { completed: currentStep >= 5, active: currentStep === 5 }]">
          <div class="step-circle"><i class="bi bi-truck"></i></div>
          <div class="step-label">发出新货</div>
        </div>
        <div :class="['step-item', { completed: currentStep >= 6, active: currentStep === 6 }]">
          <div class="step-circle"><i class="bi bi-check2-circle"></i></div>
          <div class="step-label">完成</div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-lg-8">
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-info-circle me-1"></i>基本信息
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <p class="mb-2"><strong>原订单号：</strong>{{ exchange.orderId }}</p>
                  <p class="mb-2"><strong>客户姓名：</strong>{{ exchange.customerName }}</p>
                  <p class="mb-2"><strong>联系电话：</strong>{{ exchange.customerPhone }}</p>
                  <p class="mb-2"><strong>换货原因：</strong>{{ exchange.reason }}</p>
                </div>
                <div class="col-md-6">
                  <p class="mb-2"><strong>创建时间：</strong>{{ formatDate(exchange.createdAt) }}</p>
                  <p class="mb-2"><strong>更新时间：</strong>{{ formatDate(exchange.updatedAt) }}</p>
                  <p v-if="order" class="mb-2">
                    <strong>收货地址：</strong>{{ order.shippingAddress }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-arrow-left-right me-1"></i>尺码变更对比
            </div>
            <div class="card-body">
              <div class="size-compare">
                <div class="size-item size-original">
                  <div class="text-muted small mb-1">原商品</div>
                  <div class="fw-bold">{{ exchange.originalProduct }}</div>
                  <div class="mt-2">
                    <span class="badge bg-secondary me-1">尺码</span>
                    <span class="fw-bold">{{ exchange.originalSize }}</span>
                  </div>
                  <div class="mt-1">
                    <span class="badge bg-secondary me-1">颜色</span>
                    <span>{{ exchange.originalColor }}</span>
                  </div>
                  <div class="mt-2 fw-bold text-primary">¥{{ exchange.originalPrice }}</div>
                </div>
                <div class="arrow-icon"><i class="bi bi-arrow-right"></i></div>
                <div class="size-item size-target">
                  <div class="text-muted small mb-1">新商品</div>
                  <div class="fw-bold">{{ exchange.targetProductName }}</div>
                  <div class="mt-2">
                    <span class="badge bg-primary me-1">尺码</span>
                    <span class="fw-bold">{{ exchange.targetSize }}</span>
                  </div>
                  <div class="mt-1">
                    <span class="badge bg-primary me-1">颜色</span>
                    <span>{{ exchange.targetColor }}</span>
                  </div>
                  <div class="mt-2 fw-bold text-primary">¥{{ exchange.targetPrice }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-calculator me-1"></i>费用明细
            </div>
            <div class="card-body">
              <table class="table">
                <tr>
                  <td class="text-muted">原商品价格</td>
                  <td class="text-end">¥{{ exchange.originalPrice.toFixed(2) }}</td>
                </tr>
                <tr>
                  <td class="text-muted">新商品价格</td>
                  <td class="text-end">¥{{ exchange.targetPrice.toFixed(2) }}</td>
                </tr>
                <tr class="border-top">
                  <td class="fw-bold">
                    差价
                    <span v-if="exchange.priceDifference > 0" class="badge bg-danger ms-2">需补</span>
                    <span v-else-if="exchange.priceDifference < 0" class="badge bg-success ms-2">需退</span>
                    <span v-else class="badge bg-secondary ms-2">无差价</span>
                  </td>
                  <td class="text-end fw-bold">
                    <span v-if="exchange.priceDifference > 0" class="difference-positive">
                      +¥{{ exchange.priceDifference.toFixed(2) }}
                    </span>
                    <span v-else-if="exchange.priceDifference < 0" class="difference-negative">
                      -¥{{ Math.abs(exchange.priceDifference).toFixed(2) }}
                    </span>
                    <span v-else>¥0.00</span>
                  </td>
                </tr>
                <tr v-if="exchange.differenceHandled">
                  <td class="text-success">
                    <i class="bi bi-check-circle-fill me-1"></i>差价已处理
                  </td>
                  <td class="text-end text-success fw-bold">已完成</td>
                </tr>
              </table>
            </div>
          </div>
          
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-geo-alt me-1"></i>物流信息
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">
                    <i class="bi bi-box-arrow-in-down me-1"></i>退回物流
                  </h6>
                  <div v-if="exchange.returnTrackingNumber">
                    <p class="mb-1"><strong>物流公司：</strong>{{ exchange.returnCarrier }}</p>
                    <p class="mb-0"><strong>物流单号：</strong>{{ exchange.returnTrackingNumber }}</p>
                  </div>
                  <div v-else class="text-muted">
                    <i class="bi bi-clock me-1"></i>待客户退回
                  </div>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">
                    <i class="bi bi-box-arrow-up me-1"></i>发出物流
                  </h6>
                  <div v-if="exchange.newOrderTrackingNumber">
                    <p class="mb-1"><strong>物流公司：</strong>{{ exchange.newOrderCarrier }}</p>
                    <p class="mb-0"><strong>物流单号：</strong>{{ exchange.newOrderTrackingNumber }}</p>
                  </div>
                  <div v-else class="text-muted">
                    <i class="bi bi-clock me-1"></i>待发出
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="exchange.qualityResult !== null" class="card mb-4">
            <div class="card-header">
              <i class="bi bi-shield-check me-1"></i>质检结果
            </div>
            <div class="card-body">
              <div :class="exchange.qualityResult ? 'alert alert-success' : 'alert alert-danger'">
                <i :class="exchange.qualityResult ? 'bi bi-check-circle-fill' : 'bi bi-x-circle-fill'" class="me-2"></i>
                <strong>{{ exchange.qualityResult ? '质检通过' : '质检不通过' }}</strong>
              </div>
              <div v-if="exchange.qualityNotes">
                <strong>质检备注：</strong>{{ exchange.qualityNotes }}
              </div>
            </div>
          </div>
          
          <div class="card mb-4" v-if="showActionPanel">
            <div class="card-header">
              <i class="bi bi-tools me-1"></i>客服处理
            </div>
            <div class="card-body">
              <div v-if="exchange.status === 'pending'">
                <h6 class="fw-bold mb-3">登记退回物流</h6>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">物流公司</label>
                    <input v-model="returnForm.carrier" type="text" class="form-control" placeholder="如：顺丰、圆通">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">物流单号</label>
                    <input v-model="returnForm.trackingNumber" type="text" class="form-control" placeholder="输入单号">
                  </div>
                  <div class="col-12">
                    <button @click="registerReturn" :disabled="processing" class="btn btn-primary">
                      <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
                      <i class="bi bi-save me-1"></i>确认登记
                    </button>
                  </div>
                </div>
              </div>
              
              <div v-if="exchange.status === 'return_received'">
                <h6 class="fw-bold mb-3">质量检验</h6>
                <div class="mb-3">
                  <label class="form-label">检验结果</label>
                  <div class="d-flex gap-4">
                    <div class="form-check">
                      <input v-model="qualityForm.result" type="radio" name="quality" :value="true" class="form-check-input" id="pass">
                      <label class="form-check-label text-success fw-bold" for="pass">
                        <i class="bi bi-check-circle me-1"></i>质检通过
                      </label>
                    </div>
                    <div class="form-check">
                      <input v-model="qualityForm.result" type="radio" name="quality" :value="false" class="form-check-input" id="fail">
                      <label class="form-check-label text-danger fw-bold" for="fail">
                        <i class="bi bi-x-circle me-1"></i>质检不通过
                      </label>
                    </div>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">质检备注</label>
                  <textarea v-model="qualityForm.notes" class="form-control" rows="2" placeholder="可选，输入质检说明"></textarea>
                </div>
                <button @click="submitQuality" :disabled="processing || qualityForm.result === null" class="btn btn-primary">
                  <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
                  <i class="bi bi-check2 me-1"></i>提交质检结果
                </button>
              </div>
              
              <div v-if="exchange.status === 'quality_passed'">
                <h6 class="fw-bold mb-3">处理差价</h6>
                <div class="alert" :class="exchange.priceDifference > 0 ? 'alert-warning' : exchange.priceDifference < 0 ? 'alert-info' : 'alert-secondary'">
                  <p v-if="exchange.priceDifference > 0">
                    客户需要补差价 <strong class="text-danger">¥{{ exchange.priceDifference.toFixed(2) }}</strong>
                  </p>
                  <p v-else-if="exchange.priceDifference < 0">
                    需要退还客户差价 <strong class="text-success">¥{{ Math.abs(exchange.priceDifference).toFixed(2) }}</strong>
                  </p>
                  <p v-else>
                    无差价，直接确认
                  </p>
                </div>
                <button @click="handleDifference" :disabled="processing" class="btn btn-primary">
                  <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
                  <i class="bi bi-check2 me-1"></i>确认处理
                </button>
              </div>
              
              <div v-if="exchange.status === 'difference_paid' || exchange.status === 'difference_refunded'">
                <h6 class="fw-bold mb-3">发出新货</h6>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">物流公司</label>
                    <input v-model="shipForm.carrier" type="text" class="form-control" placeholder="如：顺丰、圆通">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">物流单号</label>
                    <input v-model="shipForm.trackingNumber" type="text" class="form-control" placeholder="输入单号">
                  </div>
                  <div class="col-12">
                    <button @click="shipNewOrder" :disabled="processing" class="btn btn-primary">
                      <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
                      <i class="bi bi-truck me-1"></i>确认发货
                    </button>
                  </div>
                </div>
              </div>
              
              <div v-if="exchange.status === 'shipped'">
                <h6 class="fw-bold mb-3">完成换货</h6>
                <div class="alert alert-info">
                  <i class="bi bi-info-circle me-2"></i>
                  确认客户已收到新商品后，点击完成按钮结束换货流程
                </div>
                <button @click="completeExchange" :disabled="processing" class="btn btn-success">
                  <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
                  <i class="bi bi-check2-circle me-1"></i>完成换货
                </button>
              </div>
              
              <div v-if="canCancel" class="mt-4 pt-4 border-top">
                <button @click="showCancelModal = true" class="btn btn-outline-danger">
                  <i class="bi bi-x-octagon me-1"></i>取消换货申请
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-lg-4">
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-clock-history me-1"></i>换货时间线
            </div>
            <div class="card-body">
              <div class="timeline">
                <div v-for="(item, index) in timelines" :key="item.id" class="timeline-item">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <div class="fw-bold">{{ item.description }}</div>
                      <div class="text-muted small">操作人：{{ item.operator }}</div>
                    </div>
                  </div>
                  <div class="text-muted small mt-1">{{ formatDate(item.createdAt) }}</div>
                </div>
                <div v-if="timelines.length === 0" class="text-muted">
                  暂无操作记录
                </div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <i class="bi bi-box-seam me-1"></i>库存状态
            </div>
            <div class="card-body">
              <div class="mb-3 p-3 rounded" :class="targetInventoryClass">
                <div class="fw-bold mb-1">目标商品库存</div>
                <div>{{ exchange.targetProductName }}</div>
                <div class="text-muted small">尺码: {{ exchange.targetSize }} | 颜色: {{ exchange.targetColor }}</div>
                <div class="mt-2 fw-bold" :class="targetInventoryColor">
                  <i :class="targetInventoryIcon" class="me-1"></i>
                  {{ targetInventoryText }}
                </div>
              </div>
              
              <div class="p-3 rounded bg-light">
                <div class="fw-bold mb-1">退回商品入库</div>
                <div>{{ exchange.originalProduct }}</div>
                <div class="text-muted small">尺码: {{ exchange.originalSize }} | 颜色: {{ exchange.originalColor }}</div>
                <div v-if="exchange.status === 'completed'" class="mt-2 text-success">
                  <i class="bi bi-check-circle-fill me-1"></i>已入库
                </div>
                <div v-else class="mt-2 text-muted">
                  <i class="bi bi-clock me-1"></i>完成后自动入库
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="showCancelModal" class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">确认取消换货</h5>
              <button @click="showCancelModal = false" class="btn-close"></button>
            </div>
            <div class="modal-body">
              <p>确定要取消这个换货申请吗？此操作不可撤销。</p>
              <div class="mb-3">
                <label class="form-label">取消原因</label>
                <textarea v-model="cancelReason" class="form-control" rows="2" placeholder="请输入取消原因..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showCancelModal = false" class="btn btn-secondary">取消</button>
              <button @click="confirmCancel" :disabled="processing" class="btn btn-danger">
                <span v-if="processing" class="spinner-border spinner-border-sm me-2"></span>
                确认取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const route = VueRouter.useRoute();
    const router = VueRouter.useRouter();
    const { showNotification } = Vue.inject('notification');
    
    const exchangeId = computed(() => route.params.exchangeId);
    const loading = ref(true);
    const exchange = ref(null);
    const order = ref(null);
    const timelines = ref([]);
    const processing = ref(false);
    const showCancelModal = ref(false);
    const cancelReason = ref('');
    
    const returnForm = reactive({ carrier: '', trackingNumber: '' });
    const qualityForm = reactive({ result: null, notes: '' });
    const shipForm = reactive({ carrier: '', trackingNumber: '' });
    
    const currentStep = computed(() => {
      const steps = {
        pending: 1,
        return_received: 2,
        quality_passed: 3,
        quality_failed: 3,
        difference_paid: 4,
        difference_refunded: 4,
        shipped: 5,
        completed: 6,
        cancelled: 0
      };
      return steps[exchange.value?.status] || 0;
    });
    
    const showActionPanel = computed(() => {
      const terminalStatuses = ['completed', 'cancelled', 'quality_failed'];
      return !terminalStatuses.includes(exchange.value?.status);
    });
    
    const canCancel = computed(() => {
      const statuses = ['pending', 'return_received', 'quality_passed'];
      return statuses.includes(exchange.value?.status);
    });
    
    const targetInventoryClass = computed(() => {
      if (!targetInventory.value) return 'bg-light';
      if (targetInventory.value.quantity === 0) return 'bg-light inventory-out';
      if (targetInventory.value.quantity <= 3) return 'bg-light inventory-low';
      return 'bg-light inventory-card';
    });
    
    const targetInventoryColor = computed(() => {
      if (!targetInventory.value) return 'text-muted';
      if (targetInventory.value.quantity === 0) return 'text-danger';
      if (targetInventory.value.quantity <= 3) return 'text-warning';
      return 'text-success';
    });
    
    const targetInventoryIcon = computed(() => {
      if (!targetInventory.value) return 'bi-question-circle';
      if (targetInventory.value.quantity === 0) return 'bi-x-circle-fill';
      if (targetInventory.value.quantity <= 3) return 'bi-exclamation-triangle-fill';
      return 'bi-check-circle-fill';
    });
    
    const targetInventoryText = computed(() => {
      if (!targetInventory.value) return '库存未知';
      if (targetInventory.value.quantity === 0) return '库存不足';
      return `库存 ${targetInventory.value.quantity} 件`;
    });
    
    const targetInventory = ref(null);
    
    async function loadExchange() {
      loading.value = true;
      const result = await apiCall('/exchanges/' + exchangeId.value);
      if (result.success) {
        exchange.value = result.data.exchange;
        order.value = result.data.order;
        timelines.value = result.data.timelines;
        targetInventory.value = result.data.targetInventory;
      }
      loading.value = false;
    }
    
    async function registerReturn() {
      if (!returnForm.carrier || !returnForm.trackingNumber) {
        showNotification('请填写物流公司和单号', 'error');
        return;
      }
      
      processing.value = true;
      const result = await apiCall(`/exchanges/${exchangeId.value}/return`, {
        method: 'POST',
        body: JSON.stringify({
          returnTrackingNumber: returnForm.trackingNumber,
          returnCarrier: returnForm.carrier,
          operator: '客服'
        })
      });
      
      processing.value = false;
      
      if (result.success) {
        showNotification('退回物流登记成功', 'success');
        loadExchange();
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    async function submitQuality() {
      if (qualityForm.result === null) {
        showNotification('请选择质检结果', 'error');
        return;
      }
      
      processing.value = true;
      const result = await apiCall(`/exchanges/${exchangeId.value}/quality`, {
        method: 'POST',
        body: JSON.stringify({
          qualityResult: qualityForm.result,
          qualityNotes: qualityForm.notes,
          operator: '质检员'
        })
      });
      
      processing.value = false;
      
      if (result.success) {
        showNotification('质检结果提交成功', 'success');
        loadExchange();
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    async function handleDifference() {
      processing.value = true;
      const result = await apiCall(`/exchanges/${exchangeId.value}/difference`, {
        method: 'POST',
        body: JSON.stringify({ operator: '财务' })
      });
      
      processing.value = false;
      
      if (result.success) {
        showNotification('差价处理完成', 'success');
        loadExchange();
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    async function shipNewOrder() {
      if (!shipForm.carrier || !shipForm.trackingNumber) {
        showNotification('请填写物流公司和单号', 'error');
        return;
      }
      
      processing.value = true;
      const result = await apiCall(`/exchanges/${exchangeId.value}/ship`, {
        method: 'POST',
        body: JSON.stringify({
          newOrderTrackingNumber: shipForm.trackingNumber,
          newOrderCarrier: shipForm.carrier,
          operator: '仓库'
        })
      });
      
      processing.value = false;
      
      if (result.success) {
        showNotification('发货成功', 'success');
        loadExchange();
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    async function completeExchange() {
      processing.value = true;
      const result = await apiCall(`/exchanges/${exchangeId.value}/complete`, {
        method: 'POST',
        body: JSON.stringify({ operator: '客服' })
      });
      
      processing.value = false;
      
      if (result.success) {
        showNotification('换货完成！', 'success');
        loadExchange();
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    async function confirmCancel() {
      processing.value = true;
      const result = await apiCall(`/exchanges/${exchangeId.value}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          reason: cancelReason.value,
          operator: '客服'
        })
      });
      
      processing.value = false;
      showCancelModal.value = false;
      
      if (result.success) {
        showNotification('换货申请已取消', 'success');
        loadExchange();
      } else {
        showNotification(result.message, 'error');
      }
    }
    
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadExchange();
    });
    
    return {
      loading,
      exchange,
      order,
      timelines,
      statusMap,
      currentStep,
      showActionPanel,
      canCancel,
      processing,
      returnForm,
      qualityForm,
      shipForm,
      showCancelModal,
      cancelReason,
      targetInventory,
      targetInventoryClass,
      targetInventoryColor,
      targetInventoryIcon,
      targetInventoryText,
      registerReturn,
      submitQuality,
      handleDifference,
      shipNewOrder,
      completeExchange,
      confirmCancel,
      formatDate
    };
  }
};

const OrdersList = {
  template: `
    <div>
      <h2 class="mb-4"><i class="bi bi-receipt me-2"></i>订单查询</h2>
      
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">订单号搜索</label>
              <input v-model="searchKeyword" type="text" class="form-control" placeholder="输入订单号或客户信息">
            </div>
            <div class="col-md-3 d-flex align-items-end">
              <button @click="loadOrders" class="btn btn-primary w-100">
                <i class="bi bi-search me-1"></i>搜索
              </button>
            </div>
            <div class="col-md-3 d-flex align-items-end">
              <button @click="loadOrders" class="btn btn-outline-secondary w-100">
                <i class="bi bi-arrow-clockwise me-1"></i>刷新
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body p-0">
          <div v-if="orders.length === 0" class="text-center py-5 text-muted">
            <i class="bi bi-inbox display-4"></i>
            <p class="mt-2">暂无订单</p>
          </div>
          <table v-else class="table table-hover mb-0">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户信息</th>
                <th>商品</th>
                <th>金额</th>
                <th>状态</th>
                <th>下单时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in filteredOrders" :key="order.id">
                <td class="fw-bold">{{ order.id }}</td>
                <td>
                  {{ order.customerName }}<br>
                  <small class="text-muted">{{ order.customerPhone }}</small>
                </td>
                <td>
                  <div v-for="item in order.items" :key="item.id">
                    {{ item.productName }} ({{ item.size }})
                  </div>
                </td>
                <td class="fw-bold">¥{{ order.totalAmount.toFixed(2) }}</td>
                <td>
                  <span :class="order.status === 'completed' ? 'badge bg-success' : 'badge bg-warning'">
                    {{ order.status === 'completed' ? '已完成' : '处理中' }}
                  </span>
                </td>
                <td>{{ formatDate(order.orderDate) }}</td>
                <td>
                  <router-link :to="'/create'" class="btn btn-sm btn-outline-primary" @click="prefillOrder(order)">
                    <i class="bi bi-arrow-left-right me-1"></i>申请换货
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  setup() {
    const router = VueRouter.useRouter();
    const orders = ref([]);
    const searchKeyword = ref('');
    
    const filteredOrders = computed(() => {
      if (!searchKeyword.value) return orders.value;
      const keyword = searchKeyword.value.toLowerCase();
      return orders.value.filter(o => 
        o.id.toLowerCase().includes(keyword) ||
        o.customerName.includes(keyword) ||
        o.customerPhone.includes(keyword)
      );
    });
    
    async function loadOrders() {
      const result = await apiCall('/orders');
      if (result.success) {
        orders.value = result.data;
      }
    }
    
    function prefillOrder(order) {
      router.push('/create');
    }
    
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadOrders();
    });
    
    return {
      orders,
      searchKeyword,
      filteredOrders,
      loadOrders,
      prefillOrder,
      formatDate
    };
  }
};

const InventoryList = {
  template: `
    <div>
      <h2 class="mb-4"><i class="bi bi-box-seam me-2"></i>库存管理</h2>
      
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label">商品筛选</label>
              <select v-model="filterProduct" class="form-select">
                <option value="">全部商品</option>
                <option v-for="p in products" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ p.category }})
                </option>
              </select>
            </div>
            <div class="col-md-4 d-flex align-items-end">
              <button @click="loadData" class="btn btn-primary w-100">
                <i class="bi bi-search me-1"></i>筛选
              </button>
            </div>
            <div class="col-md-4 d-flex align-items-end">
              <button @click="loadData" class="btn btn-outline-secondary w-100">
                <i class="bi bi-arrow-clockwise me-1"></i>刷新
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="stat-card">
            <div class="icon bg-success text-white"><i class="bi bi-check-circle"></i></div>
            <h3 class="text-success">{{ stats.inStock }}</h3>
            <p>有库存</p>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <div class="icon bg-warning text-white"><i class="bi bi-exclamation-triangle"></i></div>
            <h3 class="text-warning">{{ stats.low }}</h3>
            <p>库存低</p>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <div class="icon bg-danger text-white"><i class="bi bi-x-circle"></i></div>
            <h3 class="text-danger">{{ stats.outOfStock }}</h3>
            <p>缺货</p>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <div class="icon bg-info text-white"><i class="bi bi-box"></i></div>
            <h3 class="text-info">{{ stats.total }}</h3>
            <p>总库存</p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body p-0">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>商品</th>
                <th>分类</th>
                <th>尺码</th>
                <th>颜色</th>
                <th>价格</th>
                <th>库存</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredInventory" :key="item.id">
                <td class="fw-bold">{{ getProductName(item.productId) }}</td>
                <td>{{ getProductCategory(item.productId) }}</td>
                <td><span class="badge bg-secondary">{{ item.size }}</span></td>
                <td>{{ item.color }}</td>
                <td>¥{{ item.price.toFixed(2) }}</td>
                <td>
                  <span class="fw-bold" :class="{
                    'text-success': item.quantity > 3,
                    'text-warning': item.quantity > 0 && item.quantity <= 3,
                    'text-danger': item.quantity === 0
                  }">
                    {{ item.quantity }}
                  </span>
                </td>
                <td>
                  <span v-if="item.quantity === 0" class="badge bg-danger">缺货</span>
                  <span v-else-if="item.quantity <= 3" class="badge bg-warning">库存低</span>
                  <span v-else class="badge bg-success">充足</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  setup() {
    const inventory = ref([]);
    const products = ref([]);
    const filterProduct = ref('');
    
    const filteredInventory = computed(() => {
      if (!filterProduct.value) return inventory.value;
      return inventory.value.filter(i => i.productId === filterProduct.value);
    });
    
    const stats = computed(() => {
      const inStock = inventory.value.filter(i => i.quantity > 3).length;
      const low = inventory.value.filter(i => i.quantity > 0 && i.quantity <= 3).length;
      const outOfStock = inventory.value.filter(i => i.quantity === 0).length;
      const total = inventory.value.reduce((sum, i) => sum + i.quantity, 0);
      return { inStock, low, outOfStock, total };
    });
    
    async function loadData() {
      const [invResult, prodResult] = await Promise.all([
        apiCall('/inventory'),
        apiCall('/products')
      ]);
      
      if (invResult.success) inventory.value = invResult.data;
      if (prodResult.success) products.value = prodResult.data;
    }
    
    function getProductName(productId) {
      const p = products.value.find(x => x.id === productId);
      return p ? p.name : productId;
    }
    
    function getProductCategory(productId) {
      const p = products.value.find(x => x.id === productId);
      return p ? p.category : '-';
    }
    
    onMounted(() => {
      loadData();
    });
    
    return {
      inventory,
      products,
      filterProduct,
      filteredInventory,
      stats,
      loadData,
      getProductName,
      getProductCategory
    };
  }
};

const Report = {
  template: `
    <div>
      <h2 class="mb-4"><i class="bi bi-graph-up me-2"></i>客服处理报表</h2>
      
      <div class="row mb-4">
        <div class="col-md-2">
          <div class="stat-card">
            <div class="icon bg-primary text-white"><i class="bi bi-file-earmark-text"></i></div>
            <h3 class="text-primary">{{ report.stats?.total || 0 }}</h3>
            <p>总申请</p>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-card">
            <div class="icon bg-warning text-white"><i class="bi bi-clock"></i></div>
            <h3 class="text-warning">{{ report.stats?.pending || 0 }}</h3>
            <p>待处理</p>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-card">
            <div class="icon bg-success text-white"><i class="bi bi-check-circle"></i></div>
            <h3 class="text-success">{{ report.stats?.completed || 0 }}</h3>
            <p>已完成</p>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-card">
            <div class="icon bg-danger text-white"><i class="bi bi-x-circle"></i></div>
            <h3 class="text-danger">{{ report.stats?.qualityFailed || 0 }}</h3>
            <p>质检失败</p>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-card">
            <div class="icon bg-info text-white"><i class="bi bi-clock-history"></i></div>
            <h3 class="text-info">{{ report.stats?.avgProcessTime || 0 }}h</h3>
            <p>平均耗时</p>
          </div>
        </div>
        <div class="col-md-2">
          <div class="stat-card">
            <div class="icon" :class="(report.stats?.totalDifference || 0) >= 0 ? 'bg-danger text-white' : 'bg-success text-white'">
              <i class="bi bi-currency-yuan"></i>
            </div>
            <h3 :class="(report.stats?.totalDifference || 0) >= 0 ? 'text-danger' : 'text-success'">
              ¥{{ Math.abs(report.stats?.totalDifference || 0).toFixed(0) }}
            </h3>
            <p>差价汇总</p>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-lg-6">
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-pie-chart me-1"></i>分类统计
            </div>
            <div class="card-body">
              <div v-if="report.categoryStats" class="row">
                <div v-for="(stats, category) in report.categoryStats" :key="category" class="col-12 mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <strong>{{ category }}</strong>
                    <span class="text-muted">{{ stats.completed }}/{{ stats.total }}</span>
                  </div>
                  <div class="progress" style="height: 20px;">
                    <div class="progress-bar" role="progressbar" 
                         :style="{ width: stats.successRate + '%' }"
                         :class="stats.successRate >= 80 ? 'bg-success' : stats.successRate >= 50 ? 'bg-warning' : 'bg-danger'">
                      {{ stats.successRate }}%
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center text-muted py-3">
                暂无数据
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-lg-6">
          <div class="card mb-4">
            <div class="card-header">
              <i class="bi bi-list-ol me-1"></i>最近换货申请
            </div>
            <div class="card-body p-0">
              <div v-if="report.recentExchanges?.length > 0" class="list-group list-group-flush">
                <div v-for="exchange in report.recentExchanges" :key="exchange.id" 
                     class="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <div class="fw-bold">{{ exchange.id }}</div>
                    <div class="text-muted small">
                      {{ exchange.customerName }} - {{ exchange.originalProduct }}
                    </div>
                  </div>
                  <span :class="['status-badge', 'status-' + exchange.status]">
                    {{ statusMap[exchange.status]?.text }}
                  </span>
                </div>
              </div>
              <div v-else class="text-center text-muted py-3">
                暂无数据
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <i class="bi bi-arrow-left-right me-1"></i>库存变动日志
        </div>
        <div class="card-body p-0">
          <div v-if="report.recentInventoryLogs?.length > 0" class="table-responsive">
            <table class="table mb-0">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>数量</th>
                  <th>原因</th>
                  <th>操作人</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in report.recentInventoryLogs" :key="log.id">
                  <td>{{ formatDate(log.createdAt) }}</td>
                  <td>
                    <span :class="log.type === 'in' ? 'badge bg-success' : 'badge bg-danger'">
                      {{ log.type === 'in' ? '入库' : '出库' }}
                    </span>
                  </td>
                  <td class="fw-bold" :class="log.type === 'in' ? 'text-success' : 'text-danger'">
                    {{ log.type === 'in' ? '+' : '-' }}{{ log.quantity }}
                  </td>
                  <td>{{ log.reason }}</td>
                  <td>{{ log.operator }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center text-muted py-5">
            <i class="bi bi-inbox display-4"></i>
            <p class="mt-2">暂无库存变动</p>
          </div>
        </div>
      </div>
      
      <div class="mt-4">
        <button @click="loadReport" class="btn btn-outline-primary">
          <i class="bi bi-arrow-clockwise me-1"></i>刷新数据
        </button>
      </div>
    </div>
  `,
  setup() {
    const report = ref({});
    
    async function loadReport() {
      const result = await apiCall('/report');
      if (result.success) {
        report.value = result.data;
      }
    }
    
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadReport();
    });
    
    return {
      report,
      statusMap,
      loadReport,
      formatDate
    };
  }
};

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ExchangeList },
    { path: '/create', component: CreateExchange },
    { path: '/exchange/:exchangeId', component: ExchangeDetail },
    { path: '/orders', component: OrdersList },
    { path: '/inventory', component: InventoryList },
    { path: '/report', component: Report }
  ]
});

const app = createApp({
  setup() {
    const notification = reactive({
      show: false,
      message: '',
      type: 'info'
    });
    
    let timeoutId = null;
    
    function showNotification(message, type = 'info') {
      notification.show = true;
      notification.message = message;
      notification.type = type;
      
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        notification.show = false;
      }, 3000);
    }
    
    app.provide('notification', { showNotification });
    
    return {
      notification
    };
  }
});

app.use(router);
app.mount('#app');
