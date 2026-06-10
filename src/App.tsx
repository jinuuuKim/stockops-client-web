import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  LogOut,
  Menu,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  X,
} from 'lucide-react'
import {
  addPurchaseOrderItem,
  cancelPurchaseOrder,
  createPurchaseOrder,
  fetchCenters,
  fetchInventory,
  fetchProducts,
  fetchPurchaseOrders,
  fetchWarehouses,
  login,
  logout,
  refreshSession,
  sendChatMessage,
  submitPurchaseOrder,
} from './api'
import { appendChatMessage, clearChatMessages, loadChatMessages } from './chatSessionStorage'
import {
  canManagePurchaseOrder,
  canUseChatbot,
  filterInventory,
  isClientViewId,
  validatePurchaseOrderDraft,
  visibleMenuItems,
  type ClientViewId,
  type PurchaseOrderDraft,
} from './domain'
import type { AuthenticatedUser, ChatMessage, PurchaseOrder } from './types'

type ViewId = ClientViewId

const emptyDraft: PurchaseOrderDraft = {
  centerId: '',
  warehouseId: '',
  productId: '',
  quantity: '1',
  reason: '',
  expectedDate: '',
}

export default function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [view, setView] = useState<ViewId>('inventory')
  const [authChecked, setAuthChecked] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    refreshSession()
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  const nav = visibleMenuItems(user)
  const chatbotEnabled = canUseChatbot(user)
  const currentView = nav.some((item) => item.id === view) ? view : ((nav[0]?.id ?? 'inventory') as ViewId)

  if (!authChecked) {
    return <Splash />
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />
  }

  const handleLogout = async () => {
    await logout().catch(() => undefined)
    setUser(null)
    queryClient.clear()
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="brand">
          <PackageCheck size={26} />
          <div>
            <strong>StockOps</strong>
            <span>Client Portal</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
            className={currentView === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => {
                if (isClientViewId(item.id)) {
                  setView(item.id)
                }
                setMobileNavOpen(false)
              }}
            >
              {item.id === 'inventory' && <Boxes size={18} />}
              {item.id === 'orders' && <ShoppingCart size={18} />}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="user-card">
          <span>{user.role}</span>
          <strong>{user.name}</strong>
          <small>{user.email}</small>
          <button className="ghost-button" onClick={handleLogout}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileNavOpen(true)} aria-label="메뉴 열기">
            <Menu size={20} />
          </button>
          <div>
            <span className="eyebrow">권한 범위 기반 업무 화면</span>
            <h1>{currentView === 'inventory' ? '재고 조회' : '발주 관리'}</h1>
          </div>
        </header>
        {currentView === 'inventory' && <InventoryPage />}
        {currentView === 'orders' && <OrdersPage user={user} />}
      </main>
      <ChatbotOverlay enabled={chatbotEnabled} />
    </div>
  )
}

function Splash() {
  return (
    <div className="center-screen">
      <RefreshCw className="spin" size={28} />
      <p>세션을 확인하는 중입니다.</p>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (user: AuthenticatedUser) => void }) {
  const [email, setEmail] = useState('admin@stockops.com')
  const [password, setPassword] = useState('Password123!')

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (response) => onLogin(response.user),
  })

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="brand large">
          <PackageCheck size={34} />
          <div>
            <strong>StockOps</strong>
            <span>Client Portal</span>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate()
          }}
        >
          <label>
            이메일
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            비밀번호
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {mutation.isError && <p className="error-text">로그인에 실패했습니다. 계정 정보를 확인하세요.</p>}
          <button className="primary-button" disabled={mutation.isPending}>
            {mutation.isPending ? '로그인 중' : '로그인'}
          </button>
        </form>
      </section>
    </div>
  )
}

function InventoryPage() {
  const [query, setQuery] = useState('')
  const [centerId, setCenterId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const inventory = useQuery({ queryKey: ['inventory'], queryFn: fetchInventory })
  const centers = useQuery({ queryKey: ['centers'], queryFn: fetchCenters })
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses })

  const rows = useMemo(
    () => filterInventory(inventory.data ?? [], { query, centerId, warehouseId, lowStockOnly }),
    [centerId, inventory.data, lowStockOnly, query, warehouseId],
  )

  return (
    <section className="panel">
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상품, 바코드, 로트 검색" />
        </label>
        <select value={centerId} onChange={(event) => setCenterId(event.target.value)}>
          <option value="">전체 센터</option>
          {(centers.data ?? []).map((center) => (
            <option key={center.id} value={center.id}>
              {center.name}
            </option>
          ))}
        </select>
        <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">전체 위치</option>
          {(warehouses.data ?? []).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        <label className="checkline">
          <input checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} type="checkbox" />
          안전재고 이하
        </label>
      </div>
      {inventory.isLoading ? (
        <EmptyState title="재고를 불러오는 중입니다." />
      ) : inventory.isError ? (
        <EmptyState title="재고 조회에 실패했습니다." />
      ) : (
        <div className="data-table" role="table" aria-label="재고 목록">
          <div className="table-row head" role="row">
            <span>상품</span>
            <span>위치</span>
            <span>로트</span>
            <span>가용</span>
            <span>상태</span>
          </div>
          {rows.map((item) => {
            const available = item.availableQuantity ?? item.quantity - (item.reservedQuantity ?? 0)
            return (
              <div className="table-row" role="row" key={item.id}>
                <span>
                  <strong>{item.productName ?? `상품 #${item.productId}`}</strong>
                  <small>{item.productBarcode}</small>
                </span>
                <span>{item.locationName ?? item.locationCode ?? '-'}</span>
                <span>{item.lotNumber ?? '-'}</span>
                <span>{available.toLocaleString()}</span>
                <span className={available <= (item.safetyStockQuantity ?? -1) ? 'badge warn' : 'badge'}>{item.status ?? 'ACTIVE'}</span>
              </div>
            )
          })}
          {rows.length === 0 && <EmptyState title="조건에 맞는 재고가 없습니다." />}
        </div>
      )}
    </section>
  )
}

function OrdersPage({ user }: { user: AuthenticatedUser }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<PurchaseOrderDraft>(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [managementMessage, setManagementMessage] = useState('')
  const orders = useQuery({ queryKey: ['purchase-orders'], queryFn: fetchPurchaseOrders })
  const centers = useQuery({ queryKey: ['centers'], queryFn: fetchCenters })
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses })
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts })

  const hasEntryLoadError = orders.isError || centers.isError || warehouses.isError || products.isError

  const displayedOrder = useMemo(() => {
    if (!selectedOrder) {
      return null
    }
    return orders.data?.find((order) => order.id === selectedOrder.id) ?? selectedOrder
  }, [orders.data, selectedOrder])

  const canManageDisplayedOrder = Boolean(
    displayedOrder && displayedOrder.status === 'PENDING' && canManagePurchaseOrder(user, displayedOrder),
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      const validation = validatePurchaseOrderDraft(draft)
      setErrors(validation)
      if (Object.keys(validation).length > 0) {
        throw new Error('validation')
      }
      const order = await createPurchaseOrder(draft.centerId, draft.warehouseId)
      const withItem = await addPurchaseOrderItem(order.id, draft.productId, draft.quantity)
      return withItem
    },
    onSuccess: () => {
      setDraft(emptyDraft)
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  const submitMutation = useMutation({
    mutationFn: submitPurchaseOrder,
    onSuccess: (updatedOrder) => {
      setManagementMessage('발주가 제출되었습니다.')
      setSelectedOrder((current) => (current?.id === updatedOrder.id ? updatedOrder : current))
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelPurchaseOrder,
    onSuccess: (updatedOrder) => {
      setManagementMessage('발주가 취소되었습니다.')
      setSelectedOrder(updatedOrder)
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  return (
    <div className="grid-two">
      <section className="panel">
        <h2>발주 신청</h2>
        {hasEntryLoadError && (
          <p className="error-text" role="alert">
            발주 화면을 불러오는 중 일부 데이터 조회에 실패했습니다. 잠시 후 다시 시도하세요.
          </p>
        )}
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
        >
          <SelectField label="센터" value={draft.centerId} error={errors.centerId} onChange={(value) => setDraft({ ...draft, centerId: value })}>
            <option value="">센터 선택</option>
            {(centers.data ?? []).map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="창고"
            value={draft.warehouseId}
            onChange={(value) => setDraft({ ...draft, warehouseId: value })}
          >
            <option value="">창고 선택 안 함</option>
            {(warehouses.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="상품" value={draft.productId} error={errors.productId} onChange={(value) => setDraft({ ...draft, productId: value })}>
            <option value="">상품 선택</option>
            {(products.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </SelectField>
          <TextField label="수량" value={draft.quantity} error={errors.quantity} onChange={(value) => setDraft({ ...draft, quantity: value })} />
          <TextField label="희망 입고일" type="date" value={draft.expectedDate} error={errors.expectedDate} onChange={(value) => setDraft({ ...draft, expectedDate: value })} />
          <label>
            사유
            <textarea value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
            {errors.reason && <small className="error-text">{errors.reason}</small>}
          </label>
          {createMutation.isError && createMutation.error.message !== 'validation' && <p className="error-text">발주 생성에 실패했습니다.</p>}
          <button className="primary-button" disabled={createMutation.isPending}>
            {createMutation.isPending ? '제출 중' : '발주 신청'}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>발주 내역</h2>
        {orders.isLoading ? (
          <EmptyState title="발주 내역을 불러오는 중입니다." />
        ) : orders.isError ? (
          <EmptyState title="발주 내역 조회에 실패했습니다." />
        ) : (
          <div className="order-list">
            {(orders.data ?? []).map((order) => {
              const isSubmitting = submitMutation.isPending && submitMutation.variables === order.id
              return (
                <article className="order-item" key={order.id}>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setSelectedOrder(order)
                      setManagementMessage('')
                    }}
                  >
                    <span>
                      <strong>{order.poNumber ?? `PO-${order.id}`}</strong>
                      <small>{order.supplierName ?? order.supplier ?? '공급사 미지정'}</small>
                    </span>
                  </button>
                  <span className="badge">{order.status}</span>
                  <button className="primary-button" type="button" disabled={isSubmitting} onClick={() => submitMutation.mutate(order.id)}>
                    {isSubmitting ? '제출 중' : '제출'}
                  </button>
                </article>
              )
            })}
            {(orders.data ?? []).length === 0 && <EmptyState title="발주 내역이 없습니다." />}
          </div>
        )}
        {displayedOrder && (
          <section className="panel">
            <div className="drawer-head">
              <div>
                <h3>{displayedOrder.poNumber ?? `PO-${displayedOrder.id}`}</h3>
                <small>{displayedOrder.supplierName ?? displayedOrder.supplier ?? '공급사 미지정'}</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedOrder(null)} aria-label="발주 상세 닫기">
                <X size={18} />
              </button>
            </div>
            <div className="data-table" role="table" aria-label="발주 상세 정보">
              <div className="table-row" role="row">
                <span>상태</span>
                <span className="badge">{displayedOrder.status}</span>
                <span>생성일</span>
                <span>{formatDate(displayedOrder.createdAt ?? displayedOrder.requestedAt)}</span>
                <span>{displayedOrder.requestingCenter?.name ?? '-'}</span>
              </div>
            </div>
            <h4>품목</h4>
            <div className="order-list">
              {(displayedOrder.items ?? []).map((item) => (
                <article className="order-item" key={item.id}>
                  <div>
                    <strong>{item.product?.name ?? `상품 #${item.product?.id ?? item.id}`}</strong>
                    <small>수량 {(item.requestedQuantity ?? item.quantity ?? 0).toLocaleString()}</small>
                  </div>
                </article>
              ))}
              {(displayedOrder.items ?? []).length === 0 && <EmptyState title="발주 품목이 없습니다." />}
            </div>
            {canManageDisplayedOrder && (
              <div className="toolbar">
                <button className="ghost-button" type="button" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(displayedOrder.id)}>
                  {cancelMutation.isPending ? '취소 중' : '취소'}
                </button>
                <button className="ghost-button" type="button" onClick={() => setManagementMessage('수정은 상세 편집 API 연결 후 사용할 수 있습니다.')}>
                  수정
                </button>
              </div>
            )}
            {managementMessage && <p className="hint">{managementMessage}</p>}
            {submitMutation.isError && <p className="error-text">발주 제출에 실패했습니다.</p>}
            {cancelMutation.isError && <p className="error-text">발주 취소에 실패했습니다.</p>}
          </section>
        )}
      </section>
    </div>
  )
}

function formatDate(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR')
}

function ChatbotOverlay({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  if (!enabled) {
    return null
  }
  return (
    <>
      <button
        className={`chat-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'AI 챗봇 닫기' : 'AI 챗봇 열기'}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
      {open && (
        <div className="chat-drawer">
          <div className="drawer-head">
            <strong>AI 챗봇</strong>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="AI 챗봇 닫기">
              <X size={18} />
            </button>
          </div>
          <ChatSession />
        </div>
      )}
    </>
  )
}

function ChatSession() {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatMessages())

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendChatMessage(content, messages),
    onMutate: (content) => {
      const userMessage: ChatMessage = {
        messageId: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }
      setMessages(appendChatMessage(userMessage))
    },
    onSuccess: (message) => {
      setMessages(appendChatMessage(message))
    },
    onError: () => {
      const fallbackMessage: ChatMessage = {
        messageId: crypto.randomUUID(),
        role: 'assistant',
        content: 'AI 채팅 API가 아직 준비되지 않았거나 접근 권한이 없습니다.',
        createdAt: new Date().toISOString(),
      }
      setMessages(appendChatMessage(fallbackMessage))
    },
  })

  function clearSessionChat(): void {
    clearChatMessages()
    setMessages([])
  }

  return (
    <>
      <div className="chat-history">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.messageId}>
            <span>{message.content}</span>
          </div>
        ))}
        {messages.length === 0 && <EmptyState title="재고나 발주에 대해 질문해보세요." />}
      </div>
      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) {
            return
          }
          sendMutation.mutate(draft.trim())
          setDraft('')
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="질문 입력" />
        <button className="icon-button" disabled={sendMutation.isPending} aria-label="메시지 보내기">
          <Send size={18} />
        </button>
        <button className="ghost-button" type="button" onClick={clearSessionChat}>
          삭제
        </button>
      </form>
    </>
  )
}

function SelectField({
  label,
  value,
  error,
  onChange,
  children,
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {error && <small className="error-text">{error}</small>}
    </label>
  )
}

function TextField({
  label,
  value,
  error,
  type = 'text',
  onChange,
}: {
  label: string
  value: string
  error?: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {error && <small className="error-text">{error}</small>}
    </label>
  )
}

function EmptyState({ title }: { title: string }) {
  return <p className="empty-state">{title}</p>
}
