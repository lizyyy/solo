export const PRODUCT_TYPES = {
  REFRIGERATOR_MAGNET: { id: 'refrigerator_magnet', name: '冰箱贴', icon: '🧲', basePrice: 29.9 },
  POSTCARD: { id: 'postcard', name: '明信片', icon: '🖼️', basePrice: 15.0 },
  SPECIALTY: { id: 'specialty', name: '特产', icon: '🍜', basePrice: 58.0 },
  FIGURINE: { id: 'figurine', name: '手办', icon: '🎭', basePrice: 128.0 },
  KEYCHAIN: { id: 'keychain', name: '钥匙扣', icon: '🔑', basePrice: 19.9 },
  MUG: { id: 'mug', name: '马克杯', icon: '☕', basePrice: 39.9 },
  TOTE_BAG: { id: 'tote_bag', name: '帆布包', icon: '👜', basePrice: 49.9 },
  T_SHIRT: { id: 't_shirt', name: 'T恤', icon: '👕', basePrice: 79.9 }
}

export const COLORS = [
  { id: 'red', name: '红色', hex: '#C41E3A' },
  { id: 'blue', name: '蓝色', hex: '#1E90FF' },
  { id: 'green', name: '绿色', hex: '#2E8B57' },
  { id: 'yellow', name: '黄色', hex: '#FFD700' },
  { id: 'purple', name: '紫色', hex: '#8B5CF6' },
  { id: 'pink', name: '粉色', hex: '#EC4899' },
  { id: 'white', name: '白色', hex: '#FFFFFF' },
  { id: 'black', name: '黑色', hex: '#000000' },
  { id: 'gold', name: '金色', hex: '#FFD700' },
  { id: 'silver', name: '银色', hex: '#C0C0C0' }
]

export const SHAPES = [
  { id: 'square', name: '方形', icon: '⬜', priceMultiplier: 1.0 },
  { id: 'circle', name: '圆形', icon: '⭕', priceMultiplier: 1.0 },
  { id: 'rectangle', name: '长方形', icon: '▭', priceMultiplier: 1.1 },
  { id: 'star', name: '星形', icon: '⭐', priceMultiplier: 1.2 },
  { id: 'heart', name: '心形', icon: '❤', priceMultiplier: 1.2 },
  { id: 'hexagon', name: '六边形', icon: '⬡', priceMultiplier: 1.15 }
]

export const SIZES = [
  { id: 'small', name: '小号', multiplier: 0.8 },
  { id: 'medium', name: '中号', multiplier: 1.0 },
  { id: 'large', name: '大号', multiplier: 1.3 },
  { id: 'xlarge', name: '特大号', multiplier: 1.6 }
]

export const PRODUCTS = [
  {
    id: 'prod_001',
    name: '故宫文创冰箱贴',
    description: '以故宫经典建筑为原型，采用环保材质，磁性设计，让历史走进生活',
    price: 29.9,
    discountPrice: 24.9,
    originalPrice: 39.9,
    type: 'refrigerator_magnet',
    cityId: 'city_001',
    cityName: '北京',
    images: [
      'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    specs: {
      colors: ['red', 'gold', 'black'],
      shapes: ['square', 'circle', 'rectangle'],
      sizes: ['small', 'medium']
    },
    stock: 500,
    sales: 2856,
    rating: 4.9,
    reviews: 326,
    tags: ['热销', '故宫', '经典'],
    createdAt: '2024-01-15'
  },
  {
    id: 'prod_002',
    name: '北京烤鸭手办',
    description: '以北京特色美食烤鸭为原型，Q版可爱造型，收藏送礼两相宜',
    price: 128.0,
    discountPrice: 98.0,
    originalPrice: 158.0,
    type: 'figurine',
    cityId: 'city_001',
    cityName: '北京',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
      'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600'
    ],
    specs: {
      colors: ['gold', 'red', 'white'],
      shapes: ['circle'],
      sizes: ['small', 'medium', 'large']
    },
    stock: 200,
    sales: 856,
    rating: 4.8,
    reviews: 128,
    tags: ['手办', '特色', '收藏'],
    createdAt: '2024-02-01'
  },
  {
    id: 'prod_003',
    name: '长城风景明信片套装',
    description: '精选八达岭长城春夏秋冬四季美景，高清印刷，附赠精美信封',
    price: 25.0,
    discountPrice: 18.0,
    originalPrice: 35.0,
    type: 'postcard',
    cityId: 'city_001',
    cityName: '北京',
    images: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600'
    ],
    specs: {
      colors: ['white'],
      shapes: ['rectangle'],
      sizes: ['medium']
    },
    stock: 1000,
    sales: 3562,
    rating: 4.7,
    reviews: 256,
    tags: ['明信片', '长城', '四季'],
    createdAt: '2024-01-20'
  },
  {
    id: 'prod_004',
    name: '东方明珠钥匙扣',
    description: '迷你版东方明珠造型，金属质感，时尚配饰，彰显上海风情',
    price: 39.9,
    discountPrice: 29.9,
    originalPrice: 49.9,
    type: 'keychain',
    cityId: 'city_002',
    cityName: '上海',
    images: [
      'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=600'
    ],
    specs: {
      colors: ['silver', 'gold', 'blue'],
      shapes: ['circle'],
      sizes: ['small']
    },
    stock: 800,
    sales: 2156,
    rating: 4.8,
    reviews: 186,
    tags: ['热销', '上海', '钥匙扣'],
    createdAt: '2024-02-10'
  },
  {
    id: 'prod_005',
    name: '上海外滩夜景明信片',
    description: '外滩夜色璀璨夺目，万国建筑博览群尽收眼底，收藏上海最美夜景',
    price: 18.0,
    discountPrice: 15.0,
    originalPrice: 22.0,
    type: 'postcard',
    cityId: 'city_002',
    cityName: '上海',
    images: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600'
    ],
    specs: {
      colors: ['white'],
      shapes: ['rectangle'],
      sizes: ['medium']
    },
    stock: 1200,
    sales: 4256,
    rating: 4.9,
    reviews: 356,
    tags: ['热销', '夜景', '外滩'],
    createdAt: '2024-01-25'
  },
  {
    id: 'prod_006',
    name: '老上海风情帆布包',
    description: '复古设计，重现老上海风情，大容量设计，实用又时尚',
    price: 59.9,
    discountPrice: 49.9,
    originalPrice: 79.9,
    type: 'tote_bag',
    cityId: 'city_002',
    cityName: '上海',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'
    ],
    specs: {
      colors: ['black', 'white', 'blue'],
      shapes: ['rectangle'],
      sizes: ['medium', 'large']
    },
    stock: 500,
    sales: 1256,
    rating: 4.7,
    reviews: 142,
    tags: ['复古', '帆布包', '实用'],
    createdAt: '2024-03-01'
  },
  {
    id: 'prod_007',
    name: '广州塔冰箱贴',
    description: '3D立体造型，还原广州塔"小蛮腰"优美曲线，夜光效果，夜晚也精彩',
    price: 35.0,
    discountPrice: 29.0,
    originalPrice: 45.0,
    type: 'refrigerator_magnet',
    cityId: 'city_003',
    cityName: '广州',
    images: [
      'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=600'
    ],
    specs: {
      colors: ['silver', 'gold', 'blue'],
      shapes: ['rectangle'],
      sizes: ['small', 'medium']
    },
    stock: 600,
    sales: 1856,
    rating: 4.8,
    reviews: 216,
    tags: ['3D', '夜光', '广州塔'],
    createdAt: '2024-02-15'
  },
  {
    id: 'prod_008',
    name: '粤式早茶点心手办套装',
    description: '虾饺、烧麦、凤爪...经典粤式点心Q版化，让美食陪伴你每一天',
    price: 168.0,
    discountPrice: 128.0,
    originalPrice: 198.0,
    type: 'figurine',
    cityId: 'city_003',
    cityName: '广州',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    specs: {
      colors: ['gold', 'white'],
      shapes: ['circle'],
      sizes: ['small', 'medium']
    },
    stock: 300,
    sales: 562,
    rating: 4.9,
    reviews: 86,
    tags: ['美食', '点心', '套装'],
    createdAt: '2024-03-10'
  },
  {
    id: 'prod_009',
    name: '岭南风光主题T恤',
    description: '精选岭南特色元素，舒适透气面料，穿出岭南风情',
    price: 99.0,
    discountPrice: 79.0,
    originalPrice: 129.0,
    type: 't_shirt',
    cityId: 'city_003',
    cityName: '广州',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600'
    ],
    specs: {
      colors: ['white', 'black', 'blue'],
      shapes: ['rectangle'],
      sizes: ['small', 'medium', 'large', 'xlarge']
    },
    stock: 400,
    sales: 986,
    rating: 4.7,
    reviews: 112,
    tags: ['服饰', '岭南', '舒适'],
    createdAt: '2024-03-15'
  },
  {
    id: 'prod_010',
    name: '深圳科技之城马克杯',
    description: '以深圳地标建筑为设计元素，陶瓷材质，保温效果好',
    price: 49.9,
    discountPrice: 39.9,
    originalPrice: 59.9,
    type: 'mug',
    cityId: 'city_004',
    cityName: '深圳',
    images: [
      'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600'
    ],
    specs: {
      colors: ['white', 'blue', 'black'],
      shapes: ['circle'],
      sizes: ['medium', 'large']
    },
    stock: 350,
    sales: 756,
    rating: 4.6,
    reviews: 86,
    tags: ['科技', '马克杯', '实用'],
    createdAt: '2024-03-20'
  },
  {
    id: 'prod_011',
    name: '大理风花雪月冰箱贴套装',
    description: '下关风、上关花、苍山雪、洱海月，大理四景尽收囊中',
    price: 58.0,
    discountPrice: 45.0,
    originalPrice: 68.0,
    type: 'refrigerator_magnet',
    cityId: 'city_005',
    cityName: '大理',
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600'
    ],
    specs: {
      colors: ['blue', 'white', 'pink'],
      shapes: ['square', 'circle'],
      sizes: ['small', 'medium']
    },
    stock: 450,
    sales: 1656,
    rating: 4.9,
    reviews: 196,
    tags: ['套装', '四景', '浪漫'],
    createdAt: '2024-02-20'
  },
  {
    id: 'prod_012',
    name: '洱海风帆帆布包',
    description: '洱海风光图案设计，环保帆布材质，大容量实用设计',
    price: 65.0,
    discountPrice: 49.9,
    originalPrice: 79.0,
    type: 'tote_bag',
    cityId: 'city_005',
    cityName: '大理',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'
    ],
    specs: {
      colors: ['blue', 'white', 'green'],
      shapes: ['rectangle'],
      sizes: ['medium', 'large']
    },
    stock: 400,
    sales: 956,
    rating: 4.7,
    reviews: 108,
    tags: ['洱海', '环保', '大容量'],
    createdAt: '2024-03-05'
  },
  {
    id: 'prod_013',
    name: '白族扎染围巾',
    description: '传统白族扎染工艺，纯天然植物染料，独一无二的艺术品',
    price: 188.0,
    discountPrice: 148.0,
    originalPrice: 228.0,
    type: 'specialty',
    cityId: 'city_005',
    cityName: '大理',
    images: [
      'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600'
    ],
    specs: {
      colors: ['blue', 'white'],
      shapes: ['rectangle'],
      sizes: ['medium', 'large']
    },
    stock: 200,
    sales: 456,
    rating: 4.9,
    reviews: 68,
    tags: ['传统工艺', '扎染', '围巾'],
    createdAt: '2024-01-30'
  },
  {
    id: 'prod_014',
    name: '玉龙雪山钥匙扣',
    description: '迷你玉龙雪山造型，金属质感，雪山之巅的荣耀',
    price: 35.0,
    discountPrice: 28.0,
    originalPrice: 42.0,
    type: 'keychain',
    cityId: 'city_006',
    cityName: '丽江',
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'
    ],
    specs: {
      colors: ['silver', 'white', 'blue'],
      shapes: ['circle'],
      sizes: ['small']
    },
    stock: 500,
    sales: 1256,
    rating: 4.8,
    reviews: 136,
    tags: ['雪山', '钥匙扣', '丽江'],
    createdAt: '2024-02-25'
  },
  {
    id: 'prod_015',
    name: '纳西东巴文明信片',
    description: '世界上唯一仍在使用的象形文字，古老智慧的传承',
    price: 28.0,
    discountPrice: 22.0,
    originalPrice: 35.0,
    type: 'postcard',
    cityId: 'city_006',
    cityName: '丽江',
    images: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600'
    ],
    specs: {
      colors: ['white'],
      shapes: ['rectangle'],
      sizes: ['medium']
    },
    stock: 600,
    sales: 856,
    rating: 4.8,
    reviews: 92,
    tags: ['东巴文', '象形文字', '文化'],
    createdAt: '2024-03-12'
  },
  {
    id: 'prod_016',
    name: '新疆大巴扎主题冰箱贴',
    description: '浓郁西域风情，大巴扎建筑造型，让异域风情走进生活',
    price: 32.0,
    discountPrice: 25.0,
    originalPrice: 38.0,
    type: 'refrigerator_magnet',
    cityId: 'city_007',
    cityName: '乌鲁木齐',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    specs: {
      colors: ['gold', 'blue', 'red'],
      shapes: ['square', 'circle'],
      sizes: ['small', 'medium']
    },
    stock: 400,
    sales: 986,
    rating: 4.7,
    reviews: 106,
    tags: ['西域', '大巴扎', '风情'],
    createdAt: '2024-03-18'
  },
  {
    id: 'prod_017',
    name: '新疆葡萄干手办',
    description: 'Q版可爱的葡萄精灵，新疆特色美食的萌化形象',
    price: 98.0,
    discountPrice: 78.0,
    originalPrice: 118.0,
    type: 'figurine',
    cityId: 'city_007',
    cityName: '乌鲁木齐',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    specs: {
      colors: ['green', 'purple', 'gold'],
      shapes: ['circle'],
      sizes: ['small', 'medium']
    },
    stock: 300,
    sales: 562,
    rating: 4.8,
    reviews: 62,
    tags: ['葡萄', '美食', '手办'],
    createdAt: '2024-03-22'
  },
  {
    id: 'prod_018',
    name: '赛里木湖风景T恤',
    description: '大西洋最后一滴眼泪，赛里木湖的纯净之美穿在身上',
    price: 89.0,
    discountPrice: 69.0,
    originalPrice: 109.0,
    type: 't_shirt',
    cityId: 'city_008',
    cityName: '伊犁',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600'
    ],
    specs: {
      colors: ['white', 'blue', 'lightblue'],
      shapes: ['rectangle'],
      sizes: ['small', 'medium', 'large', 'xlarge']
    },
    stock: 350,
    sales: 756,
    rating: 4.8,
    reviews: 82,
    tags: ['赛里木湖', '风景', '舒适'],
    createdAt: '2024-03-25'
  },
  {
    id: 'prod_019',
    name: '薰衣草精油手办礼盒',
    description: '霍城薰衣草的芬芳，以手办形式呈现，附赠迷你精油瓶',
    price: 158.0,
    discountPrice: 128.0,
    originalPrice: 188.0,
    type: 'figurine',
    cityId: 'city_008',
    cityName: '伊犁',
    images: [
      'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600'
    ],
    specs: {
      colors: ['purple', 'white', 'pink'],
      shapes: ['circle'],
      sizes: ['small', 'medium']
    },
    stock: 250,
    sales: 456,
    rating: 4.9,
    reviews: 56,
    tags: ['薰衣草', '精油', '礼盒'],
    createdAt: '2024-03-28'
  },
  {
    id: 'prod_020',
    name: '那拉提草原风光明信片套装',
    description: '空中草原的四季美景，风吹草低见牛羊的诗情画意',
    price: 32.0,
    discountPrice: 25.0,
    originalPrice: 38.0,
    type: 'postcard',
    cityId: 'city_008',
    cityName: '伊犁',
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600'
    ],
    specs: {
      colors: ['white'],
      shapes: ['rectangle'],
      sizes: ['medium']
    },
    stock: 500,
    sales: 656,
    rating: 4.7,
    reviews: 72,
    tags: ['草原', '风景', '套装'],
    createdAt: '2024-04-01'
  }
]

export function getProductById(id) {
  return PRODUCTS.find(p => p.id === id)
}

export function getProductsByCity(cityId) {
  return PRODUCTS.filter(p => p.cityId === cityId)
}

export function getProductsByType(typeId) {
  return PRODUCTS.filter(p => p.type === typeId)
}

export function searchProducts(keyword, filters = {}) {
  let results = PRODUCTS.filter(p => {
    const lowerKeyword = keyword.toLowerCase()
    return p.name.toLowerCase().includes(lowerKeyword) ||
           p.description.toLowerCase().includes(lowerKeyword) ||
           p.cityName.toLowerCase().includes(lowerKeyword) ||
           p.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
  })
  
  if (filters.type) {
    results = results.filter(p => p.type === filters.type)
  }
  
  if (filters.cityId) {
    results = results.filter(p => p.cityId === filters.cityId)
  }
  
  if (filters.minPrice !== undefined) {
    results = results.filter(p => (p.discountPrice || p.price) >= filters.minPrice)
  }
  
  if (filters.maxPrice !== undefined) {
    results = results.filter(p => (p.discountPrice || p.price) <= filters.maxPrice)
  }
  
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'price-asc':
        results.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price))
        break
      case 'price-desc':
        results.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price))
        break
      case 'sales':
        results.sort((a, b) => b.sales - a.sales)
        break
      case 'rating':
        results.sort((a, b) => b.rating - a.rating)
        break
      default:
        break
    }
  }
  
  return results
}

export function calculateCustomPrice(options) {
  const type = PRODUCT_TYPES[options.type?.toUpperCase()] || PRODUCT_TYPES.REFRIGERATOR_MAGNET
  const shape = SHAPES.find(s => s.id === options.shape) || SHAPES[0]
  const size = SIZES.find(s => s.id === options.size) || SIZES[1]
  
  let basePrice = type.basePrice
  basePrice *= shape.priceMultiplier
  basePrice *= size.multiplier
  
  if (options.customImage) {
    basePrice += 20
  }
  
  if (options.customText) {
    basePrice += 10
  }
  
  return Math.round(basePrice * 100) / 100
}
