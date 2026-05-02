import type {
  Ticket,
  Technician,
  Statistics,
  CreateTicketInput,
  UpdateTicketInput,
  MaterialInput,
  TicketStatus,
} from '../types'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `请求失败: ${response.status}`)
  }
  
  if (response.status === 204) {
    return undefined as T
  }
  
  return response.json()
}

export const ticketApi = {
  async list(params?: {
    status?: TicketStatus
    assignedToId?: string
    startDate?: string
    endDate?: string
  }): Promise<Ticket[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.assignedToId) searchParams.set('assignedToId', params.assignedToId)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    
    const query = searchParams.toString()
    return request<Ticket[]>(`/tickets${query ? `?${query}` : ''}`)
  },
  
  async getById(id: string): Promise<Ticket> {
    return request<Ticket>(`/tickets/${id}`)
  },
  
  async create(input: CreateTicketInput): Promise<Ticket> {
    return request<Ticket>('/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  
  async update(id: string, input: UpdateTicketInput): Promise<Ticket> {
    return request<Ticket>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },
  
  async transition(id: string, status: TicketStatus): Promise<Ticket> {
    return request<Ticket>(`/tickets/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
  },
  
  async updateMaterials(id: string, materials: MaterialInput[]): Promise<Ticket> {
    return request<Ticket>(`/tickets/${id}/materials`, {
      method: 'PUT',
      body: JSON.stringify({ materials }),
    })
  },
  
  async delete(id: string): Promise<void> {
    return request<void>(`/tickets/${id}`, {
      method: 'DELETE',
    })
  },
}

export const technicianApi = {
  async list(): Promise<Technician[]> {
    return request<Technician[]>('/technicians')
  },
  
  async create(name: string): Promise<Technician> {
    return request<Technician>('/technicians', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },
  
  async delete(id: string): Promise<void> {
    return request<void>(`/technicians/${id}`, {
      method: 'DELETE',
    })
  },
}

export const statisticsApi = {
  async get(params?: { startDate?: string; endDate?: string }): Promise<Statistics> {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    
    const query = searchParams.toString()
    return request<Statistics>(`/statistics${query ? `?${query}` : ''}`)
  },
}
