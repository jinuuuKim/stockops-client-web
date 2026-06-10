export type RoleName = 'ADMIN' | 'CENTER' | 'WAREHOUSE' | 'STORE_MANAGER' | 'STORE_STAFF' | string

export type ScopeAssignment = {
  scope: 'ADMIN' | 'CENTER' | 'WAREHOUSE' | 'STORE'
  centerId?: number | null
  warehouseId?: number | null
}

export type ScopeMetadata = {
  global?: boolean
  assignments?: ScopeAssignment[]
  centerIds?: number[]
  warehouseIds?: number[]
}

export type AuthenticatedUser = {
  id: number
  email: string
  name: string
  role: RoleName
  permissions: string[]
  scopeMetadata?: ScopeMetadata
}

export type LoginResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: AuthenticatedUser
}

export type InventoryItem = {
  id: number
  productId?: number
  productName?: string
  productBarcode?: string
  locationId?: number
  locationCode?: string
  locationName?: string
  lotId?: number
  lotNumber?: string
  quantity: number
  reservedQuantity?: number
  availableQuantity?: number
  status?: string
  safetyStockQuantity?: number
}

export type Center = {
  id: number
  code: string
  name: string
}

export type Warehouse = {
  id: number
  code: string
  name: string
  centerId?: number
}

export type Product = {
  id: number
  barcode?: string
  name: string
  unit?: string
  safetyStockQuantity?: number
}

export type PurchaseOrder = {
  id: number
  poNumber?: string
  supplierName?: string
  supplier?: string
  status: string
  requestedAt?: string
  createdAt?: string
  requestedBy?: number
  requestingCenter?: Center
  targetWarehouse?: Warehouse
  items?: Array<{
    id: number
    product?: Product
    requestedQuantity?: number
    quantity?: number
  }>
}

export type ChatMessage = {
  messageId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type ChatRequest = {
  content: string
  context: ChatMessage[]
}
