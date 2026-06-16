import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// Regression guard for the white-screen crash on entering 발주: the server returns
// purchase orders / products as full JPA-entity serializations (nested objects, dates,
// Spring Page for products). An earlier build expected a bare products array and crashed
// on `products.data.map`. These mocks mirror the real API shapes so the orders page is
// exercised against realistic data, not just empty arrays.
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    refreshSession: vi.fn().mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: 1,
        email: 'store@stockops.local',
        name: 'Store Manager',
        role: 'STORE_MANAGER',
        permissions: ['INVENTORY_READ', 'PURCHASE_ORDER_READ', 'PURCHASE_ORDER_CREATE', 'PRODUCT_READ'],
      },
    }),
    fetchInventory: vi.fn().mockResolvedValue([]),
    fetchPurchaseOrders: vi.fn().mockResolvedValue([
      {
        id: 1,
        poNumber: 'PO-20260615-0001',
        requestingCenter: null,
        targetWarehouse: null,
        requestingStore: { id: 3, code: 'S001', name: '강남점' },
        supplierName: null,
        supplierCode: null,
        status: 'DRAFT',
        requestedBy: { id: 1, email: 'store@stockops.local', name: 'Store Manager' },
        createdAt: '2026-06-15T10:00:00',
        totalRequestedAmount: 0,
        totalAcceptedAmount: 0,
        items: [
          { id: 10, product: { id: 5, name: '콜라 500ml', barcode: '880001' }, requestedQuantity: 5, quantity: 5 },
        ],
        shipments: [],
      },
    ]),
    fetchProducts: vi.fn().mockResolvedValue([{ id: 5, name: '콜라 500ml', barcode: '880001' }]),
    fetchCenters: vi.fn().mockResolvedValue([]),
    fetchWarehouses: vi.fn().mockResolvedValue([]),
    logout: vi.fn().mockResolvedValue(undefined),
  }
})

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('orders page rendering', () => {
  it('renders the order list with realistic API data without crashing on entry', async () => {
    renderApp()
    await screen.findByText('Store Manager')
    fireEvent.click(screen.getByRole('button', { name: /발주/ }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '발주 관리' })).toBeInTheDocument()
    })
    await screen.findByText('PO-20260615-0001')
  })

  it('opens an order detail without crashing', async () => {
    renderApp()
    await screen.findByText('Store Manager')
    fireEvent.click(screen.getByRole('button', { name: /발주/ }))
    fireEvent.click(await screen.findByText('PO-20260615-0001'))
    await screen.findByRole('heading', { name: 'PO-20260615-0001' })
  })
})
