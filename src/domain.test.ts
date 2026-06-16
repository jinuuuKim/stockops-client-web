import { describe, expect, it } from 'vitest'
import {
  canAccess,
  canCancelPurchaseOrder,
  canManagePurchaseOrder,
  filterInventory,
  groupInventoryByBarcode,
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
  it('shows only inventory and orders in the client menu', () => {
    expect(visibleMenuItems(user).map((item) => item.id)).toEqual(['inventory', 'orders'])
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

describe('inventory barcode grouping', () => {
  const rows: InventoryItem[] = [
    { id: 1, productName: '오징어링', productBarcode: '8800001', locationName: 'A-01', lotNumber: 'L1', quantity: 10, availableQuantity: 10, safetyStockQuantity: 25 },
    { id: 2, productName: '오징어링', productBarcode: '8800001', locationName: 'B-02', lotNumber: 'L2', quantity: 8, availableQuantity: 8, safetyStockQuantity: 25 },
    { id: 3, productName: '우유', productBarcode: '8800002', locationName: 'A-01', lotNumber: 'L9', quantity: 50, availableQuantity: 50, safetyStockQuantity: 20 },
  ]

  it('collapses same-barcode rows, summing availability and counting locations/lots', () => {
    const grouped = groupInventoryByBarcode(rows)
    expect(grouped).toHaveLength(2)

    const squid = grouped[0]
    expect(squid.productBarcode).toBe('8800001')
    expect(squid.rowCount).toBe(2)
    expect(squid.totalAvailable).toBe(18)
    expect(squid.locationLabel).toBe('2개 위치')
    expect(squid.lotLabel).toBe('2개 로트')
    expect(squid.isLow).toBe(true) // 18 <= safety 25

    const milk = grouped[1]
    expect(milk.rowCount).toBe(1)
    expect(milk.locationLabel).toBe('A-01')
    expect(milk.isLow).toBe(false)
  })

  it('falls back to product id when a barcode is missing', () => {
    const grouped = groupInventoryByBarcode([
      { id: 1, productId: 7, productName: '무바코드', locationName: 'A', quantity: 3, availableQuantity: 3 },
      { id: 2, productId: 7, productName: '무바코드', locationName: 'B', quantity: 4, availableQuantity: 4 },
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].totalAvailable).toBe(7)
    expect(grouped[0].productBarcode).toBeUndefined()
  })
})

describe('purchase order draft validation', () => {
  it('requires product, positive quantity, and reason (store picks no center/warehouse)', () => {
    const errors = validatePurchaseOrderDraft({
      productId: '',
      quantity: '0',
      reason: '',
      expectedDate: '',
    })

    expect(errors.centerId).toBeUndefined()
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

  it('allows cancelling only before approval', () => {
    expect(canCancelPurchaseOrder(user, { ...order, status: 'REQUESTED' })).toBe(true)
    expect(canCancelPurchaseOrder(user, { ...order, status: 'DRAFT' })).toBe(true)
    expect(canCancelPurchaseOrder(user, { ...order, status: 'ACCEPTED' })).toBe(false)
    expect(canCancelPurchaseOrder(user, { ...order, status: 'COMPLETED' })).toBe(false)
    // a non-manager non-owner cannot cancel even a pre-approval order
    expect(canCancelPurchaseOrder({ ...user, id: 2, role: 'STORE_STAFF' }, { ...order, status: 'REQUESTED' })).toBe(false)
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
