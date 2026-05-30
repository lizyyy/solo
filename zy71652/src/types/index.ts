export type RouteStatus = 'draft' | 'confirmed' | 'rejected' | 'stored'
export type ColdChainStatus = 'ok' | 'warning' | 'timeout'
export type ExceptionType = 'duplicate_location' | 'cold_chain_timeout' | 'path_backtrack'

export interface OrderItem {
  id: string
  orderId: string
  sku: string
  locationId: string
  quantity: number
  coldChain: boolean
  coldChainMaxMin: number
}

export interface Order {
  id: string
  orderNo: string
  pickerId: string
  deadline: number
  status: RouteStatus
  notes: string
  createdAt: number
  items: OrderItem[]
}

export interface Location {
  id: string
  code: string
  x: number
  y: number
  isDuplicate: boolean
}

export interface RouteStop {
  id: string
  routeId: string
  orderItemId: string
  locationId: string
  sequence: number
  isInsertion: boolean
  coldChainStatus: ColdChainStatus
}

export interface Route {
  id: string
  name: string
  status: RouteStatus
  pickerId: string
  totalDistance: number
  estimatedMinutes: number
  notes: string
  createdAt: number
  updatedAt: number
  stops: RouteStop[]
}

export interface PathException {
  id: string
  routeId: string
  type: ExceptionType
  message: string
  detail: string
  resolved: boolean
  createdAt: number
}

export interface WarehouseState {
  orders: Order[]
  locations: Location[]
  routes: Route[]
  exceptions: PathException[]
  pickers: string[]
}
