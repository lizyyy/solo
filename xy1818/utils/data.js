const categories = [
  { id: 1, name: '全部', icon: '🍞', color: '#D32F2F' },
  { id: 2, name: '欧式面包', icon: '🥖', color: '#FF6B6B' },
  { id: 3, name: '日式面包', icon: '🍩', color: '#FF9800' },
  { id: 4, name: '丹麦酥', icon: '🥐', color: '#4CAF50' },
  { id: 5, name: '吐司系列', icon: '🍞', color: '#2196F3' },
  { id: 6, name: '蛋糕甜点', icon: '🧁', color: '#9C27B0' },
  { id: 7, name: '健康轻食', icon: '🥗', color: '#009688' },
  { id: 8, name: '季节限定', icon: '🌸', color: '#E91E63' }
]

const products = [
  {
    id: 1,
    name: '法式长棍面包',
    categoryId: 2,
    price: 18,
    originalPrice: 25,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=French%20baguette%20bread%20golden%20crispy%20crust%20white%20background%20professional%20food%20photography&image_size=square',
    description: '传统法式工艺，外酥内软，麦香浓郁',
    detail: '精选法国进口面粉，经过24小时低温发酵，表皮金黄酥脆，内部组织松软多孔，带有天然的麦香味。',
    tags: ['热销', '经典'],
    stock: 50,
    sales: 1256,
    rating: 4.9,
    nutrition: { calories: 260, protein: 8, carbs: 52, fat: 2 },
    specifications: ['原味', '蒜香', '全麦']
  },
  {
    id: 2,
    name: '抹茶红豆吐司',
    categoryId: 5,
    price: 22,
    originalPrice: 28,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Matcha%20red%20bean%20toast%20bread%20sliced%20green%20tea%20flavor%20white%20background%20food%20photography&image_size=square',
    description: '日本宇治抹茶搭配绵密红豆，清新怡人',
    detail: '采用日本宇治顶级抹茶粉，搭配手工熬制的红豆沙，层层卷入松软的吐司中，每一口都能感受到抹茶的清香与红豆的甜蜜。',
    tags: ['新品', '推荐'],
    stock: 30,
    sales: 892,
    rating: 4.8,
    nutrition: { calories: 280, protein: 7, carbs: 55, fat: 4 },
    specifications: ['原味', '加蜜红豆']
  },
  {
    id: 3,
    name: '黄油可颂',
    categoryId: 4,
    price: 16,
    originalPrice: 20,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Butter%20croissant%20golden%20flaky%20layers%20French%20pastry%20white%20background%20professional%20food%20photo&image_size=square',
    description: '层层酥脆，黄油香气四溢，经典法式美味',
    detail: '使用法国进口发酵黄油，经过3次折叠27层酥皮工艺，烘烤后外酥内软，每一层都充满黄油的香气。',
    tags: ['热销', '经典'],
    stock: 80,
    sales: 2134,
    rating: 4.9,
    nutrition: { calories: 406, protein: 6, carbs: 38, fat: 26 },
    specifications: ['原味', '杏仁片', '巧克力']
  },
  {
    id: 4,
    name: '全麦核桃面包',
    categoryId: 7,
    price: 25,
    originalPrice: 32,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Whole%20wheat%20walnut%20bread%20healthy%20grain%20nuts%20brown%20crust%20white%20background%20food%20photography&image_size=square',
    description: '高纤维全麦，搭配香脆核桃，健康美味',
    detail: '含50%全麦粉，添加大量核桃碎，低糖配方，富含膳食纤维和Omega-3，是健康早餐的最佳选择。',
    tags: ['健康', '低糖'],
    stock: 40,
    sales: 567,
    rating: 4.7,
    nutrition: { calories: 240, protein: 10, carbs: 38, fat: 8 },
    specifications: ['原味', '加葡萄干']
  },
  {
    id: 5,
    name: '草莓奶油蛋糕',
    categoryId: 6,
    price: 68,
    originalPrice: 88,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Strawberry%20cream%20cake%20fresh%20strawberries%20whipped%20cream%20sponge%20cake%20white%20background%20dessert%20photography&image_size=square',
    description: '新鲜草莓搭配轻盈奶油，甜蜜幸福的味道',
    detail: '采用日本进口草莓，搭配手工打发的动物奶油，戚风蛋糕体湿润松软，每一口都能感受到草莓的酸甜与奶油的绵密。',
    tags: ['人气', '甜品'],
    stock: 15,
    sales: 723,
    rating: 5.0,
    nutrition: { calories: 380, protein: 5, carbs: 52, fat: 18 },
    specifications: ['4寸', '6寸', '8寸']
  },
  {
    id: 6,
    name: '蒜香芝士面包',
    categoryId: 2,
    price: 19,
    originalPrice: 24,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Garlic%20cheese%20bread%20melted%20cheese%20golden%20garlic%20butter%20white%20background%20food%20photography&image_size=square',
    description: '浓郁蒜香搭配拉丝芝士，香气扑鼻',
    detail: '新鲜蒜末与黄油完美融合，表面铺满马苏里拉芝士，烘烤后芝士拉丝，蒜香四溢，是咸口面包的经典之选。',
    tags: ['热销', '咸香'],
    stock: 45,
    sales: 1567,
    rating: 4.8,
    nutrition: { calories: 320, protein: 12, carbs: 35, fat: 16 },
    specifications: ['原味', '加培根']
  },
  {
    id: 7,
    name: '巧克力熔岩蛋糕',
    categoryId: 6,
    price: 32,
    originalPrice: 42,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Chocolate%20lava%20cake%20molten%20center%20dark%20chocolate%20dessert%20white%20background%20professional%20food%20photo&image_size=square',
    description: '切开瞬间流心爆浆，浓郁巧克力享受',
    detail: '采用比利时72%黑巧克力，外皮酥脆，内心保持温热的流心状态，搭配一球香草冰淇淋，口感层次丰富。',
    tags: ['人气', '巧克力'],
    stock: 20,
    sales: 945,
    rating: 4.9,
    nutrition: { calories: 450, protein: 6, carbs: 58, fat: 24 },
    specifications: ['单人份', '双人份']
  },
  {
    id: 8,
    name: '樱花乳酪包',
    categoryId: 8,
    price: 28,
    originalPrice: 35,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Sakura%20cherry%20blossom%20cream%20cheese%20bread%20pink%20color%20spring%20theme%20white%20background%20food%20photography&image_size=square',
    description: '春季限定，樱花香气与乳酪的完美融合',
    detail: '春季限定新品，添加日本盐渍樱花，内馅是轻盈的奶油乳酪，口感酸甜清新，粉嫩的外观充满春天气息。',
    tags: ['限定', '春季'],
    stock: 25,
    sales: 432,
    rating: 4.8,
    nutrition: { calories: 310, protein: 8, carbs: 42, fat: 14 },
    specifications: ['原味']
  },
  {
    id: 9,
    name: '牛角包三明治',
    categoryId: 3,
    price: 26,
    originalPrice: 32,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Croissant%20sandwich%20with%20egg%20ham%20cheese%20savory%20breakfast%20white%20background%20food%20photography&image_size=square',
    description: '香脆可颂夹入丰富配料，营养早餐首选',
    detail: '将新鲜出炉的可颂横向切开，夹入煎蛋、生菜、番茄和芝士，配上特制酱料，一口下去满足感爆棚。',
    tags: ['早餐', '推荐'],
    stock: 35,
    sales: 1123,
    rating: 4.7,
    nutrition: { calories: 480, protein: 18, carbs: 42, fat: 28 },
    specifications: ['经典款', '烟熏鸡肉', '牛油果']
  },
  {
    id: 10,
    name: '提拉米苏',
    categoryId: 6,
    price: 38,
    originalPrice: 48,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Tiramisu%20Italian%20dessert%20coffee%20flavor%20mascarpone%20cream%20cocoa%20powder%20white%20background%20food%20photography&image_size=square',
    description: '意式经典，咖啡与马斯卡彭的浪漫邂逅',
    detail: '传统意式配方，使用意大利马斯卡彭芝士，手指饼干浸泡浓缩咖啡，层次分明，入口即化，带有淡淡的咖啡酒香。',
    tags: ['经典', '意式'],
    stock: 18,
    sales: 876,
    rating: 4.9,
    nutrition: { calories: 390, protein: 7, carbs: 38, fat: 24 },
    specifications: ['单人杯', '6寸盒装']
  },
  {
    id: 11,
    name: '紫米乳酪吐司',
    categoryId: 5,
    price: 24,
    originalPrice: 30,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Purple%20rice%20cream%20cheese%20toast%20bread%20purple%20color%20sticky%20rice%20white%20background%20food%20photography&image_size=square',
    description: '软糯紫米搭配香浓乳酪，口感丰富',
    detail: '精选云南墨江紫米，提前浸泡后蒸熟，加入少量冰糖调味，与奶油乳酪一起卷入吐司中，软糯香甜，营养丰富。',
    tags: ['热销', '营养'],
    stock: 40,
    sales: 1345,
    rating: 4.8,
    nutrition: { calories: 320, protein: 9, carbs: 58, fat: 7 },
    specifications: ['原味', '双倍芝士']
  },
  {
    id: 12,
    name: '焦糖肉桂卷',
    categoryId: 4,
    price: 22,
    originalPrice: 28,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Caramel%20cinnamon%20roll%20sweet%20pastry%20glaze%20icing%20warm%20brown%20color%20white%20background%20food%20photography&image_size=square',
    description: '温暖肉桂香，淋上焦糖酱，甜蜜治愈',
    detail: '传统美式肉桂卷，面团中揉入大量肉桂粉和红糖，烘烤后淋上自制焦糖酱，香气扑鼻，温暖治愈。',
    tags: ['人气', '甜蜜'],
    stock: 30,
    sales: 987,
    rating: 4.7,
    nutrition: { calories: 420, protein: 5, carbs: 62, fat: 18 },
    specifications: ['原味', '加坚果']
  },
  {
    id: 13,
    name: '日式红豆包',
    categoryId: 3,
    price: 15,
    originalPrice: 18,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Japanese%20red%20bean%20bun%20anko%20paste%20round%20shape%20soft%20bread%20white%20background%20food%20photography&image_size=square',
    description: '经典日式甜包，绵密红豆馅，童年味道',
    detail: '采用日式汤种法制作，面包体特别松软，内馅是手工熬制的红豆沙，甜度适中，带有颗粒感，是日式面包店的经典之作。',
    tags: ['经典', '日式'],
    stock: 60,
    sales: 1876,
    rating: 4.8,
    nutrition: { calories: 260, protein: 6, carbs: 52, fat: 4 },
    specifications: ['原味', '奶油红豆']
  },
  {
    id: 14,
    name: '芒果奶油千层',
    categoryId: 6,
    price: 58,
    originalPrice: 72,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Mango%20cream%20mille%20crepe%20cake%20layers%20fresh%20mango%20whipped%20cream%20yellow%20color%20white%20background%20dessert%20photography&image_size=square',
    description: '24层薄饼皮，新鲜芒果与奶油层层叠加',
    detail: '手工煎制24层超薄饼皮，每层之间涂抹新鲜动物奶油，夹入大块芒果果肉，口感轻盈，果香浓郁。',
    tags: ['人气', '水果'],
    stock: 12,
    sales: 654,
    rating: 4.9,
    nutrition: { calories: 360, protein: 5, carbs: 48, fat: 16 },
    specifications: ['4寸', '6寸']
  },
  {
    id: 15,
    name: '杂粮坚果包',
    categoryId: 7,
    price: 23,
    originalPrice: 29,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Multigrain%20nut%20bread%20healthy%20seeds%20walnuts%20sunflower%20seeds%20brown%20crust%20white%20background%20food%20photography&image_size=square',
    description: '多种谷物与坚果，营养满分，能量满满',
    detail: '添加燕麦、亚麻籽、葵花籽、南瓜籽等多种谷物，搭配核桃、杏仁等坚果，高纤维高蛋白，是健身达人的首选。',
    tags: ['健康', '健身'],
    stock: 35,
    sales: 432,
    rating: 4.6,
    nutrition: { calories: 280, protein: 12, carbs: 42, fat: 10 },
    specifications: ['原味', '无蔗糖']
  },
  {
    id: 16,
    name: '芝士榴莲包',
    categoryId: 3,
    price: 32,
    originalPrice: 40,
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Durian%20cheese%20bun%20creamy%20filling%20golden%20brown%20exotic%20fruit%20white%20background%20food%20photography&image_size=square',
    description: '马来西亚猫山王榴莲，浓郁香气，爱者深爱',
    detail: '采用马来西亚进口猫山王榴莲果肉，搭配奶油芝士，内馅饱满，香气浓郁，是榴莲爱好者的福音。',
    tags: ['特色', '榴莲'],
    stock: 20,
    sales: 567,
    rating: 4.8,
    nutrition: { calories: 380, protein: 8, carbs: 45, fat: 20 },
    specifications: ['原味', '双倍榴莲']
  }
]

const availableCoupons = [
  {
    id: 'CPN001',
    name: '新人专享券',
    type: 'discount',
    discount: 0.8,
    amount: 0,
    minAmount: 50,
    description: '全场8折，满50元可用',
    validDays: 30,
    stock: 100,
    claimed: 0,
    isNewUser: true
  },
  {
    id: 'CPN002',
    name: '满30减5',
    type: 'cash',
    discount: 0,
    amount: 5,
    minAmount: 30,
    description: '满30元立减5元',
    validDays: 15,
    stock: 200,
    claimed: 0,
    isNewUser: false
  },
  {
    id: 'CPN003',
    name: '满50减10',
    type: 'cash',
    discount: 0,
    amount: 10,
    minAmount: 50,
    description: '满50元立减10元',
    validDays: 15,
    stock: 150,
    claimed: 0,
    isNewUser: false
  },
  {
    id: 'CPN004',
    name: '蛋糕专享券',
    type: 'cash',
    discount: 0,
    amount: 15,
    minAmount: 80,
    description: '蛋糕类商品满80减15',
    validDays: 30,
    stock: 80,
    claimed: 0,
    isNewUser: false,
    categoryId: 6
  },
  {
    id: 'CPN005',
    name: '会员专享9折',
    type: 'discount',
    discount: 0.9,
    amount: 0,
    minAmount: 0,
    description: '会员专享全场9折',
    validDays: 7,
    stock: 500,
    claimed: 0,
    isNewUser: false,
    isMemberOnly: true
  }
]

const rechargeOptions = [
  { amount: 100, bonus: 10, description: '充100送10', popular: false },
  { amount: 200, bonus: 30, description: '充200送30', popular: false },
  { amount: 500, bonus: 100, description: '充500送100', popular: true },
  { amount: 1000, bonus: 250, description: '充1000送250', popular: false }
]

const deliveryModes = [
  { id: 'takeout', name: '外卖', icon: '🛵', description: '30分钟送达', fee: 5, freeThreshold: 30 },
  { id: 'pickup', name: '自提', icon: '🏪', description: '到店自取', fee: 0, freeThreshold: 0 },
  { id: 'dinein', name: '堂食', icon: '🍽️', description: '店内用餐', fee: 0, freeThreshold: 0 }
]

function getProductsByCategory(categoryId) {
  if (categoryId === 1) {
    return products
  }
  return products.filter(p => p.categoryId === categoryId)
}

function getProductById(id) {
  return products.find(p => p.id === id)
}

function searchProducts(keyword) {
  if (!keyword) return products
  const lowerKeyword = keyword.toLowerCase()
  return products.filter(p => 
    p.name.toLowerCase().includes(lowerKeyword) ||
    p.description.toLowerCase().includes(lowerKeyword) ||
    p.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
  )
}

function getHotProducts(limit = 6) {
  return [...products].sort((a, b) => b.sales - a.sales).slice(0, limit)
}

function getNewProducts(limit = 6) {
  return products.filter(p => p.tags.includes('新品')).slice(0, limit)
}

function calculateDiscount(coupon, totalAmount) {
  if (!coupon) return 0
  
  if (coupon.minAmount && totalAmount < coupon.minAmount) {
    return 0
  }
  
  if (coupon.type === 'cash') {
    return coupon.amount
  } else if (coupon.type === 'discount') {
    return Math.floor(totalAmount * (1 - coupon.discount) * 100) / 100
  }
  
  return 0
}

function isCouponValid(coupon, totalAmount, categoryId = null) {
  if (!coupon) return false
  
  if (coupon.used) return false
  
  if (coupon.minAmount && totalAmount < coupon.minAmount) {
    return false
  }
  
  if (coupon.categoryId && categoryId !== coupon.categoryId) {
    return false
  }
  
  return true
}

module.exports = {
  categories,
  products,
  availableCoupons,
  rechargeOptions,
  deliveryModes,
  getProductsByCategory,
  getProductById,
  searchProducts,
  getHotProducts,
  getNewProducts,
  calculateDiscount,
  isCouponValid
}
