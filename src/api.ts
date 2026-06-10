import type { Center, ChatMessage, InventoryItem, LoginResponse, Product, PurchaseOrder, Warehouse } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const result = await apiRequest<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAccessToken(result.accessToken)
  return result
}

export async function refreshSession(): Promise<LoginResponse> {
  const result = await apiRequest<LoginResponse>('/v1/auth/refresh', { method: 'POST' })
  setAccessToken(result.accessToken)
  return result
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/v1/auth/logout', { method: 'POST' })
  setAccessToken(null)
}

export const fetchInventory = () => apiRequest<InventoryItem[]>('/v1/inventory')
export const fetchCenters = () => apiRequest<Center[]>('/v1/centers')
export const fetchWarehouses = () => apiRequest<Warehouse[]>('/v1/warehouses')
export const fetchProducts = () => apiRequest<Product[]>('/v1/products')
export const fetchPurchaseOrders = () => apiRequest<PurchaseOrder[]>('/v1/purchase-orders')

export async function createPurchaseOrder(centerId: string, warehouseId: string): Promise<PurchaseOrder> {
  const params = new URLSearchParams({ centerId })
  if (warehouseId) {
    params.set('warehouseId', warehouseId)
  }
  return apiRequest<PurchaseOrder>(`/v1/purchase-orders?${params.toString()}`, { method: 'POST' })
}

export async function addPurchaseOrderItem(orderId: number, productId: string, quantity: string): Promise<PurchaseOrder> {
  const params = new URLSearchParams({ productId, quantity })
  return apiRequest<PurchaseOrder>(`/v1/purchase-orders/${orderId}/items?${params.toString()}`, { method: 'POST' })
}

export async function submitPurchaseOrder(orderId: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/v1/purchase-orders/${orderId}/submit`, { method: 'POST' })
}

export async function cancelPurchaseOrder(orderId: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/v1/purchase-orders/${orderId}/cancel`, { method: 'POST' })
}

export async function updatePurchaseOrder(orderId: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/v1/purchase-orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function sendChatMessage(content: string, context: ChatMessage[]): Promise<ChatMessage> {
  return apiRequest<ChatMessage>('/v1/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ content, context }),
  })
}
