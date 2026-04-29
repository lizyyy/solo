import { ref, watch } from 'vue'

const STORAGE_KEYS = {
  FOLLOWING: 'kitchen_master_following',
  THEME: 'kitchen_master_theme',
  POINTS: 'kitchen_master_points',
  WHEEL_CHANCES: 'kitchen_master_wheel_chances',
  LAST_SIGNIN: 'kitchen_master_last_signin'
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage not available')
  }
}

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch (e) {
    console.warn('localStorage not available')
    return defaultValue
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export const wheelDailyChances = ref(3)
export const wheelExtraChances = ref(loadFromStorage(STORAGE_KEYS.WHEEL_CHANCES, 0))
export const lastSigninDate = ref(loadFromStorage(STORAGE_KEYS.LAST_SIGNIN, ''))

watch(wheelExtraChances, (val) => {
  saveToStorage(STORAGE_KEYS.WHEEL_CHANCES, val)
}, { deep: true })

export function getTotalWheelChances() {
  if (lastSigninDate.value === getTodayStr()) {
    return wheelDailyChances.value + wheelExtraChances.value
  }
  return wheelDailyChances.value + wheelExtraChances.value
}

export function useWheelChance() {
  if (wheelDailyChances.value > 0) {
    wheelDailyChances.value--
    return true
  }
  if (wheelExtraChances.value > 0) {
    wheelExtraChances.value--
    saveToStorage(STORAGE_KEYS.WHEEL_CHANCES, wheelExtraChances.value)
    return true
  }
  return false
}

export function addWheelChance(count = 1) {
  wheelExtraChances.value += count
  saveToStorage(STORAGE_KEYS.WHEEL_CHANCES, wheelExtraChances.value)
}

export const categories = ref([
  { id: 1, name: '川菜', icon: '🌶️', color: '#ff6b6b' },
  { id: 2, name: '粤菜', icon: '🥮', color: '#ffd93d' },
  { id: 3, name: '湘菜', icon: '🍖', color: '#6bcb77' },
  { id: 4, name: '鲁菜', icon: '🍗', color: '#4ecdc4' },
  { id: 5, name: '苏菜', icon: '🐟', color: '#a55eea' },
  { id: 6, name: '浙菜', icon: '🦐', color: '#fd79a8' },
  { id: 7, name: '闽菜', icon: '🍲', color: '#00b894' },
  { id: 8, name: '徽菜', icon: '🍚', color: '#e17055' },
  { id: 9, name: '甜品', icon: '🍰', color: '#fd79a8' },
  { id: 10, name: '下午茶', icon: '☕', color: '#6c5ce7' },
  { id: 11, name: '减脂餐', icon: '🥗', color: '#00b894' },
  { id: 12, name: '家常菜', icon: '🍳', color: '#fdcb6e' }
])

const imagePrompt = (foodName) => {
  const baseUrl = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'
  const prompt = encodeURIComponent(`美食摄影照片，${foodName}，精美摆盘，专业灯光，高清，4k，餐厅风格`)
  return `${baseUrl}?prompt=${prompt}&image_size=square_hd`
}

const userAvatarPrompt = (gender = 'female') => {
  const baseUrl = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'
  const prompt = encodeURIComponent(`头像照片，${gender === 'female' ? '可爱年轻女性' : '帅气年轻男性'}，微笑，清新风格，高清`)
  return `${baseUrl}?prompt=${prompt}&image_size=square_hd`
}

export const users = ref([
  {
    id: 1,
    name: '美食达人小王',
    avatar: userAvatarPrompt('female'),
    level: 12,
    points: 3580,
    favorites: 28,
    posts: 45,
    followers: 1256,
    following: 89
  },
  {
    id: 2,
    name: '烘焙师小美',
    avatar: userAvatarPrompt('female'),
    level: 8,
    points: 2100,
    favorites: 15,
    posts: 32,
    followers: 890,
    following: 56
  },
  {
    id: 3,
    name: '厨师老李',
    avatar: userAvatarPrompt('male'),
    level: 15,
    points: 5200,
    favorites: 45,
    posts: 78,
    followers: 2500,
    following: 120
  }
])

export const currentUser = ref(users.value[0])

export const followingList = ref(loadFromStorage(STORAGE_KEYS.FOLLOWING, [2, 3]))

watch(followingList, (val) => {
  saveToStorage(STORAGE_KEYS.FOLLOWING, val)
}, { deep: true })

export const recipes = ref([
  {
    id: 1,
    title: '麻婆豆腐',
    categoryId: 1,
    categoryName: '川菜',
    image: imagePrompt('麻婆豆腐'),
    author: users.value[2],
    rating: 4.8,
    ratingCount: 1256,
    favoriteCount: 3456,
    viewCount: 28900,
    difficulty: '简单',
    time: '30分钟',
    calories: 280,
    description: '经典川菜，麻辣鲜香，豆腐嫩滑入味，是下饭神器。',
    tags: ['川菜', '麻辣', '下饭', '家常菜'],
    isFavorite: false,
    ingredients: [
      { name: '嫩豆腐', amount: '400g', unit: '块' },
      { name: '牛肉末', amount: '100g', unit: '克' },
      { name: '郫县豆瓣酱', amount: '2勺', unit: '勺' },
      { name: '花椒粉', amount: '1勺', unit: '勺' },
      { name: '蒜末', amount: '2瓣', unit: '瓣' },
      { name: '姜末', amount: '1小块', unit: '块' },
      { name: '葱花', amount: '适量', unit: '' },
      { name: '生抽', amount: '1勺', unit: '勺' },
      { name: '淀粉', amount: '1勺', unit: '勺' }
    ],
    steps: [
      { order: 1, description: '豆腐切成2厘米见方的块，放入加了盐的开水中焯烫2分钟，去除豆腥味后捞出沥干。', image: imagePrompt('豆腐切块焯水') },
      { order: 2, description: '锅中放油，下入牛肉末炒至变色，加入豆瓣酱炒出红油。', image: imagePrompt('炒牛肉末和豆瓣酱') },
      { order: 3, description: '加入蒜末、姜末炒香，加入适量清水，放入豆腐块轻轻推动，不要搅碎。', image: imagePrompt('加入豆腐炖煮') },
      { order: 4, description: '大火烧开后转中火煮5-8分钟，让豆腐入味。', image: imagePrompt('炖煮豆腐') },
      { order: 5, description: '加入生抽调味，用水淀粉勾芡，出锅前撒上花椒粉和葱花即可。', image: imagePrompt('出锅撒花椒粉葱花') }
    ],
    tips: '豆腐用盐水焯烫可以去除豆腥味，同时让豆腐更不容易碎。勾芡时要用中火，轻轻推动豆腐。'
  },
  {
    id: 2,
    title: '白切鸡',
    categoryId: 2,
    categoryName: '粤菜',
    image: imagePrompt('白切鸡'),
    author: users.value[1],
    rating: 4.9,
    ratingCount: 890,
    favoriteCount: 2100,
    viewCount: 18500,
    difficulty: '中等',
    time: '60分钟',
    calories: 320,
    description: '粤菜经典，皮爽肉嫩，原汁原味，配上姜葱蘸料更是绝配。',
    tags: ['粤菜', '清淡', '鸡肉', '宴客菜'],
    isFavorite: true,
    ingredients: [
      { name: '三黄鸡', amount: '1只', unit: '只' },
      { name: '姜片', amount: '5片', unit: '片' },
      { name: '葱段', amount: '3段', unit: '段' },
      { name: '料酒', amount: '2勺', unit: '勺' },
      { name: '盐', amount: '适量', unit: '' },
      { name: '冰块', amount: '适量', unit: '' },
      { name: '姜蓉', amount: '2勺', unit: '勺' },
      { name: '葱花', amount: '适量', unit: '' },
      { name: '香油', amount: '1勺', unit: '勺' }
    ],
    steps: [
      { order: 1, description: '三黄鸡清洗干净，锅中加水放入姜片、葱段、料酒，水烧开后放入鸡，保持微沸状态浸煮20分钟。', image: imagePrompt('浸煮三黄鸡') },
      { order: 2, description: '期间将鸡提起2-3次，让鸡腔内的水流出，保证受热均匀。', image: imagePrompt('提起鸡控温') },
      { order: 3, description: '煮好后立即放入冰水中浸泡30分钟，让鸡皮爽脆。', image: imagePrompt('冰水浸泡鸡肉') },
      { order: 4, description: '制作蘸料：姜蓉加少许盐，淋上热油，加入葱花和香油拌匀。', image: imagePrompt('制作姜葱蘸料') },
      { order: 5, description: '鸡沥干水分，斩块装盘，配上蘸料即可食用。', image: imagePrompt('斩块装盘白切鸡') }
    ],
    tips: '浸煮时保持水微沸状态，不要大火煮，否则鸡肉会老。冰水浸泡是让鸡皮爽脆的关键。'
  },
  {
    id: 3,
    title: '草莓提拉米苏',
    categoryId: 9,
    categoryName: '甜品',
    image: imagePrompt('草莓提拉米苏'),
    author: users.value[1],
    rating: 4.9,
    ratingCount: 678,
    favoriteCount: 2345,
    viewCount: 15600,
    difficulty: '中等',
    time: '4小时',
    calories: 380,
    description: '经典意式甜品，加入新鲜草莓，酸甜可口，口感丰富，下午茶的完美选择。',
    tags: ['甜品', '下午茶', '意式', '草莓'],
    isFavorite: false,
    ingredients: [
      { name: '马斯卡彭奶酪', amount: '250g', unit: '克' },
      { name: '淡奶油', amount: '200ml', unit: '毫升' },
      { name: '手指饼干', amount: '200g', unit: '克' },
      { name: '浓缩咖啡', amount: '200ml', unit: '毫升' },
      { name: '蛋黄', amount: '3个', unit: '个' },
      { name: '细砂糖', amount: '80g', unit: '克' },
      { name: '新鲜草莓', amount: '200g', unit: '克' },
      { name: '可可粉', amount: '适量', unit: '' },
      { name: '朗姆酒', amount: '1勺', unit: '勺' }
    ],
    steps: [
      { order: 1, description: '蛋黄加糖打发至颜色变浅，体积膨胀。马斯卡彭奶酪打至顺滑。', image: imagePrompt('打发蛋黄和奶酪') },
      { order: 2, description: '淡奶油打发至6分发，与奶酪糊混合均匀。', image: imagePrompt('混合奶油和奶酪糊') },
      { order: 3, description: '浓缩咖啡放凉，加入朗姆酒。手指饼干快速蘸取咖啡液，铺在容器底部。', image: imagePrompt('蘸咖啡铺手指饼干') },
      { order: 4, description: '铺一层奶酪糊，撒上切好的草莓丁，再铺一层蘸了咖啡的手指饼干。', image: imagePrompt('铺奶酪糊和草莓') },
      { order: 5, description: '最后铺一层奶酪糊，表面抹平，放入冰箱冷藏至少4小时。食用前筛上可可粉，用新鲜草莓装饰。', image: imagePrompt('冷藏后装饰草莓') }
    ],
    tips: '手指饼干不要蘸太久咖啡液，否则会变软塌陷。冷藏时间越长，风味越好。'
  },
  {
    id: 4,
    title: '经典英式下午茶套餐',
    categoryId: 10,
    categoryName: '下午茶',
    image: imagePrompt('英式下午茶套餐'),
    author: users.value[1],
    rating: 4.8,
    ratingCount: 456,
    favoriteCount: 1890,
    viewCount: 12300,
    difficulty: '中等',
    time: '2.5小时',
    calories: 450,
    description: '传统英式下午茶，包含三明治、司康、甜点三层塔，配上伯爵茶，享受悠闲午后时光。',
    tags: ['下午茶', '英式', '甜点', '休闲'],
    isFavorite: false,
    ingredients: [
      { name: '低筋面粉', amount: '200g', unit: '克' },
      { name: '黄油', amount: '50g', unit: '克' },
      { name: '鸡蛋', amount: '2个', unit: '个' },
      { name: '牛奶', amount: '100ml', unit: '毫升' },
      { name: '泡打粉', amount: '1勺', unit: '勺' },
      { name: '淡奶油', amount: '200ml', unit: '毫升' },
      { name: '草莓果酱', amount: '适量', unit: '' },
      { name: '白吐司', amount: '4片', unit: '片' },
      { name: '黄瓜', amount: '1根', unit: '根' },
      { name: '烟熏三文鱼', amount: '100g', unit: '克' },
      { name: '奶油奶酪', amount: '50g', unit: '克' }
    ],
    steps: [
      { order: 1, description: '制作司康：面粉、泡打粉过筛，加入黄油搓成屑状，加入糖、鸡蛋和牛奶揉成面团，冷藏30分钟。', image: imagePrompt('制作司康面团') },
      { order: 2, description: '面团擀成2cm厚，用模具切出圆形，表面刷蛋液，180度烤15-20分钟至金黄。', image: imagePrompt('烘烤司康') },
      { order: 3, description: '制作三明治：吐司去边，涂上奶油奶酪，分别夹入黄瓜片、烟熏三文鱼等，切成三角形。', image: imagePrompt('制作下午茶三明治') },
      { order: 4, description: '淡奶油打发至硬性发泡，与草莓果酱一起作为司康的搭配。', image: imagePrompt('打发奶油和果酱') },
      { order: 5, description: '按传统英式方式摆盘：底层放三明治，中层放司康配奶油和果酱，顶层放小甜点，配上一壶伯爵茶。', image: imagePrompt('摆盘英式下午茶三层塔') }
    ],
    tips: '司康要趁热吃，搭配凝脂奶油(clotted cream)和果酱是传统吃法。三明治要做的小巧精致，方便拿取。'
  },
  {
    id: 5,
    title: '藜麦鸡胸肉沙拉',
    categoryId: 11,
    categoryName: '减脂餐',
    image: imagePrompt('藜麦鸡胸肉沙拉'),
    author: users.value[0],
    rating: 4.7,
    ratingCount: 567,
    favoriteCount: 2100,
    viewCount: 18900,
    difficulty: '简单',
    time: '25分钟',
    calories: 320,
    description: '高蛋白低卡减脂餐，藜麦提供优质碳水，鸡胸肉补充蛋白质，搭配多种蔬菜，营养均衡又美味。',
    tags: ['减脂', '低卡', '高蛋白', '健康'],
    isFavorite: true,
    ingredients: [
      { name: '藜麦', amount: '50g', unit: '克' },
      { name: '鸡胸肉', amount: '150g', unit: '克' },
      { name: '西兰花', amount: '100g', unit: '克' },
      { name: '樱桃番茄', amount: '100g', unit: '克' },
      { name: '生菜', amount: '50g', unit: '克' },
      { name: '紫甘蓝', amount: '30g', unit: '克' },
      { name: '牛油果', amount: '半个', unit: '个' },
      { name: '橄榄油', amount: '2勺', unit: '勺' },
      { name: '柠檬汁', amount: '1勺', unit: '勺' },
      { name: '黑胡椒', amount: '适量', unit: '' },
      { name: '盐', amount: '适量', unit: '' }
    ],
    steps: [
      { order: 1, description: '藜麦提前浸泡30分钟，加水煮15分钟至透明，捞出沥干放凉。', image: imagePrompt('煮藜麦') },
      { order: 2, description: '鸡胸肉用盐、黑胡椒腌制10分钟，平底锅煎至两面金黄熟透，放凉后撕成条。', image: imagePrompt('煎鸡胸肉') },
      { order: 3, description: '西兰花切小朵，焯水2分钟捞出过冷水，保持翠绿。', image: imagePrompt('焯水西兰花') },
      { order: 4, description: '生菜、紫甘蓝切丝，樱桃番茄切半，牛油果切小块。', image: imagePrompt('准备沙拉蔬菜') },
      { order: 5, description: '所有材料放入大碗，淋上橄榄油、柠檬汁，撒上盐和黑胡椒，拌匀即可。', image: imagePrompt('拌匀藜麦沙拉') }
    ],
    tips: '藜麦一定要煮到透明，露出白色胚芽才是熟透。鸡胸肉不要煎太久，保持嫩度。橄榄油和柠檬汁是健康的沙拉酱选择。'
  },
  {
    id: 6,
    title: '番茄炒蛋',
    categoryId: 12,
    categoryName: '家常菜',
    image: imagePrompt('番茄炒蛋'),
    author: users.value[0],
    rating: 4.6,
    ratingCount: 2345,
    favoriteCount: 5678,
    viewCount: 45600,
    difficulty: '简单',
    time: '15分钟',
    calories: 180,
    description: '国民家常菜，酸甜可口，简单易做，是每个厨房新手的入门菜。',
    tags: ['家常菜', '快手菜', '下饭', '入门'],
    isFavorite: false,
    ingredients: [
      { name: '番茄', amount: '2个', unit: '个' },
      { name: '鸡蛋', amount: '3个', unit: '个' },
      { name: '葱花', amount: '适量', unit: '' },
      { name: '盐', amount: '适量', unit: '' },
      { name: '白糖', amount: '1勺', unit: '勺' },
      { name: '食用油', amount: '适量', unit: '' }
    ],
    steps: [
      { order: 1, description: '番茄顶部划十字，用开水烫一下去皮，切成小块。鸡蛋打散加少许盐。', image: imagePrompt('处理番茄和鸡蛋') },
      { order: 2, description: '锅中多放油，油热后倒入蛋液，快速划散成大块，盛出备用。', image: imagePrompt('炒鸡蛋盛出') },
      { order: 3, description: '锅中留底油，放入番茄块翻炒，加盐和白糖，炒出汁。', image: imagePrompt('炒番茄出汁') },
      { order: 4, description: '番茄出汁变软后，倒入炒好的鸡蛋，翻炒均匀让鸡蛋裹上番茄汁。', image: imagePrompt('混合鸡蛋和番茄') },
      { order: 5, description: '出锅前撒上葱花即可。', image: imagePrompt('出锅撒葱花番茄炒蛋') }
    ],
    tips: '鸡蛋要炒嫩，油温要高，快速翻炒。番茄要炒出汁才好吃，加点白糖可以中和酸味，让味道更鲜美。'
  },
  {
    id: 7,
    title: '红烧肉',
    categoryId: 1,
    categoryName: '川菜',
    image: imagePrompt('红烧肉'),
    author: users.value[2],
    rating: 4.9,
    ratingCount: 1890,
    favoriteCount: 4560,
    viewCount: 35600,
    difficulty: '中等',
    time: '90分钟',
    calories: 520,
    description: '经典家常菜，肥而不腻，入口即化，色泽红亮，是宴请宾客的必备硬菜。',
    tags: ['家常菜', '猪肉', '宴客菜', '下饭'],
    isFavorite: false,
    ingredients: [
      { name: '五花肉', amount: '500g', unit: '克' },
      { name: '冰糖', amount: '30g', unit: '克' },
      { name: '生抽', amount: '2勺', unit: '勺' },
      { name: '老抽', amount: '1勺', unit: '勺' },
      { name: '料酒', amount: '2勺', unit: '勺' },
      { name: '八角', amount: '2个', unit: '个' },
      { name: '桂皮', amount: '1小块', unit: '块' },
      { name: '姜片', amount: '5片', unit: '片' },
      { name: '葱段', amount: '3段', unit: '段' }
    ],
    steps: [
      { order: 1, description: '五花肉切成3厘米见方的块，冷水下锅焯水，去除血沫后捞出洗净。', image: imagePrompt('五花肉焯水') },
      { order: 2, description: '锅中放少许油，放入冰糖小火炒至融化呈焦糖色。', image: imagePrompt('炒糖色') },
      { order: 3, description: '放入焯好的五花肉翻炒上色，加入姜片、葱段、八角、桂皮炒香。', image: imagePrompt('翻炒五花肉上色') },
      { order: 4, description: '加入料酒、生抽、老抽翻炒均匀，加入没过肉的开水，大火烧开后转小火炖1小时。', image: imagePrompt('炖煮红烧肉') },
      { order: 5, description: '最后大火收汁，至汤汁浓稠裹在肉上，即可出锅。', image: imagePrompt('收汁出锅红烧肉') }
    ],
    tips: '炒糖色时要用小火，避免炒糊。炖肉时要用开水，这样肉质更软烂。收汁时要不断翻动，防止粘锅。'
  },
  {
    id: 8,
    title: '芒果班戟',
    categoryId: 9,
    categoryName: '甜品',
    image: imagePrompt('芒果班戟'),
    author: users.value[1],
    rating: 4.8,
    ratingCount: 567,
    favoriteCount: 1890,
    viewCount: 12500,
    difficulty: '中等',
    time: '40分钟',
    calories: 280,
    description: '港式经典甜品，Q弹的班戟皮包裹着香浓奶油和新鲜芒果，一口下去多重口感。',
    tags: ['甜品', '港式', '芒果', '下午茶'],
    isFavorite: false,
    ingredients: [
      { name: '低筋面粉', amount: '80g', unit: '克' },
      { name: '牛奶', amount: '200ml', unit: '毫升' },
      { name: '鸡蛋', amount: '2个', unit: '个' },
      { name: '黄油', amount: '20g', unit: '克' },
      { name: '细砂糖', amount: '30g', unit: '克' },
      { name: '淡奶油', amount: '200ml', unit: '毫升' },
      { name: '糖粉', amount: '20g', unit: '克' },
      { name: '芒果', amount: '2个', unit: '个' }
    ],
    steps: [
      { order: 1, description: '面粉过筛，加入牛奶、鸡蛋、糖搅拌均匀，融化黄油加入，过筛两次成细腻面糊。', image: imagePrompt('制作班戟面糊') },
      { order: 2, description: '平底锅小火加热，倒入一勺面糊，快速转动锅让面糊铺满锅底，煎至表面凝固即可，不需要翻面。', image: imagePrompt('煎班戟皮') },
      { order: 3, description: '淡奶油加糖粉打发至硬性发泡，芒果切块备用。', image: imagePrompt('打发奶油和切芒果') },
      { order: 4, description: '取一张班戟皮，中间放一勺奶油，放上芒果块，再盖上一勺奶油。', image: imagePrompt('放奶油和芒果') },
      { order: 5, description: '将班戟皮四边向中间折叠，包成方形，收口朝下放置，冷藏后食用更佳。', image: imagePrompt('包好芒果班戟') }
    ],
    tips: '班戟皮要煎得薄而均匀，火不要太大。奶油要打发硬一点，包的时候才不容易漏。芒果要选择熟透的，甜度更高。'
  }
])

export const wheelPrizes = ref([
  { id: 1, name: '川菜推荐', color: '#ff6b6b', recipeIds: [1, 7] },
  { id: 2, name: '粤菜推荐', color: '#ffd93d', recipeIds: [2] },
  { id: 3, name: '甜品推荐', color: '#fd79a8', recipeIds: [3, 8] },
  { id: 4, name: '下午茶推荐', color: '#6c5ce7', recipeIds: [4] },
  { id: 5, name: '减脂推荐', color: '#00b894', recipeIds: [5] },
  { id: 6, name: '家常菜推荐', color: '#fdcb6e', recipeIds: [6, 7] },
  { id: 7, name: '再来一次', color: '#74b9ff', recipeIds: [] },
  { id: 8, name: '随机组合', color: '#a29bfe', recipeIds: [1, 2, 3, 4, 5, 6, 7, 8] }
])

export const posts = ref([
  {
    id: 1,
    title: '今天做了超级成功的提拉米苏！分享一下心得',
    content: '第一次尝试做提拉米苏，没想到这么成功！马斯卡彭奶酪一定要选好的，手指饼干不要蘸太久咖啡液，不然会太湿。冷藏了一晚上，味道真的超棒！大家有什么问题可以问我~',
    images: [
      imagePrompt('成功的提拉米苏成品'),
      imagePrompt('提拉米苏切面展示'),
      imagePrompt('提拉米苏摆盘装饰')
    ],
    author: users.value[1],
    createdAt: '2026-04-29 14:30',
    likes: 256,
    comments: 45,
    shares: 12,
    isLiked: false,
    recipeId: 3,
    tags: ['烘焙', '提拉米苏', '甜品', '成功案例']
  },
  {
    id: 2,
    title: '减脂第30天打卡！藜麦沙拉真的太好吃了',
    content: '坚持减脂一个月了，体重掉了8斤！这款藜麦鸡胸肉沙拉是我最近的最爱，饱腹感强，热量又低。鸡胸肉用黑胡椒和少许盐腌制一下，煎出来一点都不柴。推荐给所有想要健康饮食的朋友们！',
    images: [
      imagePrompt('减脂餐藜麦沙拉摆盘'),
      imagePrompt('减脂前后对比图'),
      imagePrompt('健身运动图片')
    ],
    author: users.value[0],
    createdAt: '2026-04-28 19:20',
    likes: 412,
    comments: 68,
    shares: 35,
    isLiked: true,
    recipeId: 5,
    tags: ['减脂', '健康饮食', '打卡', '藜麦沙拉']
  },
  {
    id: 3,
    title: '周末在家做了一整套英式下午茶',
    content: '周末和闺蜜在家搞了个下午茶派对，做了一整套三层塔：司康配凝脂奶油和草莓酱，各种三明治，还有小甜点。配上一壶伯爵茶，聊了一下午，太惬意了！司康的方子是跟着厨房里的教程做的，非常成功！',
    images: [
      imagePrompt('英式下午茶三层塔'),
      imagePrompt('闺蜜下午茶聚会'),
      imagePrompt('司康配奶油和果酱')
    ],
    author: users.value[1],
    createdAt: '2026-04-27 16:45',
    likes: 189,
    comments: 32,
    shares: 8,
    isLiked: false,
    recipeId: 4,
    tags: ['下午茶', '闺蜜聚会', '周末', '英式']
  },
  {
    id: 4,
    title: '白切鸡这样做，皮爽肉嫩！秘诀分享',
    content: '做了无数次白切鸡，总结出几个关键点：1. 一定要选三黄鸡，肉质细嫩；2. 浸煮时水保持微沸，不要大开；3. 煮好后立刻冰水浸泡，这是鸡皮爽脆的关键！蘸料用姜蓉淋热油，香到不行！',
    images: [
      imagePrompt('皮爽肉嫩的白切鸡'),
      imagePrompt('白切鸡斩块摆盘'),
      imagePrompt('姜葱蘸料')
    ],
    author: users.value[2],
    createdAt: '2026-04-26 11:30',
    likes: 567,
    comments: 89,
    shares: 45,
    isLiked: false,
    recipeId: 2,
    tags: ['粤菜', '白切鸡', '烹饪技巧', '家常']
  }
])

export const comments = ref([
  {
    id: 1,
    recipeId: 1,
    userId: 2,
    userName: '烘焙师小美',
    userAvatar: userAvatarPrompt('female'),
    content: '按照这个方子做出来的麻婆豆腐真的超级好吃！麻辣鲜香，豆腐嫩滑，我还加了一点花椒油，更香了！',
    rating: 5,
    createdAt: '2026-04-28 18:30',
    likes: 23,
    isLiked: false,
    images: [imagePrompt('用户做的麻婆豆腐')],
    replies: [
      {
        id: 101,
        userId: 3,
        userName: '厨师老李',
        userAvatar: userAvatarPrompt('male'),
        content: '花椒油确实是点睛之笔，我一般会在最后淋上去，香气更浓郁！',
        createdAt: '2026-04-28 19:00'
      }
    ]
  },
  {
    id: 2,
    recipeId: 1,
    userId: 3,
    userName: '厨师老李',
    userAvatar: userAvatarPrompt('male'),
    content: '不错的方子，建议牛肉末先用料酒腌制一下，去腥效果更好。另外勾芡后可以淋一点明油，色泽更亮。',
    rating: 4,
    createdAt: '2026-04-27 09:15',
    likes: 45,
    isLiked: false,
    images: [],
    replies: []
  },
  {
    id: 3,
    recipeId: 3,
    userId: 1,
    userName: '美食达人小王',
    userAvatar: userAvatarPrompt('female'),
    content: '第一次做提拉米苏就成功了！加了草莓真的超好吃，酸甜解腻。马斯卡彭奶酪一定要室温软化，不然很难打发。',
    rating: 5,
    createdAt: '2026-04-25 15:20',
    likes: 67,
    isLiked: true,
    images: [imagePrompt('用户做的草莓提拉米苏')],
    replies: []
  },
  {
    id: 4,
    postId: 1,
    userId: 3,
    userName: '厨师老李',
    userAvatar: userAvatarPrompt('male'),
    content: '做得真棒！提拉米苏的切面看起来很完美，层次分明。是用马斯卡彭奶酪吗？',
    createdAt: '2026-04-29 16:00',
    likes: 5,
    isLiked: false
  },
  {
    id: 5,
    postId: 1,
    userId: 1,
    userName: '美食达人小王',
    userAvatar: userAvatarPrompt('female'),
    content: '看起来太好吃了！我也要试试看，请问手指饼干在哪里买的呀？',
    createdAt: '2026-04-29 17:30',
    likes: 3,
    isLiked: false
  }
])

export const checkinRecords = ref([
  {
    id: 2,
    date: '2026-04-29',
    recipeId: 1,
    recipeTitle: '麻婆豆腐',
    recipeImage: imagePrompt('麻婆豆腐'),
    note: '今天做了川菜，配米饭超下饭！家人都说好吃。',
    images: [imagePrompt('打卡麻婆豆腐实拍')],
    calories: 280,
    duration: 30
  },
  {
    id: 3,
    date: '2026-04-28',
    recipeId: 3,
    recipeTitle: '草莓提拉米苏',
    recipeImage: imagePrompt('草莓提拉米苏'),
    note: '周末做个甜品犒劳自己，冷藏了一晚上，味道超棒！',
    images: [imagePrompt('打卡提拉米苏实拍')],
    calories: 380,
    duration: 240
  },
  {
    id: 4,
    date: '2026-04-26',
    recipeId: 6,
    recipeTitle: '番茄炒蛋',
    recipeImage: imagePrompt('番茄炒蛋'),
    note: '简单快手的家常菜，百吃不厌。',
    images: [imagePrompt('打卡番茄炒蛋实拍')],
    calories: 180,
    duration: 15
  },
  {
    id: 5,
    date: '2026-04-25',
    recipeId: 2,
    recipeTitle: '白切鸡',
    recipeImage: imagePrompt('白切鸡'),
    note: '朋友来家里做客，做了白切鸡，大家都夸皮爽肉嫩！',
    images: [imagePrompt('打卡白切鸡实拍')],
    calories: 320,
    duration: 60
  }
])

export const coupons = ref([
  {
    id: 1,
    title: '新用户专享',
    discount: '满50减10',
    discountType: 'full',
    fullAmount: 50,
    reduceAmount: 10,
    validFrom: '2026-04-01',
    validTo: '2026-05-31',
    status: 'available',
    description: '全场通用，除特殊商品外'
  },
  {
    id: 2,
    title: '烘焙专区',
    discount: '8折',
    discountType: 'percent',
    percent: 0.8,
    validFrom: '2026-04-15',
    validTo: '2026-05-15',
    status: 'available',
    description: '烘焙工具、原料专用'
  },
  {
    id: 3,
    title: '会员专享',
    discount: '满100减25',
    discountType: 'full',
    fullAmount: 100,
    reduceAmount: 25,
    validFrom: '2026-04-01',
    validTo: '2026-06-30',
    status: 'available',
    description: 'VIP会员专属优惠券'
  },
  {
    id: 4,
    title: '限时秒杀',
    discount: '满30减5',
    discountType: 'full',
    fullAmount: 30,
    reduceAmount: 5,
    validFrom: '2026-04-01',
    validTo: '2026-04-20',
    status: 'expired',
    description: '限时活动已过期'
  }
])

export const pointsHistory = ref([
  { id: 1, type: 'income', amount: 50, description: '每日签到', date: '2026-04-30 08:00', balance: 3580 },
  { id: 2, type: 'income', amount: 20, description: '浏览菜谱', date: '2026-04-30 09:30', balance: 3530 },
  { id: 3, type: 'income', amount: 100, description: '上传菜谱', date: '2026-04-29 15:00', balance: 3510 },
  { id: 4, type: 'income', amount: 30, description: '发表评论', date: '2026-04-29 18:30', balance: 3410 },
  { id: 5, type: 'expense', amount: 100, description: '兑换优惠券', date: '2026-04-28 12:00', balance: 3380 },
  { id: 6, type: 'income', amount: 50, description: '每日签到', date: '2026-04-28 08:00', balance: 3480 },
  { id: 7, type: 'income', amount: 200, description: '连续签到7天奖励', date: '2026-04-27 08:00', balance: 3430 }
])

export const browseHistory = ref([
  { id: 1, recipeId: 1, viewedAt: '2026-04-30 10:30' },
  { id: 2, recipeId: 3, viewedAt: '2026-04-30 09:15' },
  { id: 3, recipeId: 5, viewedAt: '2026-04-29 18:45' },
  { id: 4, recipeId: 2, viewedAt: '2026-04-29 14:20' },
  { id: 5, recipeId: 6, viewedAt: '2026-04-28 20:10' },
  { id: 6, recipeId: 4, viewedAt: '2026-04-28 16:30' },
  { id: 7, recipeId: 7, viewedAt: '2026-04-27 11:45' },
  { id: 8, recipeId: 8, viewedAt: '2026-04-27 09:20' }
])

export const themes = ref([
  { id: 'light', name: '浅色模式', primaryColor: '#ff6b6b', bgColor: '#f8f9fa', textColor: '#2d3436' },
  { id: 'dark', name: '深色模式', primaryColor: '#ff6b6b', bgColor: '#1a1a2e', textColor: '#ffffff' },
  { id: 'warm', name: '温暖橙', primaryColor: '#ff9f43', bgColor: '#fff5e6', textColor: '#2d3436' },
  { id: 'fresh', name: '清新绿', primaryColor: '#6bcb77', bgColor: '#f0fff4', textColor: '#2d3436' }
])

const savedThemeId = loadFromStorage(STORAGE_KEYS.THEME, 'light')
const savedTheme = themes.value.find(t => t.id === savedThemeId) || themes.value[0]
export const currentTheme = ref(savedTheme)

export function applyTheme(theme) {
  if (!theme) return
  
  const root = document.documentElement
  
  root.style.setProperty('--primary-color', theme.primaryColor)
  root.style.setProperty('--primary-light', lightenColor(theme.primaryColor, 20))
  root.style.setProperty('--primary-dark', darkenColor(theme.primaryColor, 20))
  
  if (theme.id === 'dark') {
    root.style.setProperty('--bg-primary', '#1a1a2e')
    root.style.setProperty('--bg-secondary', '#16213e')
    root.style.setProperty('--bg-tertiary', '#0f3460')
    root.style.setProperty('--text-primary', '#ffffff')
    root.style.setProperty('--text-secondary', '#a0a0a0')
    root.style.setProperty('--text-light', '#666666')
    root.style.setProperty('--border-color', '#2a2a4a')
  } else {
    root.style.setProperty('--bg-primary', '#ffffff')
    root.style.setProperty('--bg-secondary', theme.bgColor || '#f8f9fa')
    root.style.setProperty('--bg-tertiary', '#e9ecef')
    root.style.setProperty('--text-primary', theme.textColor || '#2d3436')
    root.style.setProperty('--text-secondary', '#636e72')
    root.style.setProperty('--text-light', '#b2bec3')
    root.style.setProperty('--border-color', '#dee2e6')
  }
  
  saveToStorage(STORAGE_KEYS.THEME, theme.id)
}

function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1)
}

function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) - amt
  const G = (num >> 8 & 0x00FF) - amt
  const B = (num & 0x0000FF) - amt
  return '#' + (
    0x1000000 +
    (R > 0 ? R : 0) * 0x10000 +
    (G > 0 ? G : 0) * 0x100 +
    (B > 0 ? B : 0)
  ).toString(16).slice(1)
}

export const shopItems = ref([
  {
    id: 1,
    name: '德国进口WMF不锈钢炒锅',
    price: 599,
    originalPrice: 899,
    image: imagePrompt('不锈钢炒锅'),
    category: '锅具',
    rating: 4.9,
    sales: 2345,
    tags: ['热销', '进口']
  },
  {
    id: 2,
    name: '日本进口象印电饭煲',
    price: 1299,
    originalPrice: 1699,
    image: imagePrompt('高端电饭煲'),
    category: '小家电',
    rating: 4.8,
    sales: 1567,
    tags: ['品质之选']
  },
  {
    id: 3,
    name: '意大利进口马斯卡彭奶酪500g',
    price: 68,
    originalPrice: 88,
    image: imagePrompt('马斯卡彭奶酪'),
    category: '食材',
    rating: 4.7,
    sales: 5678,
    tags: ['烘焙必备', '限时特惠']
  },
  {
    id: 4,
    name: '日本进口静音破壁机',
    price: 899,
    originalPrice: 1299,
    image: imagePrompt('破壁机'),
    category: '小家电',
    rating: 4.9,
    sales: 3456,
    tags: ['新品', '静音设计']
  }
])

export function getRecipesByCategory(categoryId) {
  return recipes.value.filter(r => r.categoryId === categoryId)
}

export function getRecipeById(id) {
  return recipes.value.find(r => r.id === id)
}

export function getCommentsByRecipe(recipeId) {
  return comments.value.filter(c => c.recipeId === recipeId)
}

export function getCommentsByPost(postId) {
  return comments.value.filter(c => c.postId === postId)
}

export function getPostById(id) {
  return posts.value.find(p => p.id === id)
}

export function toggleFavorite(recipeId) {
  const recipe = getRecipeById(recipeId)
  if (recipe) {
    recipe.isFavorite = !recipe.isFavorite
    recipe.favoriteCount += recipe.isFavorite ? 1 : -1
  }
}

export function togglePostLike(postId) {
  const post = posts.value.find(p => p.id === postId)
  if (post) {
    post.isLiked = !post.isLiked
    post.likes += post.isLiked ? 1 : -1
  }
}

export function toggleFollow(userId) {
  const index = followingList.value.indexOf(userId)
  if (index > -1) {
    followingList.value.splice(index, 1)
    return false
  } else {
    followingList.value.push(userId)
    return true
  }
}

export function isFollowing(userId) {
  return followingList.value.includes(userId)
}

export function addBrowseHistory(recipeId) {
  const existing = browseHistory.value.find(h => h.recipeId === recipeId)
  if (existing) {
    existing.viewedAt = new Date().toLocaleString('zh-CN')
  } else {
    browseHistory.value.unshift({
      id: browseHistory.value.length + 1,
      recipeId,
      viewedAt: new Date().toLocaleString('zh-CN')
    })
  }
}

export function addComment(recipeId, content, rating = 5) {
  const newComment = {
    id: comments.value.length + 1,
    recipeId,
    userId: currentUser.value.id,
    userName: currentUser.value.name,
    userAvatar: currentUser.value.avatar,
    content,
    rating,
    createdAt: new Date().toLocaleString('zh-CN'),
    likes: 0,
    isLiked: false,
    images: [],
    replies: []
  }
  comments.value.unshift(newComment)
  return newComment
}

export function addPostComment(postId, content) {
  const newComment = {
    id: comments.value.length + 1,
    postId,
    userId: currentUser.value.id,
    userName: currentUser.value.name,
    userAvatar: currentUser.value.avatar,
    content,
    createdAt: new Date().toLocaleString('zh-CN'),
    likes: 0,
    isLiked: false
  }
  comments.value.unshift(newComment)
  const post = getPostById(postId)
  if (post) post.comments++
  return newComment
}

export function addPost(title, content, images = [], tags = []) {
  const newPost = {
    id: posts.value.length + 1,
    title,
    content,
    images,
    author: currentUser.value,
    createdAt: new Date().toLocaleString('zh-CN'),
    likes: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    tags
  }
  posts.value.unshift(newPost)
  return newPost
}

export function addCheckin(recipeId, note = '', images = []) {
  const recipe = getRecipeById(recipeId)
  if (!recipe) return null
  
  const today = new Date().toISOString().split('T')[0]
  const newCheckin = {
    id: checkinRecords.value.length + 1,
    date: today,
    recipeId,
    recipeTitle: recipe.title,
    recipeImage: recipe.image,
    note,
    images,
    calories: recipe.calories,
    duration: parseInt(recipe.time) || 30
  }
  checkinRecords.value.unshift(newCheckin)
  return newCheckin
}

export function getCheckinByDate(date) {
  return checkinRecords.value.find(c => c.date === date)
}

export function getMonthlyCheckinCounts(year, month) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  return checkinRecords.value
    .filter(c => c.date.startsWith(monthStr))
    .map(c => c.date)
}
