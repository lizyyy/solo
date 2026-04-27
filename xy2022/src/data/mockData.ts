import type {
  ServiceType,
  ServiceOption,
  Feeder,
  DogInfo,
  Address,
  Order,
  Coupon,
  Announcement,
  PriceItem,
  Review,
} from '../types';

export const serviceTypes: ServiceType[] = [
  {
    id: 'feeding',
    name: '上门喂狗',
    icon: '🍖',
    basePrice: 35,
    unit: '次',
    description: '专业喂养师上门为您的爱犬提供喂养服务',
  },
  {
    id: 'walking',
    name: '上门遛狗',
    icon: '🐕',
    basePrice: 45,
    unit: '30分钟',
    description: '陪伴狗狗外出散步，消耗精力，保持健康',
  },
  {
    id: 'boarding',
    name: '寄养服务',
    icon: '🏠',
    basePrice: 120,
    unit: '天',
    description: '专业寄养环境，24小时专人照料',
  },
  {
    id: 'bathing',
    name: '洗澡服务',
    icon: '🛁',
    basePrice: 68,
    unit: '次',
    description: '专业洗护，让狗狗焕然一新',
  },
];

export const serviceOptions: Record<string, ServiceOption[]> = {
  feeding: [
    { id: 'feed', name: '投粮喂食', price: 0 },
    { id: 'water', name: '更换饮用水', price: 0 },
    { id: 'poop', name: '清理粪便', price: 10 },
    { id: 'video', name: '拍摄视频', price: 15 },
    { id: 'kennel', name: '清理狗窝', price: 20 },
  ],
  walking: [
    { id: 'walk', name: '外出遛狗', price: 0 },
    { id: 'poop', name: '清理粪便', price: 10 },
    { id: 'video', name: '拍摄视频', price: 15 },
    { id: 'play', name: '互动玩耍', price: 20 },
  ],
  boarding: [
    { id: 'stay', name: '全天照料', price: 0 },
    { id: 'walk_daily', name: '每日遛狗', price: 30 },
    { id: 'video_daily', name: '每日视频', price: 20 },
    { id: 'special_feed', name: '特殊喂养', price: 25 },
  ],
  bathing: [
    { id: 'bath', name: '基础洗澡', price: 0 },
    { id: 'blow_dry', name: '吹干造型', price: 20 },
    { id: 'nail_trim', name: '剪指甲', price: 15 },
    { id: 'ear_clean', name: '耳道清洁', price: 15 },
  ],
};

export const additionalServices: ServiceOption[] = [
  { id: 'nail_trim', name: '剪指甲', price: 20 },
  { id: 'ear_clean', name: '耳道清洁', price: 15 },
  { id: 'tooth_brush', name: '刷牙服务', price: 25 },
  { id: 'medication', name: '喂药服务', price: 30 },
];

export const feeders: Feeder[] = [
  {
    id: '1',
    name: '张小花',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=friendly%20female%20pet%20care%20worker%20portrait%20professional%20smiling&image_size=square',
    rating: 4.9,
    reviewCount: 256,
    distance: 0.8,
    experience: 5,
    services: ['feeding', 'walking', 'bathing'],
    available: true,
    completedOrders: 380,
  },
  {
    id: '2',
    name: '李明',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=young%20male%20dog%20walker%20portrait%20friendly%20active&image_size=square',
    rating: 4.8,
    reviewCount: 189,
    distance: 1.2,
    experience: 3,
    services: ['feeding', 'walking', 'boarding'],
    available: true,
    completedOrders: 245,
  },
  {
    id: '3',
    name: '王芳',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20female%20pet%20groomer%20portrait%20experienced%20kind&image_size=square',
    rating: 4.95,
    reviewCount: 412,
    distance: 1.5,
    experience: 8,
    services: ['feeding', 'bathing', 'walking'],
    available: true,
    completedOrders: 567,
  },
  {
    id: '4',
    name: '陈伟',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=middle%20aged%20male%20pet%20trainer%20portrait%20calm%20trustworthy&image_size=square',
    rating: 4.7,
    reviewCount: 156,
    distance: 2.1,
    experience: 4,
    services: ['walking', 'boarding'],
    available: false,
    completedOrders: 210,
  },
  {
    id: '5',
    name: '刘洋',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=young%20female%20animal%20lover%20portrait%20cheerful%20energetic&image_size=square',
    rating: 4.85,
    reviewCount: 98,
    distance: 0.6,
    experience: 2,
    services: ['feeding', 'walking'],
    available: true,
    completedOrders: 132,
  },
];

export const dogBreeds = [
  '金毛犬', '拉布拉多', '哈士奇', '萨摩耶', '柯基',
  '柴犬', '泰迪', '比熊', '博美', '雪纳瑞',
  '边牧', '德牧', '阿拉斯加', '贵宾', '法斗',
  '英斗', '巴哥', '马尔济斯', '约克夏', '吉娃娃',
  '其他品种',
];

export const dogPersonalities = [
  '活泼好动', '温顺亲人', '独立冷静', '粘人爱撒娇',
  '胆小怕生', '热情友善', '警惕性高', '安静乖巧',
];

export const sampleDogs: DogInfo[] = [
  {
    id: '1',
    name: '旺财',
    breed: '金毛犬',
    age: 3,
    weight: 28,
    personality: '活泼好动',
    isAggressive: false,
    dietaryRestrictions: '不能吃巧克力、洋葱，对鸡肉过敏',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20golden%20retriever%20dog%20portrait%20smiling%20friendly&image_size=square',
  },
  {
    id: '2',
    name: '豆豆',
    breed: '柯基',
    age: 2,
    weight: 12,
    personality: '粘人爱撒娇',
    isAggressive: false,
    dietaryRestrictions: '需要控制饮食，避免肥胖',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cute%20welsh%20corgi%20dog%20portrait%20playful%20adorable&image_size=square',
  },
];

export const sampleAddresses: Address[] = [
  {
    id: '1',
    name: '张三',
    phone: '13800138000',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detail: '科技园南路88号 阳光花园A栋1502室',
    isDefault: true,
  },
  {
    id: '2',
    name: '李四',
    phone: '13900139000',
    province: '广东省',
    city: '深圳市',
    district: '福田区',
    detail: '中心一路66号 星河世纪B座2205室',
    isDefault: false,
  },
];

export const priceList: PriceItem[] = [
  {
    id: '1',
    serviceId: 'feeding',
    serviceName: '上门喂狗',
    basePrice: 35,
    distanceFee: 5,
    urgentFee: 20,
    unit: '次',
  },
  {
    id: '2',
    serviceId: 'walking',
    serviceName: '上门遛狗',
    basePrice: 45,
    distanceFee: 5,
    urgentFee: 25,
    unit: '30分钟',
  },
  {
    id: '3',
    serviceId: 'boarding',
    serviceName: '寄养服务',
    basePrice: 120,
    distanceFee: 0,
    urgentFee: 50,
    unit: '天',
  },
  {
    id: '4',
    serviceId: 'bathing',
    serviceName: '洗澡服务',
    basePrice: 68,
    distanceFee: 8,
    urgentFee: 30,
    unit: '次',
  },
];

export const announcements: Announcement[] = [
  {
    id: '1',
    title: '节假日加价通知',
    content: '春节、国庆、五一等法定节假日期间，所有服务价格上浮30%。请提前预约，错峰出行。',
    type: 'holiday',
    createTime: '2026-01-15',
  },
  {
    id: '2',
    title: '禁养品种说明',
    content: '根据当地法规，以下品种暂不提供服务：藏獒、比特犬、土佐斗犬、阿根廷杜高、高加索犬等烈性犬种。',
    type: 'restriction',
    createTime: '2026-02-01',
  },
  {
    id: '3',
    title: '服务范围说明',
    content: '目前服务范围：深圳市主城区（南山、福田、罗湖、宝安中心区）。其他区域请咨询客服确认。',
    type: 'scope',
    createTime: '2026-03-10',
  },
];

export const sampleCoupons: Coupon[] = [
  {
    id: '1',
    name: '新用户专享',
    discount: 20,
    minAmount: 50,
    expireTime: '2026-06-30',
    isUsed: false,
  },
  {
    id: '2',
    name: '满100减30',
    discount: 30,
    minAmount: 100,
    expireTime: '2026-05-31',
    isUsed: false,
  },
  {
    id: '3',
    name: '老用户回馈',
    discount: 15,
    minAmount: 0,
    expireTime: '2026-04-30',
    isUsed: true,
  },
];

export const sampleReviews: Review[] = [
  {
    id: '1',
    rating: 5,
    content: '张小花喂养师非常专业，准时到达，照顾得很细心，还拍了很多视频，狗狗很开心！下次还会选择她。',
    photos: [],
    createTime: '2026-04-20',
    feederId: '1',
    orderId: 'ORD20260420001',
  },
  {
    id: '2',
    rating: 4,
    content: '李明师傅遛狗很负责，狗狗回家后很满足。唯一的小问题是迟到了5分钟，不过提前说了，还可以接受。',
    photos: [],
    createTime: '2026-04-18',
    feederId: '2',
    orderId: 'ORD20260418003',
  },
];

export const generateOrderNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${random}`;
};

export const getStatusText = (status: Order['status']): string => {
  const map: Record<Order['status'], string> = {
    pending_payment: '待付款',
    pending_accept: '待接单',
    in_progress: '进行中',
    completed: '已完成',
    refund: '退款售后',
  };
  return map[status];
};

export const getStatusColor = (status: Order['status']): string => {
  const map: Record<Order['status'], string> = {
    pending_payment: '#FF9500',
    pending_accept: '#007AFF',
    in_progress: '#34C759',
    completed: '#8E8E93',
    refund: '#FF3B30',
  };
  return map[status];
};
