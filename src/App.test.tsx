import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

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
        permissions: ['INVENTORY_READ', 'PURCHASE_ORDER_READ', 'PURCHASE_ORDER_CREATE'],
      },
    }),
    fetchInventory: vi.fn().mockResolvedValue([]),
    fetchPurchaseOrders: vi.fn().mockResolvedValue([]),
    fetchCenters: vi.fn().mockResolvedValue([{ id: 1, code: 'C001', name: '강남 센터' }]),
    fetchWarehouses: vi.fn().mockResolvedValue([]),
    fetchProducts: vi.fn().mockResolvedValue([]),
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

describe('purchase order entry', () => {
  it('opens the purchase-order screen for a user with purchase-order permission', async () => {
    renderApp()

    await screen.findByText('Store Manager')
    fireEvent.click(screen.getByRole('button', { name: /발주/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '발주 관리' })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: '발주 신청' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '발주 내역' })).toBeInTheDocument()
  })
})
