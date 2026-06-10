import { describe, expect, it } from 'vitest'
import {
  canAccess,
  canManagePurchaseOrder,
  canUseChatbot,
  filterInventory,
  isClientViewId,
  isLowStock,
  validatePurchaseOrderDraft,
  visibleMenuItems,
} from './domain'
import type { AuthenticatedUser, InventoryItem, PurchaseOrder } from './types'

const user: AuthenticatedUser = {
  id: 1,
  email: 'store@stockops.local',
  name: 'Store User',
  role: 'STORE_MANAGER',
  permissions: ['INVENTORY_READ', 'PURCHASE_ORDER_READ'],
}

describe('navigation access', () => {
  it('keeps chat out of the menu while allowing the floating chatbot by role', () => {
    expect(visibleMenuItems(user).map((item) => item.id)).toEqual(['inventory', 'orders'])
    expect(canUseChatbot(user)).toBe(true)
    expect(canAccess({ ...user, role: 'STORE_STAFF' }, { id: 'orders', label: '발주', permission: 'PURCHASE_ORDER_CREATE' })).toBe(false)
  })
})

describe('inventory filters', () => {
  const rows: InventoryItem[] = [
    { id: 1, productName: '프리미엄 우유', locationId: 10, quantity: 20, reservedQuantity: 2, safetyStockQuantity: 30 },
    { id: 2, productName: '냉동 닭가슴살', locationId: 11, quantity: 80, reservedQuantity: 0, safetyStockQuantity: 20 },
  ]

  it('detects low stock by available quantity', () => {
    expect(isLowStock(rows[0])).toBe(true)
    expect(isLowStock(rows[1])).toBe(false)
  })

  it('filters by query and low stock flag', () => {
    expect(filterInventory(rows, { query: '우유', lowStockOnly: true }).map((item) => item.id)).toEqual([1])
    expect(filterInventory(rows, { query: '닭', warehouseId: '10', lowStockOnly: false })).toEqual([])
  })
})

describe('purchase order draft validation', () => {
  it('requires center, product, positive quantity, and reason', () => {
    const errors = validatePurchaseOrderDraft({
      centerId: '',
      warehouseId: '',
      productId: '',
      quantity: '0',
      reason: '',
      expectedDate: '',
    })

    expect(errors.centerId).toBeTruthy()
    expect(errors.productId).toBeTruthy()
    expect(errors.quantity).toBeTruthy()
    expect(errors.reason).toBeTruthy()
  })
})

describe('purchase order permissions', () => {
  const order: PurchaseOrder = {
    id: 100,
    status: 'PENDING',
    requestedBy: 1,
  }

  it('allows the creator or store manager to manage purchase orders', () => {
    expect(canManagePurchaseOrder(user, order)).toBe(true)
    expect(canManagePurchaseOrder({ ...user, id: 2 }, order)).toBe(true)
    expect(canManagePurchaseOrder({ ...user, id: 1, role: 'STORE_STAFF' }, order)).toBe(true)
  })

  it('rejects non-creators without the store manager role', () => {
    expect(canManagePurchaseOrder({ ...user, id: 2, role: 'STORE_STAFF' }, order)).toBe(false)
    expect(canManagePurchaseOrder(null, order)).toBe(false)
  })
})

describe('client view guard', () => {
  it('allows only supported client app views', () => {
    expect(isClientViewId('inventory')).toBe(true)
    expect(isClientViewId('orders')).toBe(true)
    expect(isClientViewId('chat')).toBe(false)
    expect(isClientViewId('unknown')).toBe(false)
  })
})
