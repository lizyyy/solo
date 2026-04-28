export interface Player {
  id: string
  name: string
  nickname: string
  avatar: string
  position: string
  game: string
  achievements: string[]
  joinDate: string
  description: string
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  cover: string
  category: 'news' | 'match_report'
  publishDate: string
  views: number
  content: string
}

export interface Match {
  id: string
  opponent: string
  opponentLogo: string
  game: string
  date: string
  time: string
  status: 'upcoming' | 'ongoing' | 'finished'
  result?: 'win' | 'lose' | 'draw'
  score?: {
    our: number
    opponent: number
  }
  tournament: string
  venue: string
}

export interface Product {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  category: 'clothing' | 'badge' | 'keycap' | 'poster'
  description: string
  stock: number
  sales: number
  tags: string[]
}

export interface CartItem {
  productId: string
  product: Product
  quantity: number
  selected: boolean
}

export interface Order {
  id: string
  orderNo: string
  items: CartItem[]
  totalPrice: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  createTime: string
  payTime?: string
  address: Address
}

export interface Address {
  id: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

export interface User {
  id: string
  nickname: string
  avatar: string
  phone: string
  level: number
  levelName: string
  points: number
  nextLevelPoints: number
  favoriteProducts: string[]
  favoritePlayers: string[]
}

export interface Activity {
  id: string
  title: string
  cover: string
  type: 'support' | 'meetup' | 'lottery'
  description: string
  startTime: string
  endTime: string
  maxParticipants: number
  currentParticipants: number
  status: 'upcoming' | 'ongoing' | 'ended'
}

export interface Message {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  createTime: string
  likes: number
  replies: Message[]
}

export interface Honor {
  id: string
  title: string
  tournament: string
  date: string
  icon: string
}

export interface HistoryItem {
  id: string
  year: string
  title: string
  description: string
  image: string
}
