import type { AuthenticatedUser, InventoryItem, PurchaseOrder, RoleName } from './types'

export type NavItem = {
  id: 'inventory' | 'orders' | 'chat'
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
  { id: 'chat', label: 'AI 챗봇', roles: ['ADMIN', 'CENTER', 'WAREHOUSE', 'STORE_MANAGER', 'STORE_STAFF'] },
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
  return visibleNavItems(user).filter((item) => item.id !== 'chat')
}

export function canUseChatbot(user: AuthenticatedUser | null): boolean {
  const chatItem = navItems.find((item) => item.id === 'chat')
  return Boolean(chatItem && canAccess(user, chatItem))
}

export function canManagePurchaseOrder(user: AuthenticatedUser | null, order: PurchaseOrder): boolean {
  if (!user) {
    return false
  }

  return user.id === order.requestedBy || normalizeRole(user.role) === 'STORE_MANAGER'
}

export function isLowStock(item: InventoryItem): boolean {
  const available = item.availableQuantity ?? item.quantity - (item.reservedQuantity ?? 0)
  const safety = item.safetyStockQuantity ?? 0
  return safety > 0 && available <= safety
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

export type PurchaseOrderDraft = {
  centerId: string
  warehouseId: string
  productId: string
  quantity: string
  reason: string
  expectedDate: string
}

export function validatePurchaseOrderDraft(draft: PurchaseOrderDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.centerId) {
    errors.centerId = '센터를 선택하세요.'
  }
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
