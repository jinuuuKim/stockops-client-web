import type { AuthenticatedUser, InventoryItem, PurchaseOrder, RoleName } from './types'

export type NavItem = {
  id: 'inventory' | 'orders'
  label: string
  permission?: string
  roles?: string[]
}

export type ClientViewId = 'inventory' | 'orders'

export function isClientViewId(value: string): value is ClientViewId {
  return value === 'inventory' || value === 'orders'
}

export const navItems: NavItem[] = [
  { id: 'inventory', label: '재고 조회', permission: 'INVENTORY_READ' },
  { id: 'orders', label: '발주', permission: 'PURCHASE_ORDER_READ' },
]

export function canAccess(user: AuthenticatedUser | null, item: NavItem): boolean {
  if (!user) {
    return false
  }
  if (item.roles && !item.roles.includes(normalizeRole(user.role))) {
    return false
  }
  return !item.permission || user.permissions.includes(item.permission)
}

export function normalizeRole(role: RoleName): string {
  const upper = String(role).toUpperCase()
  if (upper === 'GLOBAL' || upper === 'SUPER_ADMIN' || upper === 'HQ_ADMIN') {
    return 'ADMIN'
  }
  return upper
}

export function visibleNavItems(user: AuthenticatedUser | null): NavItem[] {
  return navItems.filter((item) => canAccess(user, item))
}

export function visibleMenuItems(user: AuthenticatedUser | null): NavItem[] {
  return visibleNavItems(user)
}

export function canManagePurchaseOrder(user: AuthenticatedUser | null, order: PurchaseOrder): boolean {
  if (!user) {
    return false
  }

  // The server serializes requestedBy as the User entity (object); older shapes used a bare id.
  const requesterId = typeof order.requestedBy === 'object' && order.requestedBy !== null
    ? order.requestedBy.id
    : order.requestedBy
  return user.id === requesterId || normalizeRole(user.role) === 'STORE_MANAGER'
}

/**
 * Statuses at/after administrator approval — a store request can no longer be cancelled.
 */
const NON_CANCELLABLE_ORDER_STATUSES = new Set([
  'ACCEPTED',
  'PARTIALLY_ACCEPTED',
  'SHIPMENT_CREATED',
  'INBOUND_PENDING',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
])

/**
 * Whether the current user may cancel this order: only the owner/store-manager, and only before
 * the order is approved (mirrors the server-side rule).
 */
export function canCancelPurchaseOrder(user: AuthenticatedUser | null, order: PurchaseOrder): boolean {
  if (!canManagePurchaseOrder(user, order)) {
    return false
  }
  return !NON_CANCELLABLE_ORDER_STATUSES.has((order.status ?? '').toUpperCase())
}

export function availableQuantityOf(item: InventoryItem): number {
  return item.availableQuantity ?? item.quantity - (item.reservedQuantity ?? 0)
}

export function isLowStock(item: InventoryItem): boolean {
  const safety = item.safetyStockQuantity ?? 0
  return safety > 0 && availableQuantityOf(item) <= safety
}

/**
 * A barcode-collapsed inventory row: all stock for one product (same barcode, falling back to
 * product id) merged into a single line with summed availability and location/lot counts. Keeps
 * the list short when the same product sits across many locations/lots.
 */
export type GroupedInventoryRow = {
  key: string
  productId?: number
  productName?: string
  productBarcode?: string
  totalAvailable: number
  locationLabel: string
  lotLabel: string
  rowCount: number
  status: string
  safetyStockQuantity?: number
  isLow: boolean
}

export function groupInventoryByBarcode(items: InventoryItem[]): GroupedInventoryRow[] {
  const groups = new Map<string, InventoryItem[]>()
  const order: string[] = []
  for (const item of items) {
    const barcode = item.productBarcode?.trim()
    const key = barcode ? `b:${barcode}` : item.productId != null ? `p:${item.productId}` : `i:${item.id}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      groups.set(key, [item])
      order.push(key)
    }
  }

  return order.map((key) => {
    const rows = groups.get(key)!
    const first = rows[0]
    const totalAvailable = rows.reduce((sum, item) => sum + availableQuantityOf(item), 0)
    const locations = new Set(rows.map((item) => item.locationName ?? item.locationCode ?? '-'))
    const lots = new Set(rows.map((item) => item.lotNumber ?? '-'))
    const statuses = new Set(rows.map((item) => item.status ?? 'ACTIVE'))
    const safety = first.safetyStockQuantity
    return {
      key,
      productId: first.productId,
      productName: first.productName,
      productBarcode: first.productBarcode,
      totalAvailable,
      locationLabel: locations.size === 1 ? [...locations][0] : `${locations.size}개 위치`,
      lotLabel: lots.size === 1 ? [...lots][0] : `${lots.size}개 로트`,
      rowCount: rows.length,
      status: statuses.size === 1 ? [...statuses][0] : '혼합',
      safetyStockQuantity: safety,
      isLow: (safety ?? 0) > 0 && totalAvailable <= (safety ?? 0),
    }
  })
}

export function filterInventory(
  items: InventoryItem[],
  filters: { query: string; centerId?: string; warehouseId?: string; lowStockOnly: boolean },
): InventoryItem[] {
  const query = filters.query.trim().toLowerCase()
  return items.filter((item) => {
    const matchesQuery =
      query.length === 0 ||
      [item.productName, item.productBarcode, item.locationCode, item.locationName, item.lotNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    const itemCenterId = (item as InventoryItem & { centerId?: number | null }).centerId
    const matchesCenter = !filters.centerId || String(itemCenterId ?? '') === filters.centerId
    const matchesWarehouse = !filters.warehouseId || String(item.locationId ?? '') === filters.warehouseId
    const matchesLowStock = !filters.lowStockOnly || isLowStock(item)
    return matchesQuery && matchesCenter && matchesWarehouse && matchesLowStock
  })
}

/**
 * Store-originated purchase request draft. The store comes from the logged-in user's membership,
 * and the receiving center/warehouse are designated by an administrator at approval — so the store
 * user does not pick them here.
 */
export type PurchaseOrderDraft = {
  productId: string
  quantity: string
  reason: string
  expectedDate: string
}

export function validatePurchaseOrderDraft(draft: PurchaseOrderDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.productId) {
    errors.productId = '상품을 선택하세요.'
  }
  const quantity = Number(draft.quantity)
  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.quantity = '수량은 1 이상의 정수여야 합니다.'
  }
  if (!draft.reason.trim()) {
    errors.reason = '발주 사유를 입력하세요.'
  }
  if (draft.expectedDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const requested = new Date(draft.expectedDate)
    if (Number.isNaN(requested.getTime()) || requested < today) {
      errors.expectedDate = '희망 입고일은 오늘 이후여야 합니다.'
    }
  }
  return errors
}
