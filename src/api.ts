import type { Center, InventoryItem, LoginResponse, Product, PurchaseOrder, Warehouse } from './types'

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
    const text = await response.text()
    let message = text
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.message === 'string') {
        message = parsed.message
      }
    } catch {
      // Non-JSON error body; fall back to the raw text.
    }
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

// /v1/products is a paged endpoint (Spring Page); unwrap content into the flat list the UI uses.
// A large page size is requested so the ordering dropdown shows the full catalog.
export const fetchProducts = async (): Promise<Product[]> => {
  const page = await apiRequest<{ content?: Product[] }>('/v1/products?page=0&size=1000')
  return Array.isArray(page) ? (page as Product[]) : page.content ?? []
}

export const fetchPurchaseOrders = () => apiRequest<PurchaseOrder[]>('/v1/purchase-orders')

export async function createPurchaseOrder(centerId: string, warehouseId: string): Promise<PurchaseOrder> {
  const params = new URLSearchParams({ centerId })
  if (warehouseId) {
    params.set('warehouseId', warehouseId)
  }
  return apiRequest<PurchaseOrder>(`/v1/purchase-orders?${params.toString()}`, { method: 'POST' })
}

/**
 * Creates a store-originated purchase request. The originating store comes from the logged-in
 * user's membership; the center/warehouse are designated later by an administrator at approval,
 * so the store user does not pick them.
 */
export async function createStoreRequest(): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>('/v1/purchase-orders/store-request', { method: 'POST' })
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
