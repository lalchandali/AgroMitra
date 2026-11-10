import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart
} from 'recharts'
import {
  getPricePrediction, getDemandForecast, getCropRecommendation, getCropYield,
  getMyProducts, createProduct, updateProduct, deleteProduct,
  getMyOrders, updateOrderStatus,
  getStoredUser, getCurrentUser, uploadProfilePhoto, updateProfile, resolveImageUrl, updateStoredUser,
  getWeatherAlert, submitFarmerVerification
} from '../api/agromitra'
import Sidebar from '../components/Sidebar'
import SettingsTab from '../components/SettingsTab'
import { useLanguage } from '../hooks/useLanguage'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { tr } from '../translations'
import { displayQuantity, displayUnit, orderItemQuantity, orderItemUnit, UNIT_TO_BASE } from '../utils/quantityUnits'

const CROPS = [
  "Rice", "Wheat", "Corn", "Tomato", "Onion", "Potato", "Brinjal", "Cabbage",
  "Cauliflower", "Cucumber", "Chili", "Pumpkin", "Spinach", "Carrot", "Radish",
  "Lettuce", "Beetroot", "Okra", "Pea", "Garlic", "Ginger", "Turmeric",
  "Fenugreek", "Mustard", "Bitter Gourd", "Bottle Gourd", "Snake Gourd",
  "Ridge Gourd", "Yam", "Sweet Potato"
]
const DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura",
  "Brahmanbaria", "Chandpur", "Chapai Nawabganj", "Chattogram", "Chuadanga",
  "Cumilla", "Cox's Bazar", "Dhaka", "Dinajpur", "Faridpur", "Feni", "Gaibandha",
  "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore", "Jhalokathi",
  "Jhenaidah", "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram",
  "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj",
  "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon", "Narail",
  "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali",
  "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi",
  "Rangamati", "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj",
  "Sunamganj", "Sylhet", "Tangail", "Thakurgaon"
]
const CROP_EMOJIS = {
  Tomato: '🍅', Onion: '🧅', Potato: '🥔', Brinjal: '🍆',
  Cabbage: '🥬', Cauliflower: '🥦', Garlic: '🧄', Rice: '🌾',
  Ginger: '🫚', Corn: '🌽', Chili: '🌶️', Carrot: '🥕',
  Cucumber: '🥒', Pumpkin: '🎃', Spinach: '🥗'
}

// AI Price Prediction model শুধু এই ১৪টা crop-এর জন্য ডেটা রাখে
// (backend/main.py -এর CROP_DB এর সাথে মিলিয়ে রাখা হয়েছে)
const AI_PRICE_CROPS = [
  "Tomato", "Onion", "Potato", "Brinjal", "Cabbage", "Garlic", "Rice",
  "Ginger", "Maize", "Wheat", "Chili", "Watermelon", "Mustard", "Jute"
]

const cropCategory = (cropName) => {
  const crop = cropName.trim().toLowerCase()
  if (['rice', 'wheat', 'corn', 'maize', 'mustard', 'jute'].includes(crop)) return 'Grain'
  if (['watermelon', 'banana', 'mango', 'jackfruit', 'papaya', 'guava'].includes(crop)) return 'Fruit'
  if (['garlic', 'ginger', 'turmeric', 'chili', 'fenugreek'].includes(crop)) return 'Spice'
  if (['potato', 'sweet potato', 'yam', 'carrot', 'radish', 'beetroot'].includes(crop)) return 'Root'
  return 'Vegetable'
}

const trustScoreLabel = (score) =>
  score == null || !Number.isFinite(Number(score)) ? '—/100' : `${Math.round(Number(score))}/100`

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const BLANK_PRODUCT = {
  title_en: '', title_bn: '', category: 'Vegetable',
  description_en: '', quantity: '', sale_unit: 'kg', unit_price_bdt: '',
  low_stock_threshold_kg: 5,
  quality_grade: 'A', district: 'Dhaka',
  is_organic: false, harvest_date: '', availability_until: '',
  image_url: '', image_file: null
}

const STATUS_CONFIG = {
  placed: { cls: 'fd-badge fd-badge--gold', icon: '⏳', label: 'Placed' },
  pending: { cls: 'fd-badge fd-badge--gold', icon: '⏳', label: 'Pending' },
  confirmed: { cls: 'fd-badge fd-badge--blue', icon: '✅', label: 'Confirmed' },
  shipped: { cls: 'fd-badge fd-badge--blue', icon: '🚚', label: 'Shipped' },
  delivered: { cls: 'fd-badge fd-badge--green', icon: '📦', label: 'Delivered' },
  cancelled: { cls: 'fd-badge fd-badge--red', icon: '✕', label: 'Cancelled' },
}

const PAYMENT_ICONS = {
  bkash: '💚', nagad: '🔵', bank_transfer: '🏦',
  cash_on_delivery: '💵', mock_bkash: '💚', mock_nagad: '🔵'
}

const paymentMethodLabel = (method, T) => {
  if (method === 'cash_on_delivery' || method === 'bank_transfer') return T('cashOnDelivery')
  if (method === 'mock_bkash') return T('bkashSandbox')
  if (method === 'mock_nagad') return T('nagadSandbox')
  if (method === 'bkash') return 'bKash'
  if (method === 'nagad') return 'Nagad'
  return method?.replaceAll('_', ' ') || '—'
}

const paymentStatusLabel = (status, method, T) => {
  if (status === 'paid' && ['mock_bkash', 'mock_nagad'].includes(method)) {
    return T('paymentMockPaid')
  }
  const labels = {
    pending: 'paymentPending',
    paid: 'paymentPaid',
    failed: 'paymentFailed',
    in_escrow: 'paymentInEscrow',
    released: 'paymentReleased',
    refunded: 'paymentRefunded',
  }
  return labels[status] ? T(labels[status]) : status || '—'
}

const paymentStatusClass = (status) =>
  ['paid', 'released'].includes(status) ? 'fd-badge--green'
    : ['failed', 'refunded'].includes(status) ? 'fd-badge--red'
      : 'fd-badge--gold'

const deliveryMethodLabel = (method, T) =>
  method === 'pickup' ? T('buyerPickup') : T('farmerDelivery')

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' })
}

const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' })
}
// ── Order Detail Modal ────────────────────────────────────────
function OrderDetailModal({ order: o, onClose, onStatusUpdate, T }) {
  if (!o) return null
  const statusCfg = STATUS_CONFIG[o.status?.toLowerCase()] || STATUS_CONFIG.pending

  return (
    <div className="fd-overlay" onClick={onClose}>
      <div className="fd-modal fd-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="fd-modal-header">
          <div>
            <div className="fd-modal-title">Order Details</div>
            <div className="fd-modal-sub">#{o.order_id?.slice(-12)}</div>
          </div>
          <button className="fd-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="fd-order-detail-grid">
          {/* Status & Timeline */}
          <div className="fd-detail-section">
            <div className="fd-detail-label">Status</div>
            <span className={statusCfg.cls}>{statusCfg.icon} {statusCfg.label}</span>
          </div>

          <div className="fd-detail-section">
            <div className="fd-detail-label">Order Placed</div>
            <div className="fd-detail-val">{fmtDate(o.created_at)}</div>
            <div className="fd-detail-sub">{fmtTime(o.created_at)}</div>
          </div>

          {o.confirmed_at && (
            <div className="fd-detail-section">
              <div className="fd-detail-label">Confirmed At</div>
              <div className="fd-detail-val">{fmtDate(o.confirmed_at)}</div>
            </div>
          )}

          {o.delivered_at && (
            <div className="fd-detail-section">
              <div className="fd-detail-label">Delivered At</div>
              <div className="fd-detail-val">{fmtDate(o.delivered_at)}</div>
            </div>
          )}

          {/* Buyer */}
          <div className="fd-detail-section">
            <div className="fd-detail-label">Buyer Name</div>
            <div className="fd-detail-val">{o.buyer_name || T('unknownBuyer')}</div>
          </div>

          {/* Items — একটা order-এ একই buyer-এর একাধিক product থাকতে পারে */}
          <div className="fd-detail-section fd-detail-section--full">
            <div className="fd-detail-label">Items ({(o.items || []).length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {(o.items || []).map(item => (
                <div key={item.order_item_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--bg-muted, #F8FAFC)', padding: '10px 12px', borderRadius: 8, gap: 8
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 18 }}>
                      {CROP_EMOJIS[item.product_name?.split(' ').find(w => CROP_EMOJIS[w])] || '🌿'}
                    </span>
                    <div>
                      <div className="fd-detail-val" style={{ fontSize: 14 }}>{item.product_name || T('unknownProduct')}</div>
                      <div className="fd-detail-sub">
                        {orderItemQuantity(item)} {T(`unit_${orderItemUnit(item)}`)} × ৳{item.unit_price}/{T(`unit_${orderItemUnit(item)}`)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#2E7D32' }}>৳{item.subtotal?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery */}
          <div className="fd-detail-section">
            <div className="fd-detail-label">{T('deliveryMethod')}</div>
            <div className="fd-detail-val">{deliveryMethodLabel(o.delivery_method || o.delivery_type, T)}</div>
          </div>

          <div className="fd-detail-section fd-detail-section--full">
            <div className="fd-detail-label">{T('deliveryAddress')}</div>
            <div className="fd-detail-val">{o.delivery_address || '—'}</div>
          </div>
          {o.delivery_note && (
            <div className="fd-detail-section fd-detail-section--full">
              <div className="fd-detail-label">{T('deliveryNote')}</div>
              <div className="fd-detail-val">{o.delivery_note}</div>
            </div>
          )}

          {/* Payment */}
          <div className="fd-detail-section">
            <div className="fd-detail-label">{T('paymentMethod')}</div>
            <div className="fd-detail-val">
              {PAYMENT_ICONS[o.payment_method] || '💳'} {paymentMethodLabel(o.payment_method, T)}
            </div>
          </div>

          <div className="fd-detail-section">
            <div className="fd-detail-label">{T('paymentStatus')}</div>
            <span className={`fd-badge ${paymentStatusClass(o.payment_status)}`}>
              {paymentStatusLabel(o.payment_status, o.payment_method, T)}
            </span>
          </div>
        </div>

        {/* Financial breakdown */}
        <div className="fd-finance-box">
          <div className="fd-finance-row">
            <span>{T('itemsSubtotal')}</span>
            <span>৳{o.total_amount?.toLocaleString()}</span>
          </div>
          <div className="fd-finance-row">
            <span>{T('platformFee')}</span>
            <span className="fd-finance-neg">− ৳{o.platform_fee?.toLocaleString()}</span>
          </div>
          <div className="fd-finance-row fd-finance-row--total">
            <span>{T('farmerNetEarning')}</span>
            <span className="fd-finance-earn">৳{o.farmer_amount?.toLocaleString()}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="fd-modal-actions">
          {o.status?.toLowerCase() === 'placed' && (
            <>
              <button className="fd-btn fd-btn--confirm"
                onClick={() => { onStatusUpdate(o.order_id, 'confirmed'); onClose() }}>
                ✅ Confirm Order
              </button>
              <button className="fd-btn fd-btn--cancel"
                onClick={() => { onStatusUpdate(o.order_id, 'cancelled'); onClose() }}>
                ✕ Cancel
              </button>
            </>
          )}
          {o.status?.toLowerCase() === 'confirmed' && (
            <button className="fd-btn fd-btn--ship"
              onClick={() => { onStatusUpdate(o.order_id, 'shipped'); onClose() }}>
              🚚 Mark as Shipped
            </button>
          )}
          {o.status?.toLowerCase() === 'shipped' && (
            <button className="fd-btn fd-btn--deliver"
              onClick={() => { onStatusUpdate(o.order_id, 'delivered'); onClose() }}>
              📦 Mark as Delivered
            </button>
          )}
          <button className="fd-btn fd-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function FarmerDashboard() {
  const { lang } = useLanguage()
  const T = (key) => tr(key, lang)
  const [user, setUser] = useState(getStoredUser())
  const [verificationReference, setVerificationReference] = useState(user?.verification_reference || '')
  const [savingVerification, setSavingVerification] = useState(false)

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser())
    globalThis.addEventListener('agromitra-auth-changed', syncUser)
    return () => globalThis.removeEventListener('agromitra-auth-changed', syncUser)
  }, [])

  useEffect(() => {
    if (!user?.user_id) return undefined
    let active = true
    getCurrentUser()
      .then(({ data }) => {
        if (!active) return
        updateStoredUser(data)
        setUser(data)
        setVerificationReference(data.verification_reference || '')
      })
      .catch(error => console.error('Could not refresh farmer verification status:', error))
    return () => { active = false }
  }, [user?.user_id])

  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_TABS = ['overview', 'price', 'demand', 'recommend', 'listings', 'orders', 'profile', 'settings']
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab')
    if (tab === 'yield') return 'recommend'
    return VALID_TABS.includes(tab) ? tab : 'overview'
  })

  // ── Sidebar-এ user নিজে tab click করলে state আর URL — দুটোই sync
  //    রাখতে হয়, নাহলে refresh দিলে URL-এর পুরোনো ?tab= অনুযায়ী
  //    আবার আগের tab-এই ফিরে যায় ──
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  // ── notification bell থেকে navigate('/farmer?tab=orders') এলে,
  //    আগে থেকেই এই page-এ থাকলে component remount হয় না —
  //    তাই URL-এর tab পাল্টালে activeTab-ও আলাদাভাবে sync করতে হয় ──
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'yield') {
      setActiveTab('recommend')
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', 'recommend')
        return next
      }, { replace: true })
      return
    }
    if (VALID_TABS.includes(tab) && tab !== activeTab) {
      setActiveTab(tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [crop, setCrop] = useState('Tomato')
  const [district, setDistrict] = useState(user?.district || 'Dhaka')
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState(false)
  const [weatherRefresh, setWeatherRefresh] = useState(0)
  const [priceData, setPriceData] = useState(null)
  const [demandData, setDemandData] = useState(null)
  const [recData, setRecData] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [yieldForm, setYieldForm] = useState({
    crop_name: 'Tomato',
    district: 'Bogura',
    soil_type: 'Loam',
    land_acres: 2.5,
    planting_month: new Date().getMonth() + 1,
  })
  const [yieldData, setYieldData] = useState(null)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [recForm, setRecForm] = useState({
    farmer_name: user?.full_name || user?.name_en || '',
    district: user?.district,
    soil_type: 'Loam',
    land_acres: 2.5,
    budget_bdt: 80000,
    experience: 'Intermediate',
    planting_month: new Date().getMonth() + 1
  })
  const [profileForm, setProfileForm] = useState({
    name_en: user?.name_en || '',
    name_bn: user?.name_bn || '',
    district: user?.district || 'Dhaka',
    mobile_number: user?.mobile_number || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileEditMode, setProfileEditMode] = useState(false)

  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState(BLANK_PRODUCT)
  const [savingProduct, setSavingProduct] = useState(false)

  // ── Add/Edit Product modal-এর ভিতরের AI Price Suggestion ──
  const [aiPriceLoading, setAiPriceLoading] = useState(false)
  const [aiPriceSuggestion, setAiPriceSuggestion] = useState(null)
  const [aiPriceError, setAiPriceError] = useState(false)

  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderFilter, setOrderFilter] = useState('all')

  const fetchAI = useCallback(async () => {
    setAiLoading(true)
    try {
      const [priceRes, demandRes] = await Promise.all([
        getPricePrediction(crop, district, 7),
        getDemandForecast(crop, district, 7),
      ])
      setPriceData(priceRes.data)
      setDemandData(demandRes.data)
      toast.success('AI predictions updated!')
    } catch {
      toast.error('AI API Error — Make sure FastAPI is running on port 8000')
    } finally { setAiLoading(false) }
  }, [crop, district])

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await getMyProducts()
      setProducts(res.data || [])
    } catch {
      toast.error('Could not load your products')
    } finally { setProductsLoading(false) }
  }, [])

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await getMyOrders('seller')
      setOrders(res.data || [])
    } catch {
      toast.error('Could not load your orders')
    } finally { setOrdersLoading(false) }
  }, [])

  useEffect(() => { fetchAI() }, [fetchAI])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => {
    let cancelled = false
    setWeatherLoading(true)
    setWeatherError(false)
    getWeatherAlert(district)
      .then(({ data }) => {
        if (!cancelled) setWeather(data)
      })
      .catch(() => {
        if (!cancelled) {
          setWeather(null)
          setWeatherError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false)
      })
    return () => { cancelled = true }
  }, [district, weatherRefresh])

  const activeListings = products.filter(p => p.is_available !== false).length
  const pendingOrders = orders.filter(o => ['placed', 'pending'].includes(o.status?.toLowerCase())).length
  const totalEarnings = orders
    .filter(o => o.status?.toLowerCase() === 'delivered')
    .reduce((sum, o) => sum + (o.farmer_amount || o.total_amount || 0), 0)

  const priceChartData = priceData?.forecasts?.map(f => ({
    date: f.date.slice(5),
    price: f.predicted_price,
    low: f.lower_bound,
    high: f.upper_bound,
  })) || []
  const priceForecasts = priceData?.forecasts || []
  const priceChangePct = Number(priceData?.summary?.trend_pct || 0)
  const priceForecastAverage = Number(
    priceData?.summary?.avg_7day_price ??
    (priceForecasts.length
      ? priceForecasts.reduce((sum, forecast) => sum + Number(forecast.predicted_price || 0), 0) / priceForecasts.length
      : 0)
  )
  const priceRange = priceForecasts.length
    ? {
        low: Math.min(...priceForecasts.map(forecast => Number(forecast.lower_bound ?? forecast.predicted_price))),
        high: Math.max(...priceForecasts.map(forecast => Number(forecast.upper_bound ?? forecast.predicted_price))),
      }
    : null

  const demandChartData = demandData?.forecasts?.map(f => ({
    date: f.date.slice(5),
    demand: f.predicted_demand,
    lower: f.lower_bound,
    upper: f.upper_bound,
    signal: f.market_signal,
  })) || []
  const demandChangePct = Number(demandData?.summary?.demand_change_pct || 0)
  const highDemandDays = demandData?.forecasts?.filter(f =>
    f.market_signal?.toLowerCase().includes('high')
  ).length || 0

  // productForm.title_en থেকে সবচেয়ে কাছাকাছি AI-supported crop অনুমান করে
  // (যেমন "Fresh Tomato" টাইটেল দিলে "Tomato" ধরে নেবে) — না মিললে প্রথমটা।
  const guessAiCrop = (title) => {
    if (!title) return null
    const lower = title.toLowerCase()
    return AI_PRICE_CROPS.find(c => lower.includes(c.toLowerCase())) || null
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setProductForm({ ...BLANK_PRODUCT, district: user?.district || 'Dhaka' })
    setAiPriceSuggestion(null)
    setShowModal(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setProductForm({
      title_en: product.title_en || '',
      title_bn: product.title_bn || '',
      category: product.category || 'Vegetable',
      description_en: product.description_en || '',
      quantity: displayQuantity(product),
      sale_unit: product.sale_unit || 'kg',
      low_stock_threshold_kg: product.low_stock_threshold_kg ?? 5,
      unit_price_bdt: product.unit_price_bdt,
      quality_grade: product.quality_grade || 'A',
      district: product.district,
      is_organic: product.is_organic || false,
      harvest_date: product.harvest_date || '',
      availability_until: product.availability_until || '',
      image_url: product.image_url || '',
    })
    setAiPriceSuggestion(null)
    setShowModal(true)
  }

  useEffect(() => {
    const cropName = guessAiCrop(productForm.title_en)
    if (!showModal || !cropName) {
      setAiPriceSuggestion(null)
      setAiPriceError(false)
      setAiPriceLoading(false)
      return undefined
    }

    let active = true
    setAiPriceSuggestion(null)
    setAiPriceError(false)
    const timeout = setTimeout(async () => {
      setAiPriceLoading(true)
      try {
        const { data } = await getPricePrediction(cropName, productForm.district, 7)
        if (active) setAiPriceSuggestion(data)
      } catch {
        if (active) {
          setAiPriceSuggestion(null)
          setAiPriceError(true)
        }
      } finally {
        if (active) setAiPriceLoading(false)
      }
    }, 500)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [showModal, productForm.title_en, productForm.district])

  const handleSaveProduct = async () => {
    if (!productForm.title_en || !productForm.quantity || !productForm.unit_price_bdt) {
      toast.error(T('productFieldsRequired'))
      return
    }
    if (['dozen', 'piece'].includes(productForm.sale_unit) && !Number.isInteger(Number(productForm.quantity))) {
      toast.error(T('countQuantityWhole'))
      return
    }
    if (!Number(productForm.low_stock_threshold_kg) || Number(productForm.low_stock_threshold_kg) <= 0) {
      toast.error(T('lowStockThresholdRequired'))
      return
    }
    setSavingProduct(true)
    try {
      // ── ৪২২ এরর ফিক্স: Multipart FormData তৈরি করা হচ্ছে ──
      const formData = new FormData()

      // ১. সাধারণ টেক্সট এবং নাম্বার ডেটা অ্যাপেন্ড করা হচ্ছে
      formData.append('title_en', productForm.title_en)
      formData.append('title_bn', productForm.title_bn || '')
      formData.append('category', productForm.category)
      formData.append('description_en', productForm.description_en || '')
      formData.append('quantity', Number(productForm.quantity))
      formData.append('sale_unit', productForm.sale_unit)
      formData.append('low_stock_threshold_kg', Number(productForm.low_stock_threshold_kg))
      formData.append('unit_price_bdt', Number(productForm.unit_price_bdt))
      formData.append('quality_grade', productForm.quality_grade)
      formData.append('district', productForm.district)
      formData.append('is_organic', productForm.is_organic ? 'true' : 'false') // FormData-তে বুলিয়ান স্ট্রিং করে পাঠাতে হয়

      const harvestDate = productForm.harvest_date || new Date().toISOString()
      const availabilityUntil = productForm.availability_until || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      formData.append('harvest_date', harvestDate)
      formData.append('availability_until', availabilityUntil)

      if (productForm.image_file) {
        formData.append('file', productForm.image_file)
      } else if (productForm.image_url) {
        formData.append('image_url', productForm.image_url)
      }

      if (editingProduct) {
        await updateProduct(editingProduct.product_id, formData)
      } else {
        await createProduct(formData)
      }
      toast.success(T('listingSaved'))
      setShowModal(false)
      fetchProducts()
    } catch (e) {
      console.error("Full Submit Error:", e);

      let errorMsg = 'Failed to save product';

      if (e?.response?.data?.detail) {
        const detail = e.response.data.detail;

        if (typeof detail === 'string') {
          errorMsg = detail.includes('Count-unit quantities must be whole numbers.')
            ? T('countQuantityWhole')
            : detail;
        } else if (Array.isArray(detail) && detail[0]?.msg) {
          errorMsg = `${detail[0].loc?.join('.') || 'Error'}: ${detail[0].msg}`;
        } else if (typeof detail === 'object') {
          errorMsg = JSON.stringify(detail);
        }
      }

      toast.error(errorMsg);
    } finally {
      setSavingProduct(false);
    }

  }

  const handleDeleteProduct = async (id) => {
    if (!globalThis.confirm('Delete this listing?')) return
    try {
      await deleteProduct(id)
      toast.success('Listing deleted')
      fetchProducts()
    } catch {
      toast.error('Could not delete listing')
    }
  }

  const handleOrderStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Order marked as ${newStatus}`)
      fetchOrders()
      if (newStatus === 'delivered') {
        getCurrentUser()
          .then(({ data: updatedUser }) => {
            updateStoredUser(updatedUser)
            setUser(updatedUser)
          })
          .catch(error => {
            console.error('Could not refresh trust score after delivery:', error)
            toast.error('Order delivered, but could not refresh trust score.')
          })
      }
    } catch {
      toast.error('Could not update order status')
    }
  }

  const fetchCropYield = async (cropName = yieldForm.crop_name) => {
    setYieldLoading(true)
    const yieldRequest = {
      ...yieldForm,
      crop_name: cropName,
      district: recForm.district,
      soil_type: recForm.soil_type,
      land_acres: recForm.land_acres,
      planting_month: recForm.planting_month,
    }
    try {
      const res = await getCropYield(yieldRequest)
      setYieldForm(current => ({ ...current, crop_name: cropName }))
      setYieldData(res.data)
      return true
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to get yield estimate')
      return false
    } finally {
      setYieldLoading(false)
    }
  }

  const fetchFarmPlan = async () => {
    setAiLoading(true)
    setYieldLoading(true)
    const yieldRequest = {
      ...yieldForm,
      district: recForm.district,
      soil_type: recForm.soil_type,
      land_acres: recForm.land_acres,
      planting_month: recForm.planting_month,
    }

    try {
      const [recommendationResult, yieldResult] = await Promise.allSettled([
        getCropRecommendation(recForm),
        getCropYield(yieldRequest),
      ])
      if (recommendationResult.status === 'fulfilled') {
        setRecData(recommendationResult.value.data)
      } else {
        toast.error('Failed to get crop recommendations')
      }
      if (yieldResult.status === 'fulfilled') {
        setYieldData(yieldResult.value.data)
      } else {
        toast.error(yieldResult.reason?.response?.data?.detail || 'Failed to get yield estimate')
      }
      if (recommendationResult.status === 'fulfilled' && yieldResult.status === 'fulfilled') {
        toast.success('Crop recommendations and yield estimate are ready!')
      }
    } finally {
      setAiLoading(false)
      setYieldLoading(false)
    }
  }

  // ── Filter orders ────────────────────────────────────────────
  const filteredOrders = orderFilter === 'all'
    ? orders
    : orders.filter(o => o.status?.toLowerCase() === orderFilter)

  const orderCounts = {
    all: orders.length,
    placed: orders.filter(o => ['placed', 'pending'].includes(o.status?.toLowerCase())).length,
    confirmed: orders.filter(o => o.status?.toLowerCase() === 'confirmed').length,
    shipped: orders.filter(o => o.status?.toLowerCase() === 'shipped').length,
    delivered: orders.filter(o => o.status?.toLowerCase() === 'delivered').length,
    cancelled: orders.filter(o => o.status?.toLowerCase() === 'cancelled').length,
  }

  // ════════════════════════════════════════════════════════════
  return (
    <div className="page" style={{ padding: 0 }}>

      {/* ── Sidebar + Content Layout (full height) ── */}
      <div className="dashboard-layout">
        <Sidebar
          title="Farmer Menu"
          subtitle="AgroMitra"
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            { key: 'overview', icon: '📊', label: T('overview') },
            { key: 'price', icon: '🤖', label: T('priceAI') },
            { key: 'demand', icon: '📈', label: T('demandAI') },
            { key: 'recommend', icon: '🌱', label: lang === 'bn' ? 'ফসল ও ফলন AI' : 'Crop & Yield AI' },
            { key: 'listings', icon: '📦', label: T('myListings') },
            { key: 'orders', icon: '🛒', label: T('orders'), badge: pendingOrders > 0 ? pendingOrders : null },
            { key: 'profile', icon: '👤', label: T('profile') },
            { key: 'settings', icon: '⚙️', label: T('settings') },
          ]}
        />
        <div className="dashboard-content">

          {/* ── Header ── */}
          <div className="page-header flex justify-between">
            <div>
              <div className="page-title">{T('farmerDashTitle')}</div>
              <div className="page-subtitle">{T('farmerDashSub')}</div>
            </div>
            <div className="flex gap-8">
              <select className="form-select" style={{ width: 140 }} value={crop}
                onChange={e => setCrop(e.target.value)}>
                {CROPS.map(c => <option key={c}>{c}</option>)}
              </select>
              <select className="form-select" style={{ width: 140 }} value={district}
                onChange={e => setDistrict(e.target.value)}>
                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <button className="btn btn-primary" onClick={fetchAI} disabled={aiLoading}>
                {aiLoading ? '⏳' : '🔄'} Refresh AI
              </button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="stats-grid">
            {[
              { icon: '📦', label: T('activeListings'), val: productsLoading ? '…' : activeListings, change: T('activeListings'), color: '#E8F5E9', border: '#2E7D32' },
              { icon: '🛒', label: T('pendingOrders'), val: ordersLoading ? '…' : pendingOrders, change: `${orders.length} ${T('totalOrders')}`, color: '#E3F2FD', border: '#1976D2' },
              { icon: '💰', label: T('totalEarningsStat'), val: ordersLoading ? '…' : `৳${totalEarnings.toLocaleString()}`, change: T('fromDelivered'), color: '#FFF3E0', border: '#E65100' },
              {
                icon: '⭐',
                label: T('trustScore'),
                val: trustScoreLabel(user?.trust_score),
                change: user?.verification_status === 'approved'
                  ? T('verified')
                  : user?.verification_status === 'rejected'
                    ? T('verificationRejected')
                    : T('verificationPending'),
                color: '#F3E5F5',
                border: '#6A1B9A',
              },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ borderLeftColor: s.border }}>
                <div className="stat-icon" style={{ background: s.color }}>{s.icon}</div>
                <div className="stat-info">
                  <div className="stat-value">{s.val}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-change up">{s.change}</div>
                </div>
              </div>
            ))}
          </div>
          {/* ════ Overview Tab ════ */}
          {activeTab === 'overview' && (
            <div>

              {/* ── Local Weather ── */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div className="card-title" style={{ marginBottom: 0 }}>
                    🌦️ {lang === 'bn' ? 'স্থানীয় আবহাওয়া' : 'Local Weather'} · {district}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => setWeatherRefresh((value) => value + 1)}
                    disabled={weatherLoading}
                  >
                    {weatherLoading ? '⏳' : '🔄'} {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
                  </button>
                </div>

                {weatherLoading ? (
                  <div className="spinner-box">
                    <div className="spinner" />
                    <span>{lang === 'bn' ? 'আবহাওয়ার তথ্য লোড হচ্ছে…' : 'Loading weather…'}</span>
                  </div>
                ) : weatherError ? (
                  <div className="alert alert-warning" role="alert">
                    {lang === 'bn'
                      ? 'এই জেলার আবহাওয়ার তথ্য পাওয়া যায়নি। আবহাওয়া পরিষেবা কনফিগার করা আছে কিনা পরীক্ষা করে আবার চেষ্টা করুন।'
                      : 'Weather information is unavailable. Check that the weather service is configured, then try again.'}
                  </div>
                ) : weather && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                      {[
                        { icon: '🌡️', label: lang === 'bn' ? 'তাপমাত্রা' : 'Temperature', value: `${weather.temperature_c ?? '—'}°C` },
                        { icon: '🌤️', label: lang === 'bn' ? 'অবস্থা' : 'Conditions', value: weather.condition || '—' },
                        { icon: '💧', label: lang === 'bn' ? 'আর্দ্রতা' : 'Humidity', value: `${weather.humidity_pct ?? '—'}%` },
                        { icon: '💨', label: lang === 'bn' ? 'বাতাস' : 'Wind', value: `${weather.wind_speed_ms ?? '—'} m/s` },
                      ].map((item) => (
                        <div key={item.label} style={{ padding: 14, borderRadius: 8, background: 'var(--bg-muted, #F8FAFC)' }}>
                          <div style={{ color: 'var(--gray)', fontSize: 13 }}>{item.icon} {item.label}</div>
                          <div style={{ marginTop: 4, fontWeight: 700, textTransform: 'capitalize' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div
                      className={`alert ${weather.has_alert ? 'alert-warning' : 'alert-success'}`}
                      role={weather.has_alert ? 'alert' : 'status'}
                      style={{ marginTop: 14, marginBottom: 0 }}
                    >
                      <strong>
                        {weather.has_alert
                          ? `⚠️ ${weather.alert_title || (lang === 'bn' ? 'আবহাওয়া সতর্কতা' : 'Weather advisory')}`
                          : `✅ ${lang === 'bn' ? 'কোনো সক্রিয় আবহাওয়া সতর্কতা নেই' : 'No active weather alerts'}`}
                      </strong>
                      {weather.has_alert && weather.alert_message && <span> {weather.alert_message}</span>}
                      <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                        {weather.alert_source}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* ── Profile + Quick Actions ── */}
              <div className="grid-1" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="card-title">⚡ Quick Actions</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {[
                      { icon: '➕', label: T('addListing'), action: () => { openAddModal() }, color: '#E8F5E9', border: '#2E7D32', text: '#2E7D32' },
                      { icon: '🛒', label: `${pendingOrders} ${T('pendingOrders')}`, action: () => handleTabChange('orders'), color: pendingOrders > 0 ? '#FFF3E0' : '#F5F5F5', border: pendingOrders > 0 ? '#E65100' : '#E0E0E0', text: pendingOrders > 0 ? '#E65100' : '#9E9E9E' },
                      { icon: '📦', label: T('myListings'), action: () => handleTabChange('listings'), color: '#E3F2FD', border: '#1976D2', text: '#1976D2' },
                      { icon: '🤖', label: T('cropAI'), action: () => handleTabChange('recommend'), color: '#F3E5F5', border: '#6A1B9A', text: '#6A1B9A' },
                    ].map((a, i) => (
                      <button key={i} onClick={a.action} style={{
                        background: a.color, border: `2px solid ${a.border}`,
                        borderRadius: 8, padding: '12px 8px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        transition: 'all 0.2s', fontWeight: 600, color: a.text, fontSize: 13
                      }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <span style={{ fontSize: 22 }}>{a.icon}</span>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Low Stock Alert ── */}
              {products.filter(p => p.stock_status === 'low_stock' && p.is_available !== false).length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: 20 }}>
                  ⚠️ <strong>Low Stock Alert:</strong>{' '}
                  {products
                    .filter(p => p.stock_status === 'low_stock' && p.is_available !== false)
                    .map(p => `${p.title_en} (${displayQuantity(p)} ${T(`unit_${displayUnit(p)}`)})`)
                    .join(', ')
                  } — consider restocking soon.
                </div>
              )}

              {/* ── Pending Orders Alert ── */}
              {pendingOrders > 0 && (
                <div className="alert alert-info" style={{ marginBottom: 20, cursor: 'pointer' }}
                  onClick={() => handleTabChange('orders')}>
                  🛒 {lang === 'bn' ? `আপনার` : 'You have'} <strong>{pendingOrders}</strong> {T('newOrderAlert')}{'  '}
                  <span style={{ color: 'var(--blue)', fontWeight: 700, cursor: 'pointer' }} onClick={() => handleTabChange('orders')}>{T('viewOrders')}</span>
                </div>
              )}

              {/* ── AI Market Intelligence ── */}
              <div className="ai-section" style={{ marginBottom: 20 }}>
                <div className="ai-section-title">🤖 AI Market Intelligence</div>
                <div className="ai-section-sub">
                  {CROP_EMOJIS[crop] || '🌿'} {crop} in {district} — Prophet + XGBoost + LSTM
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                  {priceData && [
                    { label: T('currentPrice'), val: `৳${priceData.current_price}/kg`, icon: '💰' },
                    { label: '7-Day Avg', val: `৳${priceData.summary?.avg_7day_price}/kg`, icon: '📊' },
                    { label: T('marketOutlook'), val: priceData.summary?.market_outlook || '—', icon: '📈' },
                    { label: 'Trend', val: `${(priceData.summary?.trend_pct || 0) > 0 ? '↑' : '↓'} ${Math.abs(priceData.summary?.trend_pct || 0).toFixed(1)}%`, icon: '📉' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>{item.icon} {item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Charts + Recent Activity ── */}
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="card-title">💰 Price Forecast (7 Days)</div>
                  {aiLoading
                    ? <div className="spinner-box"><div className="spinner" /><span>Loading…</span></div>
                    : <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={priceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={v => [`৳${v}`, 'Price']} />
                        <Line type="monotone" dataKey="price" stroke="#2E7D32" strokeWidth={2.5} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="high" stroke="#A5D6A7" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                        <Line type="monotone" dataKey="low" stroke="#FFCC80" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  }
                </div>

                {/* Recent Activity Feed */}
                <div className="card">
                  <div className="card-title">🕐 Recent Activity</div>
                  {ordersLoading ? (
                    <div className="spinner-box"><div className="spinner" /></div>
                  ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray)', fontSize: 14 }}>
                      No activity yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {orders.slice(0, 5).map((o, i) => {
                        const cfg = STATUS_CONFIG[o.status?.toLowerCase()] || STATUS_CONFIG.pending
                        const items = o.items || []
                        const firstItem = items[0]
                        const label = items.length > 1
                          ? `${firstItem?.product_name || 'Product'} + ${items.length - 1} more`
                          : `${firstItem?.product_name || 'Product'} × ${orderItemQuantity(firstItem)} ${T(`unit_${orderItemUnit(firstItem)}`)}`
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 8,
                            background: '#F8FAFC', cursor: 'pointer',
                            border: '1px solid #EEF0F2'
                          }}
                            onClick={() => { setSelectedOrder(o) }}
                          >
                            <span style={{ fontSize: 20 }}>
                              {CROP_EMOJIS[firstItem?.product_name?.split(' ').find(w => CROP_EMOJIS[w])] || '🌿'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {label}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                                {o.buyer_name || 'Buyer'} · {fmtDate(o.created_at)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                              <span className={cfg.cls} style={{ fontSize: 11 }}>{cfg.icon} {cfg.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)' }}>
                                ৳{(o.farmer_amount || o.total_amount)?.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {orders.length > 5 && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleTabChange('orders')}
                          style={{ alignSelf: 'center', marginTop: 4 }}>
                          View all {orders.length} orders →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Earnings Chart ── */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">💹 Earnings Overview</div>
                {(() => {
                  // orders-এর প্রতিটা item থেকে per-product earnings বানাও
                  // (একটা order-এ একাধিক product থাকতে পারে, তাই order নয়, item ধরে group করা হচ্ছে)
                  const earningsByProduct = {}
                  orders
                    .filter(o => o.status?.toLowerCase() === 'delivered')
                    .forEach(o => {
                      (o.items || []).forEach(item => {
                        const name = item.product_name || 'Unknown'
                        earningsByProduct[name] = (earningsByProduct[name] || 0) + (item.subtotal || 0)
                      })
                    })
                  const chartData = Object.entries(earningsByProduct)
                    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)

                  if (chartData.length === 0) return (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray)', fontSize: 14 }}>
                      Earnings chart will appear after first delivered order.
                    </div>
                  )
                  return (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={v => [`৳${v.toLocaleString()}`, 'Earnings']} />
                        <Bar dataKey="amount" fill="#2E7D32" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>

              {/* ── Demand chart + Advisory ── */}
              <div className="grid-2">
                <div className="card">
                  <div className="card-title">📊 Demand Forecast (7 Days)</div>
                  {demandData && (
                    <div style={{
                      fontSize: 11, marginBottom: 8, display: 'inline-block',
                      padding: '3px 8px', borderRadius: 12,
                      background: demandData.model_used === 'lstm_demand_v2'
                        ? 'var(--green-pale, #E8F5E9)' : '#FFF3E0',
                      color: demandData.model_used === 'lstm_demand_v2'
                        ? 'var(--green-dark, #1B5E20)' : '#E65100',
                    }}>
                      {demandData.model_used === 'lstm_demand_v2'
                        ? '🤖 Trained LSTM model'
                        : '📊 Statistical estimate — no trained model yet for this crop/district'}
                    </div>
                  )}
                  {aiLoading
                    ? <div className="spinner-box"><div className="spinner" /><span>Loading…</span></div>
                    : <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={demandChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={v => [`${v} kg`, 'Demand']} />
                        <Bar dataKey="demand" fill="#0a987e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  }
                </div>

                {/* Order Summary Card */}
                <div className="card">
                  <div className="card-title">📈 Order Summary</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: T('totalOrdersLabel'), val: orders.length, color: '#546E7A', bg: '#F5F5F5' },
                      { label: 'New (Placed)', val: orderCounts.placed, color: '#E65100', bg: '#FFF3E0' },
                      { label: 'Confirmed', val: orderCounts.confirmed, color: '#1976D2', bg: '#E3F2FD' },
                      { label: 'Shipped', val: orderCounts.shipped, color: '#1976D2', bg: '#E3F2FD' },
                      { label: 'Delivered', val: orderCounts.delivered, color: '#2E7D32', bg: '#E8F5E9' },
                      { label: T('totalEarningsStat'), val: `৳${totalEarnings.toLocaleString()}`, color: '#2E7D32', bg: '#E8F5E9' },
                    ].map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '8px 12px',
                        background: s.bg, borderRadius: 8
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--gray)' }}>{s.label}</span>
                        <strong style={{ color: s.color }}>{s.val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {demandData && (
                <div className="alert alert-success mt-16">
                  💡 <strong>AgroMitra Advisory:</strong> {demandData.summary?.farmer_advisory}
                </div>
              )}
            </div>
          )}

          {/* ════ Price AI Tab ════ */}
          {activeTab === 'price' && (
            <div className="price-ai">
              <section className="price-ai-hero">
                <div className="price-ai-hero-content">
                  <span className="price-ai-eyebrow">AGROMITRA PRICE INTELLIGENCE</span>
                  <h2>Price outlook</h2>
                  <p>Understand the expected market movement and plan when to sell your crop.</p>
                  <div className="price-ai-context">
                    <span>{CROP_EMOJIS[crop] || '🌿'} {crop}</span>
                    <span>📍 {district}</span>
                    <span>🗓️ {priceForecasts.length || 7}-day forecast</span>
                  </div>
                </div>
                <span className={`price-ai-model${priceData?.model_used === 'prophet_xgboost_hybrid_v1' ? ' is-trained' : ''}`}>
                  <span className="price-ai-model-dot" />
                  {priceData?.model_used === 'prophet_xgboost_hybrid_v1' ? 'Trained AI model' : 'Statistical estimate'}
                </span>
                <div className="price-ai-hero-art" aria-hidden="true">৳</div>
              </section>

              {aiLoading ? (
                <div className="card price-ai-state">
                  <div className="spinner-box"><div className="spinner" /><span>Generating your price outlook…</span></div>
                </div>
              ) : !priceForecasts.length ? (
                <div className="card price-ai-state">
                  <span aria-hidden="true">📈</span>
                  <strong>No price forecast yet</strong>
                  <p>Refresh AI predictions to load the latest outlook for this crop and district.</p>
                  <button className="btn btn-primary" onClick={fetchAI}>🔄 Refresh forecast</button>
                </div>
              ) : (
                <>
                  <div className="price-ai-stats">
                    <article className="price-ai-stat featured">
                      <span className="price-ai-stat-icon">💰</span>
                      <span className="price-ai-stat-label">Current market price</span>
                      <strong>৳{Number(priceData?.current_price || 0).toLocaleString()} <small>/kg</small></strong>
                      <span className="price-ai-stat-note">Latest available estimate</span>
                    </article>
                    <article className="price-ai-stat">
                      <span className="price-ai-stat-icon">🔭</span>
                      <span className="price-ai-stat-label">Forecast average</span>
                      <strong>৳{priceForecastAverage.toLocaleString(undefined, { maximumFractionDigits: 2 })} <small>/kg</small></strong>
                      <span className="price-ai-stat-note">Expected daily average</span>
                    </article>
                    <article className="price-ai-stat">
                      <span className="price-ai-stat-icon">{priceChangePct > 0 ? '↗️' : priceChangePct < 0 ? '↘️' : '↔️'}</span>
                      <span className="price-ai-stat-label">Expected movement</span>
                      <strong className={priceChangePct > 0 ? 'price-positive' : priceChangePct < 0 ? 'price-negative' : ''}>
                        {priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(1)}<small>%</small>
                      </strong>
                      <span className="price-ai-stat-note">Across the forecast period</span>
                    </article>
                    <article className="price-ai-stat">
                      <span className="price-ai-stat-icon">↕️</span>
                      <span className="price-ai-stat-label">Estimated price range</span>
                      <strong>
                        {priceRange
                          ? `৳${priceRange.low.toLocaleString()}–${priceRange.high.toLocaleString()}`
                          : '—'}
                      </strong>
                      <span className="price-ai-stat-note">Lower to upper estimate / kg</span>
                    </article>
                  </div>

                  <div className="price-ai-main">
                    <section className="card price-ai-chart-card">
                      <div className="price-ai-card-heading">
                        <div>
                          <span className="price-ai-kicker">PRICE TREND</span>
                          <h3>7-day market outlook</h3>
                          <p>Forecast price with lower and upper estimates</p>
                        </div>
                        <span className="price-ai-unit">Bangladeshi Taka · per kg</span>
                      </div>
                      <div className="price-ai-chart">
                        <ResponsiveContainer width="100%" height={310}>
                          <LineChart data={priceChartData} margin={{ top: 14, right: 12, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#718096' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#718096' }} width={52} />
                            <Tooltip
                              formatter={(value, name) => [`৳${Number(value).toLocaleString()}/kg`, name === 'price' ? 'Forecast price' : name === 'high' ? 'Upper estimate' : 'Lower estimate']}
                              contentStyle={{ borderRadius: 12, border: '1px solid #E5EAF0', boxShadow: '0 8px 24px rgba(15, 23, 42, .1)' }}
                            />
                            <Line type="monotone" dataKey="high" name="high" stroke="#E7AC61" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="low" name="low" stroke="#83B2D3" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="price" name="price" stroke="#168B75" strokeWidth={3} dot={{ r: 4, fill: '#168B75', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="price-ai-legend">
                        <span><i className="price-legend-main" /> Forecast price</span>
                        <span><i className="price-legend-high" /> Upper estimate</span>
                        <span><i className="price-legend-low" /> Lower estimate</span>
                      </div>
                    </section>

                    <aside className="price-ai-outlook">
                      <span className="price-ai-outlook-icon">{priceChangePct > 3 ? '🌤️' : priceChangePct < -3 ? '🛡️' : '🌱'}</span>
                      <span className="price-ai-kicker">MARKET SUMMARY</span>
                      <h3>{priceChangePct > 3 ? 'Prices may rise' : priceChangePct < -3 ? 'Prices may soften' : 'Prices look steady'}</h3>
                      <p>{priceData.summary?.market_outlook || 'Review the daily estimates and compare them with local market prices before deciding when to sell.'}</p>
                      <div className={`price-ai-outlook-change${priceChangePct > 0 ? ' is-positive' : priceChangePct < 0 ? ' is-negative' : ''}`}>
                        <span>Forecast movement</span>
                        <strong>{priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(1)}%</strong>
                      </div>
                    </aside>
                  </div>

                  <section className="price-ai-daily">
                    <div className="price-ai-card-heading">
                      <div>
                        <span className="price-ai-kicker">DAY-BY-DAY</span>
                        <h3>Daily price estimates</h3>
                      </div>
                      <span className="price-ai-unit">{priceForecasts.length} forecast days</span>
                    </div>
                    <div className="price-ai-days">
                      {priceForecasts.map((forecast, index) => {
                        const trend = forecast.trend || ''
                        const isRising = trend.includes('↑')
                        const isFalling = trend.includes('↓')
                        const dateLabel = new Date(`${forecast.date}T00:00:00`).toLocaleDateString('en-BD', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })
                        return (
                          <article className="price-ai-day" key={`${forecast.date}-${index}`}>
                            <time dateTime={forecast.date}>{dateLabel}</time>
                            <strong>৳{Number(forecast.predicted_price).toLocaleString()}<small>/kg</small></strong>
                            <span className="price-ai-day-range">৳{forecast.lower_bound} – ৳{forecast.upper_bound}</span>
                            <span className={`price-ai-day-trend${isRising ? ' is-positive' : isFalling ? ' is-negative' : ''}`}>
                              {trend || '↔ Steady'}
                            </span>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* ════ Demand AI Tab ════ */}
          {activeTab === 'demand' && (
            <div className="demand-ai">
              <section className="demand-ai-hero">
                <div className="demand-ai-hero-content">
                  <span className="demand-ai-eyebrow">AGROMITRA INTELLIGENCE</span>
                  <h2>Demand outlook</h2>
                  <p>Plan your harvest with a district-specific view of expected crop demand.</p>
                  <div className="demand-ai-context">
                    <span>🌱 {CROP_EMOJIS[crop] || '🌿'} {crop}</span>
                    <span>📍 {district}</span>
                    <span>🗓️ {demandData?.forecast_days || 7}-day outlook</span>
                  </div>
                </div>
                <span className={`demand-ai-model${demandData?.model_used === 'lstm_demand_v2' ? ' is-trained' : ''}`}>
                  <span className="demand-ai-model-dot" />
                  {demandData?.model_used === 'lstm_demand_v2' ? 'Trained LSTM model' : 'Statistical forecast'}
                </span>
                <div className="demand-ai-hero-art" aria-hidden="true">📈</div>
              </section>

              {aiLoading ? (
                <div className="card demand-ai-loading">
                  <div className="spinner-box"><div className="spinner" /><span>Generating your demand outlook…</span></div>
                </div>
              ) : !demandData?.forecasts?.length ? (
                <div className="card demand-ai-empty">
                  <span>📊</span>
                  <strong>No demand forecast yet</strong>
                  <p>Refresh AI predictions to load the latest outlook for this crop and district.</p>
                  <button className="btn btn-primary" onClick={fetchAI}>🔄 Refresh forecast</button>
                </div>
              ) : (
                <>
                  <div className="demand-ai-stats">
                    <article className="demand-ai-stat">
                      <span className="demand-ai-stat-icon">🧾</span>
                      <span className="demand-ai-stat-label">Historical average</span>
                      <strong>{Number(demandData.summary?.historical_avg_demand || 0).toLocaleString()} <small>kg</small></strong>
                      <span className="demand-ai-stat-note">Recent market baseline</span>
                    </article>
                    <article className="demand-ai-stat featured">
                      <span className="demand-ai-stat-icon">🔭</span>
                      <span className="demand-ai-stat-label">Forecast average</span>
                      <strong>{Number(demandData.summary?.forecast_avg_demand || 0).toLocaleString()} <small>kg</small></strong>
                      <span className="demand-ai-stat-note">Expected per day</span>
                    </article>
                    <article className="demand-ai-stat">
                      <span className="demand-ai-stat-icon">{demandChangePct > 0 ? '↗️' : demandChangePct < 0 ? '↘️' : '↔️'}</span>
                      <span className="demand-ai-stat-label">Demand movement</span>
                      <strong className={demandChangePct > 0 ? 'demand-positive' : demandChangePct < 0 ? 'demand-negative' : ''}>
                        {demandChangePct > 0 ? '+' : ''}{demandChangePct.toFixed(1)}<small>%</small>
                      </strong>
                      <span className="demand-ai-stat-note">Compared with baseline</span>
                    </article>
                    <article className="demand-ai-stat">
                      <span className="demand-ai-stat-icon">🔥</span>
                      <span className="demand-ai-stat-label">High-demand days</span>
                      <strong>{highDemandDays} <small>of {demandChartData.length} days</small></strong>
                      <span className="demand-ai-stat-note">In this forecast window</span>
                    </article>
                  </div>

                  <div className="demand-ai-main-grid">
                    <section className="card demand-ai-chart-card">
                      <div className="demand-ai-card-heading">
                        <div>
                          <span className="demand-ai-section-kicker">DAY-BY-DAY</span>
                          <h3>Expected market demand</h3>
                          <p>Forecast estimate with upper and lower bounds</p>
                        </div>
                        <span className="demand-ai-unit">Kilograms (kg)</span>
                      </div>
                      <div className="demand-ai-chart">
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={demandChartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF2" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#718096' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#718096' }} width={58} />
                            <Tooltip
                              cursor={{ fill: 'rgba(25, 118, 210, 0.06)' }}
                              formatter={(value, name) => [`${Number(value).toLocaleString()} kg`, name === 'demand' ? 'Expected demand' : name === 'lower' ? 'Lower estimate' : 'Upper estimate']}
                              contentStyle={{ borderRadius: 12, border: '1px solid #E5EAF0', boxShadow: '0 8px 24px rgba(15, 23, 42, .1)' }}
                            />
                            <Bar dataKey="demand" name="demand" fill="#168B75" radius={[6, 6, 0, 0]} maxBarSize={38} />
                            <Line dataKey="upper" name="upper" stroke="#F0A44B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line dataKey="lower" name="lower" stroke="#79A9D1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="demand-ai-legend">
                        <span><i className="legend-demand" /> Expected demand</span>
                        <span><i className="legend-upper" /> Upper estimate</span>
                        <span><i className="legend-lower" /> Lower estimate</span>
                      </div>
                    </section>

                    <aside className={`demand-ai-advisory${demandChangePct < -10 ? ' is-caution' : ''}`}>
                      <span className="demand-ai-advisory-icon">{demandChangePct > 10 ? '🚀' : demandChangePct < -10 ? '⚠️' : '🌿'}</span>
                      <span className="demand-ai-section-kicker">FARMER ADVISORY</span>
                      <h3>{demandChangePct > 10 ? 'Demand is trending up' : demandChangePct < -10 ? 'Demand may be easing' : 'Keep production balanced'}</h3>
                      <p>{demandData.summary?.farmer_advisory || 'Use this forecast as one input when planning your production.'}</p>
                      <div className="demand-ai-advisory-detail">
                        <span>Forecast location</span>
                        <strong>{district}</strong>
                      </div>
                      <div className="demand-ai-advisory-detail">
                        <span>Forecast crop</span>
                        <strong>{CROP_EMOJIS[crop] || '🌿'} {crop}</strong>
                      </div>
                      <p className="demand-ai-disclaimer">Forecasts are estimates, not guaranteed sales. Consider weather, storage, and local market conditions before deciding.</p>
                    </aside>
                  </div>

                  <section className="card demand-ai-daily">
                    <div className="demand-ai-card-heading">
                      <div>
                        <span className="demand-ai-section-kicker">FORECAST DETAILS</span>
                        <h3>Daily demand outlook</h3>
                      </div>
                      <span className="demand-ai-day-count">{demandChartData.length} days</span>
                    </div>
                    <div className="demand-ai-days">
                      {demandData.forecasts.map((forecast, index) => {
                        const signal = forecast.market_signal || 'Normal'
                        const signalClass = signal.toLowerCase().includes('high')
                          ? 'high'
                          : signal.toLowerCase().includes('low') ? 'low' : 'normal'
                        return (
                          <article className="demand-ai-day" key={`${forecast.date}-${index}`}>
                            <div className="demand-ai-day-top">
                              <span>DAY {String(index + 1).padStart(2, '0')}</span>
                              <span className={`demand-ai-signal ${signalClass}`}>{signal}</span>
                            </div>
                            <time>{forecast.date}</time>
                            <strong>{Number(forecast.predicted_demand || 0).toLocaleString()} <small>kg</small></strong>
                            <span className="demand-ai-day-range">
                              Range {Number(forecast.lower_bound || 0).toLocaleString()}–{Number(forecast.upper_bound || 0).toLocaleString()} kg
                            </span>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* ════ Crop AI Tab ════ */}
          {activeTab === 'recommend' && (
            <div className="crop-ai">
              <section className="crop-ai-hero">
                <div className="crop-ai-hero-content">
                  <span className="crop-ai-eyebrow">{lang === 'bn' ? 'AGROMITRA ফসল পরিকল্পনা' : 'AGROMITRA CROP PLANNER'}</span>
                  <h2>{lang === 'bn' ? 'আপনার জমির জন্য সঠিক ফসল খুঁজুন' : 'Find the right crops for your farm'}</h2>
                  <p>{lang === 'bn' ? 'খামারের তথ্য একবার দিন—আমরা ফসলের সুপারিশ ও সম্ভাব্য ফলন দেখাব।' : 'Tell us about your farm once. We’ll suggest suitable crops and estimate your harvest.'}</p>
                  {recData && (
                    <div className="crop-ai-context">
                      <span>📍 {recData.district}</span>
                      <span>🌱 {recData.soil_type}</span>
                      <span>🗓️ {recData.current_season}</span>
                    </div>
                  )}
                </div>
                <span className="crop-ai-hero-art" aria-hidden="true">🌾</span>
              </section>
              <div className="crop-ai-steps" aria-label={lang === 'bn' ? 'ফসল পরিকল্পনার ধাপ' : 'Crop planning steps'}>
                <span><i>1</i>{lang === 'bn' ? 'খামারের তথ্য দিন' : 'Add farm details'}</span>
                <b aria-hidden="true">→</b>
                <span><i>2</i>{lang === 'bn' ? 'সুপারিশ দেখুন' : 'Review suggestions'}</span>
                <b aria-hidden="true">→</b>
                <span><i>3</i>{lang === 'bn' ? 'ফলন জানুন' : 'Check your yield'}</span>
              </div>

              <div className="crop-ai-layout">
                <form className="crop-ai-profile crop-ai-form-card" onSubmit={event => { event.preventDefault(); fetchFarmPlan() }}>
                  <div className="crop-ai-section-heading">
                    <span className="crop-ai-section-icon">🌱</span>
                    <div>
                      <span className="crop-ai-kicker">{lang === 'bn' ? 'ধাপ ১' : 'STEP 1'}</span>
                      <h3>{lang === 'bn' ? 'আপনার খামারের তথ্য' : 'Tell us about your farm'}</h3>
                      <p>{lang === 'bn' ? 'এই তথ্য Crop AI ও ফলনের হিসাব—দুই জায়গাতেই ব্যবহার হবে।' : 'We’ll use these details for both crop suggestions and the yield estimate.'}</p>
                    </div>
                  </div>
                  <div className="crop-ai-form-grid">
                    {[
                      ['farmer_name', lang === 'bn' ? 'আপনার নাম' : 'Your name', 'text'],
                      ['land_acres', lang === 'bn' ? 'জমির পরিমাণ (একর)' : 'Land size (acres)', 'number'],
                      ['budget_bdt', lang === 'bn' ? 'বাজেট (৳)' : 'Available budget (৳)', 'number'],
                    ].map(([field, label, type]) => (
                      <div className="form-group" key={field}>
                        <label className="form-label" htmlFor={`crop-ai-${field}`}>{label}</label>
                        <input id={`crop-ai-${field}`} className="form-input" type={type} value={recForm[field]}
                          onChange={e => setRecForm({ ...recForm, [field]: type === 'number' ? Number(e.target.value) : e.target.value })} />
                      </div>
                    ))}
                    {[
                      ['district', lang === 'bn' ? 'জেলা' : 'District', DISTRICTS],
                      ['experience', lang === 'bn' ? 'চাষের অভিজ্ঞতা' : 'Farming experience', ['Beginner', 'Intermediate', 'Expert']],
                    ].map(([field, label, opts]) => (
                      <div className="form-group" key={field}>
                        <label className="form-label" htmlFor={`crop-ai-${field}`}>{label}</label>
                        <select id={`crop-ai-${field}`} className="form-select" value={recForm[field]}
                          onChange={e => setRecForm({ ...recForm, [field]: e.target.value })}>
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                    <div className="form-group">
                      <label className="form-label" htmlFor="crop-ai-soil">{T('soilType')}</label>
                      <select id="crop-ai-soil" className="form-select" value={recForm.soil_type}
                        onChange={e => setRecForm({ ...recForm, soil_type: e.target.value })}>
                        {[
                          ['Loam', T('soilTypeLoam')],
                          ['Sandy Loam', T('soilTypeSandy')],
                          ['Clay Loam', T('soilTypeClayLoam')],
                          ['Clay', T('soilTypeClay')],
                        ].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="crop-ai-planting-month">{lang === 'bn' ? 'কোন মাসে বপন করবেন?' : 'When will you plant?'}</label>
                      <select id="crop-ai-planting-month" className="form-select" value={recForm.planting_month}
                        onChange={e => setRecForm({ ...recForm, planting_month: Number(e.target.value) })}>
                        {MONTH_NAMES.map((month, index) => index > 0 && <option key={index} value={index}>{month}</option>)}
                      </select>
                    </div>
                    <div className="form-group crop-ai-yield-crop-field">
                      <label className="form-label" htmlFor="crop-ai-yield-crop">{lang === 'bn' ? 'ফলন হিসাবের জন্য ফসল' : 'Which crop’s yield should we estimate?'}</label>
                      <select id="crop-ai-yield-crop" className="form-select" value={yieldForm.crop_name}
                        onChange={e => setYieldForm({ ...yieldForm, crop_name: e.target.value })}>
                        {AI_PRICE_CROPS.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <span className="crop-ai-field-hint">
                        {lang === 'bn' ? 'সুপারিশ পাওয়ার পর অন্য ফসলও বেছে নিতে পারবেন।' : 'You can switch to a recommended crop later.'}
                      </span>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-full crop-ai-submit" disabled={aiLoading || yieldLoading}>
                    {aiLoading || yieldLoading
                      ? `⏳ ${lang === 'bn' ? 'আপনার খামার বিশ্লেষণ হচ্ছে…' : 'Building your farm plan…'}`
                      : `🌱 ${lang === 'bn' ? 'আমার ফসলের পরিকল্পনা দেখান' : 'Show my crop plan'}`}
                  </button>
                  <p className="crop-ai-form-note">
                    {lang === 'bn'
                      ? 'একবার চাপলেই ফসলের সুপারিশ ও নির্বাচিত ফসলের আনুমানিক ফলন পাবেন।'
                      : 'One click gives you crop recommendations and an estimated yield for your selected crop.'}
                  </p>
                </form>

                <section className="crop-ai-results">
                  {aiLoading ? (
                    <div className="card crop-ai-state">
                      <div className="spinner-box"><div className="spinner" /><span>Finding crops that fit your farm…</span></div>
                    </div>
                  ) : recData ? (
                    <>
                      {recData.top_pick && (
                        <div className="crop-ai-top-pick">
                          <div className="crop-ai-top-copy">
                            <span className="crop-ai-kicker">🏆 BEST MATCH FOR YOUR FARM</span>
                            <h3>{CROP_EMOJIS[recData.top_pick.crop] || '🌿'} {recData.top_pick.crop}</h3>
                            <p>{recData.top_pick.name_bn} · {recData.top_pick.advisory}</p>
                            <div className="crop-ai-top-facts">
                              <span>💰 Est. profit <strong>৳{Number(recData.top_pick.est_profit || 0).toLocaleString()}</strong></span>
                              <span>⏱️ {recData.top_pick.grow_days} days</span>
                              <span>⚠️ {recData.top_pick.risk} risk</span>
                            </div>
                          </div>
                          <div className="crop-ai-top-score">
                            <strong>{recData.top_pick.score}</strong>
                            <span>match score</span>
                            <div className="crop-ai-score-track"><i style={{ width: `${Math.min(100, Math.max(0, Number(recData.top_pick.score) || 0))}%` }} /></div>
                          </div>
                        </div>
                      )}

                      <div className="crop-ai-results-heading">
                        <div>
                          <span className="crop-ai-kicker">YOUR SHORTLIST</span>
                          <h3>Recommended crops</h3>
                        </div>
                        <span className="crop-ai-result-count">{recData.recommendations?.length || 0} matches</span>
                      </div>
                      <div className="crop-ai-recommendations">
                        {recData.recommendations?.map((r, i) => (
                          <article key={`${r.crop}-${i}`} className={`crop-ai-recommendation${r.rank === 1 ? ' is-top' : ''}`}>
                            <div className="crop-ai-recommendation-main">
                              <span className="crop-ai-rank">#{r.rank}</span>
                              <span className="crop-ai-crop-icon">{CROP_EMOJIS[r.crop] || '🌿'}</span>
                              <div className="crop-ai-crop-name">
                                <strong>{r.crop}</strong>
                                <span>{r.name_bn}</span>
                              </div>
                              <div className="crop-ai-score">
                                <strong>{r.score}</strong>
                                <span>/100</span>
                              </div>
                            </div>
                            <div className="crop-ai-score-track"><i style={{ width: `${Math.min(100, Math.max(0, Number(r.score) || 0))}%` }} /></div>
                            <div className="crop-ai-details">
                              <span>💰 Profit <strong>৳{Number(r.est_profit_bdt || 0).toLocaleString()}</strong></span>
                              <span>⏱️ <strong>{r.grow_days} days</strong></span>
                              <span>⚠️ Risk <strong className={`crop-ai-risk risk-${String(r.risk_level || '').toLowerCase()}`}>{r.risk_level}</strong></span>
                              <span>📊 Demand <strong>{r.market_demand}</strong></span>
                            </div>
                            <p className="crop-ai-advisory">{r.advisory}</p>
                            <button
                              type="button"
                              className="crop-ai-yield-action"
                              onClick={() => {
                                setYieldForm(current => ({ ...current, crop_name: r.crop }))
                                fetchCropYield(r.crop)
                              }}
                              disabled={yieldLoading}
                              aria-pressed={yieldForm.crop_name === r.crop}
                            >
                              {yieldLoading && yieldForm.crop_name === r.crop
                                ? `⏳ ${lang === 'bn' ? 'হিসাব হচ্ছে…' : 'Calculating…'}`
                                : `🌾 ${lang === 'bn' ? 'এই ফসলের ফলন হিসাব করুন' : 'Estimate yield for this crop'}`}
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="card crop-ai-state crop-ai-empty">
                      <span aria-hidden="true">🌱</span>
                      <strong>{lang === 'bn' ? 'আপনার ফসলের পরিকল্পনা এখানে দেখাবে' : 'Your crop plan will appear here'}</strong>
                      <p>{lang === 'bn' ? 'বাম পাশের ফর্মটি পূরণ করে “আমার ফসলের পরিকল্পনা দেখান” চাপুন।' : 'Fill in your farm details above, then select “Show my crop plan”.'}</p>
                      <div className="crop-ai-empty-steps">
                        <span>1. {lang === 'bn' ? 'খামারের তথ্য দিন' : 'Add farm details'}</span>
                        <span>2. {lang === 'bn' ? 'ফসলের পরিকল্পনা দেখুন' : 'View your crop plan'}</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <section className="yield-ai">
                <div className="yield-ai-merged-heading">
                  <div className="yield-ai-section-heading">
                    <span className="yield-ai-section-icon">🌾</span>
                    <div>
                      <span className="yield-ai-kicker">{lang === 'bn' ? 'আপনার ফসলের হিসাব' : 'YOUR HARVEST ESTIMATE'}</span>
                      <h3>{lang === 'bn' ? 'ফলন ও সম্ভাব্য আয়' : 'Estimated harvest & returns'}</h3>
                      <p>{lang === 'bn' ? 'নির্বাচিত ফসলের ফলন ও আনুমানিক আর্থিক হিসাব এখানে দেখুন।' : 'See the estimated harvest and financial outlook for your selected crop.'}</p>
                    </div>
                  </div>
                  <span className="yield-ai-linked-crop">
                    {CROP_EMOJIS[yieldForm.crop_name] || '🌾'} {lang === 'bn' ? 'নির্বাচিত ফসল:' : 'Selected crop:'} {yieldForm.crop_name}
                  </span>
                </div>

                <section className="yield-ai-results">
                    {yieldLoading ? (
                      <div className="card yield-ai-state">
                        <div className="spinner-box"><div className="spinner" /><span>{lang === 'bn' ? 'ফলন হিসাব করা হচ্ছে…' : 'Calculating your yield outlook…'}</span></div>
                      </div>
                    ) : yieldData ? (
                      <>
                        <div className="yield-ai-result-hero">
                          <div className="yield-ai-result-crop">
                            <span className="yield-ai-result-icon">{CROP_EMOJIS[yieldData.crop] || '🌾'}</span>
                            <div>
                              <span className="yield-ai-kicker">{lang === 'bn' ? 'আপনার ফসলের পূর্বাভাস' : 'YOUR CROP OUTLOOK'}</span>
                              <h3>{yieldData.crop} <small>{yieldData.name_bn && `· ${yieldData.name_bn}`}</small></h3>
                            </div>
                          </div>
                          <span className={`yield-ai-grade grade-${String(yieldData.suitability_grade || '').toLowerCase()}`}>
                            {lang === 'bn' ? 'উপযোগিতা' : 'Suitability'} · {yieldData.suitability_grade}
                          </span>
                          <div className="yield-ai-total">
                            <strong>{Number(yieldData.estimated_total_yield_kg || 0).toLocaleString()}</strong>
                            <span>kg {lang === 'bn' ? 'সম্ভাব্য মোট ফলন' : 'estimated total yield'}</span>
                          </div>
                          <div className="yield-ai-range">
                            <span>{lang === 'bn' ? 'সম্ভাব্য ফলনের পরিসর' : 'Likely yield range'}</span>
                            <strong>{Number(yieldData.yield_range_kg?.lower || 0).toLocaleString()} – {Number(yieldData.yield_range_kg?.upper || 0).toLocaleString()} kg</strong>
                          </div>
                        </div>

                        <section className="yield-ai-finance">
                          <div className="yield-ai-subheading">
                            <div>
                              <span className="yield-ai-kicker">{lang === 'bn' ? 'আর্থিক চিত্র' : 'FINANCIAL SNAPSHOT'}</span>
                              <h3>{lang === 'bn' ? 'আয় ও ব্যয়ের হিসাব' : 'Revenue, cost & profit'}</h3>
                            </div>
                            <span className="yield-ai-finance-icon">৳</span>
                          </div>
                          <div className="yield-ai-finance-grid">
                            <article>
                              <span>📈 {lang === 'bn' ? 'সম্ভাব্য আয়' : 'Revenue'}</span>
                              <strong>৳{Number(yieldData.estimated_revenue_bdt || 0).toLocaleString()}</strong>
                            </article>
                            <article>
                              <span>🧾 {lang === 'bn' ? 'আনুমানিক খরচ' : 'Estimated cost'}</span>
                              <strong>৳{Number(yieldData.estimated_cost_bdt || 0).toLocaleString()}</strong>
                            </article>
                            <article className="is-profit">
                              <span>✨ {lang === 'bn' ? 'সম্ভাব্য লাভ' : 'Estimated profit'}</span>
                              <strong>৳{Number(yieldData.estimated_profit_bdt || 0).toLocaleString()}</strong>
                            </article>
                          </div>
                        </section>

                        <section className="yield-ai-factors">
                          <div className="yield-ai-subheading">
                            <div>
                              <span className="yield-ai-kicker">{lang === 'bn' ? 'উপযোগিতার কারণ' : 'WHY THIS ESTIMATE'}</span>
                              <h3>{lang === 'bn' ? 'চাষের উপযোগিতা' : 'Suitability factors'}</h3>
                            </div>
                          </div>
                          <div className="yield-ai-factor-list">
                            {[
                              { icon: '🌱', label: lang === 'bn' ? 'মাটি' : 'Soil', note: yieldData.factors?.soil?.note },
                              { icon: '📅', label: lang === 'bn' ? 'মৌসুম' : 'Season', note: yieldData.factors?.season?.note },
                              { icon: '📍', label: lang === 'bn' ? 'জেলা' : 'District', note: yieldData.factors?.district?.note },
                            ].filter(factor => factor.note).map(factor => (
                              <div className="yield-ai-factor" key={factor.label}>
                                <span>{factor.icon}</span>
                                <strong>{factor.label}</strong>
                                <p>{factor.note}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      </>
                    ) : (
                      <div className="card yield-ai-state yield-ai-empty">
                        <span aria-hidden="true">🌾</span>
                        <strong>{lang === 'bn' ? 'ফলনের হিসাব এখনো তৈরি হয়নি' : 'No yield estimate yet'}</strong>
                        <p>{lang === 'bn' ? 'উপরের ফর্ম থেকে ফসল বেছে নিয়ে পরিকল্পনা তৈরি করুন, অথবা যেকোনো সুপারিশে “এই ফসলের ফলন হিসাব করুন” চাপুন।' : 'Create your plan above, or choose “Estimate yield for this crop” on any recommendation.'}</p>
                      </div>
                    )}
                </section>
              </section>
            </div>
          )}

          {/* ════ My Listings Tab ════ */}
          {activeTab === 'listings' && (
            <div>
              <div className="flex justify-between mb-20">
                <div className="section-title">📦 My Product Listings</div>
                <button className="btn btn-primary" onClick={openAddModal}>{T('addProduct')}</button>
              </div>
              {productsLoading ? (
                <div className="spinner-box"><div className="spinner" /><span>Loading products…</span></div>
              ) : products.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                  <div style={{ fontSize: 16, color: '#546E7A' }}>No listings yet</div>
                  <button className="btn btn-primary mt-16" onClick={openAddModal}>{T('addProduct')}</button>
                </div>
              ) : (
                <div className="card">
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Crop</th><th>Quantity</th><th>{T('thPricePerUnit')}</th>
                          <th>District</th><th>Organic</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id}>
                            <td><strong>{p.title_en}</strong>{p.title_bn && <div style={{ fontSize: 11, color: '#888' }}>{p.title_bn}</div>}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {p.image_url ? (
                                  <img
                                    src={resolveImageUrl(p.image_url)}
                                    alt={p.title_en}
                                    style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid #E2E8F0' }}
                                  />
                                ) : (
                                  <div style={{ width: 40, height: 40, borderRadius: 6, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                    {CROP_EMOJIS[p.title_en] || '🌾'}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600 }}>{p.title_en}</div>
                                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>{p.title_bn}</div>
                                </div>
                              </div>
                            </td>
                            <td>{displayQuantity(p)?.toLocaleString()} {T(`unit_${displayUnit(p)}`)}</td>
                            <td style={{ color: '#2E7D32', fontWeight: 600 }}>৳{p.unit_price_bdt}</td>
                            <td>{p.district}</td>
                            <td>{p.is_organic ? '✅ Yes' : '—'}</td>
                            <td>
                              <span className={`badge ${p.is_available !== false ? 'badge-green' : 'badge-orange'}`}>
                                {p.is_available !== false ? 'Active' : 'Unavailable'}
                              </span>
                            </td>
                            <td style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(p)}>Edit</button>
                              <button className="btn btn-sm" style={{ background: '#FFEBEE', color: '#C62828', border: 'none' }}
                                onClick={() => handleDeleteProduct(p.id)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ Orders Table ════ */}
          {activeTab === 'orders' && (
            <div>
              <div className="flex justify-between mb-20">
                <div className="section-title">🛒 Incoming Orders</div>
                <button className="btn btn-secondary" onClick={fetchOrders}>🔄 Refresh</button>
              </div>

              {/* Status filter pills */}
              <div className="fd-order-filters">
                {[
                  ['all', 'All'],
                  ['placed', 'New'],
                  ['confirmed', 'Confirmed'],
                  ['shipped', 'Shipped'],
                  ['delivered', 'Delivered'],
                  ['cancelled', 'Cancelled'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`fd-filter-pill ${orderFilter === key ? 'fd-filter-pill--active' : ''}`}
                    onClick={() => setOrderFilter(key)}
                  >
                    {label}
                    {orderCounts[key] > 0 && (
                      <span className="fd-filter-count">{orderCounts[key]}</span>
                    )}
                  </button>
                ))}
              </div>

              {ordersLoading ? (
                <div className="spinner-box"><div className="spinner" /><span>Loading orders…</span></div>
              ) : filteredOrders.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                  <div style={{ fontSize: 16, color: '#546E7A' }}>No orders in this category</div>
                </div>
              ) : (
                <div className="card">
                  <div className="table-container">
                    <table className="fd-orders-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>You Receive</th>
                          <th>Payment</th>
                          <th>Delivery</th>
                          <th>Address</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map(o => {
                          const statusCfg = STATUS_CONFIG[o.status?.toLowerCase()] || STATUS_CONFIG.pending
                          const items = o.items || []
                          const firstItem = items[0]
                            const totalQuantity = items.length === 1 ? orderItemQuantity(firstItem) : items.length
                          const totalUnit = items.length === 1 ? T(`unit_${orderItemUnit(firstItem)}`) : T('itemCount')
                          return (
                            <tr key={o.order_id} className="fd-order-row"
                              onClick={() => setSelectedOrder(o)}
                              title="Click to view details">
                              <td>
                                <span className="fd-order-id">#{o.order_id?.slice(-6)}</span>
                              </td>
                              <td>
                                <div className="fd-date-cell">
                                  <span>{fmtDate(o.created_at)}</span>
                                  <span className="fd-time">{fmtTime(o.created_at)}</span>
                                </div>
                              </td>
                              <td>
                                <strong>
                                  {CROP_EMOJIS[firstItem?.product_name?.split(' ').find(w => CROP_EMOJIS[w])] || '🌿'}{' '}
                                  {items.length > 1
                                    ? `${firstItem?.product_name || 'Product'} + ${items.length - 1} more`
                                    : (firstItem?.product_name || `#${o.order_id?.slice(-6)}`)}
                                </strong>
                                {items.length === 1 && firstItem?.product_name_bn && (
                                  <div style={{ fontSize: 11, color: '#888' }}>{firstItem.product_name_bn}</div>
                                )}
                              </td>
                              <td><strong>{totalQuantity} {totalUnit}</strong></td>
                              <td>
                                <span className="fd-earn">৳{(o.farmer_amount || o.total_amount)?.toLocaleString()}</span>
                                {o.platform_fee > 0 && (
                                  <div className="fd-fee">fee: ৳{o.platform_fee}</div>
                                )}
                              </td>
                              <td>
                                <span className="fd-payment">
                                  {PAYMENT_ICONS[o.payment_method] || '💳'} {paymentMethodLabel(o.payment_method, T)}
                                </span>
                              </td>
                              <td>
                                <span>{deliveryMethodLabel(o.delivery_method || o.delivery_type, T)}</span>
                              </td>
                              <td>
                                <span className="fd-address" title={o.delivery_address || o.delivery_note}>
                                  {o.delivery_address
                                    ? o.delivery_address.length > 20
                                      ? o.delivery_address.slice(0, 20) + '…'
                                      : o.delivery_address
                                    : o.delivery_note || '—'}
                                </span>
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <span className={statusCfg.cls}>{statusCfg.icon} {statusCfg.label}</span>
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div className="fd-action-btns">
                                  {['placed', 'pending'].includes(o.status?.toLowerCase()) && (
                                    <>
                                      <button className="fd-action-btn fd-action-btn--confirm"
                                        onClick={() => handleOrderStatus(o.order_id, 'confirmed')}>✅</button>
                                      <button className="fd-action-btn fd-action-btn--cancel"
                                        onClick={() => handleOrderStatus(o.order_id, 'cancelled')}>✕</button>
                                    </>
                                  )}
                                  {o.status?.toLowerCase() === 'confirmed' && (
                                    <button className="fd-action-btn fd-action-btn--ship"
                                      onClick={() => handleOrderStatus(o.order_id, 'shipped')}>🚚</button>
                                  )}
                                  {o.status?.toLowerCase() === 'shipped' && (
                                    <button className="fd-action-btn fd-action-btn--deliver"
                                      onClick={() => handleOrderStatus(o.order_id, 'delivered')}>📦</button>
                                  )}
                                  {['delivered', 'cancelled'].includes(o.status?.toLowerCase()) && (
                                    <span style={{ color: '#9E9E9E', fontSize: 12 }}>—</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="fd-table-hint">💡 Click any row to see full order details</div>
                </div>
              )}
            </div>
          )}

          {/* ════ Profile Tab ════ */}
          {activeTab === 'profile' && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>

              {/* Profile Header Card */}
              <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 20 }}>
                {/* Profile Photo */}
                <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 16px' }}>
                  {user?.profile_photo_url ? (
                    <img
                      src={resolveImageUrl(user.profile_photo_url)}
                      alt="Profile"
                      style={{
                        width: 88, height: 88, borderRadius: '50%',
                        objectFit: 'cover', border: '3px solid var(--green-light)'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 88, height: 88, borderRadius: '50%',
                      background: 'var(--green-pale)', fontSize: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '3px solid var(--green-light)'
                    }}>👨‍🌾</div>
                  )}

                  {/* Upload button */}
                  <label style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--green)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    border: '2px solid white'
                  }}>
                    <span>📷</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file) return
                        try {
                          toast.loading('Uploading photo...')
                          const res = await uploadProfilePhoto(file)
                          const updatedUser = { ...user, profile_photo_url: res.data.photo_url }
                          updateStoredUser(updatedUser)
                          setUser(updatedUser)
                          toast.dismiss()
                          toast.success('Profile photo updated!')
                        } catch (err) {
                          toast.dismiss()
                          console.error(err)
                          toast.error('Upload failed. Max 2MB, JPG/PNG only.')
                        }
                      }}
                    />
                  </label>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-dark)' }}>
                  {user?.name_en || 'Farmer'}
                </div>
                {user?.name_bn && (
                  <div style={{ fontSize: 15, color: 'var(--gray)', marginTop: 4 }}>{user.name_bn}</div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <span className="badge badge-green">👨‍🌾 Farmer</span>
                  {user?.district && <span className="badge badge-blue">📍 {user.district}</span>}
                  {user?.verification_status === 'approved'
                    ? <span className="badge badge-green">✅ {T('verifiedFarmer')}</span>
                    : <span className={`badge ${user?.verification_status === 'rejected' ? 'badge-red' : 'badge-orange'}`}>
                        {user?.verification_status === 'rejected' ? T('verificationRejected') : T('verificationPending')}
                      </span>
                  }
                  <span className="badge" style={{ background: '#F3E5F5', color: '#6A1B9A' }}>
                    ⭐ {T('trustScore')}: {trustScoreLabel(user?.trust_score)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 10 }}>
                  📱 {user?.mobile_number || '—'} · 🕐 Member since {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                    : '—'
                  }
                </div>
              </div>

              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">{T('verificationQueue')}</div>
                <div style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 12 }}>
                  {T('verificationHelp')}
                </div>
                {user?.verification_reason && (
                  <div className="badge badge-red" style={{ marginBottom: 12 }}>
                    {T('verificationReason')}: {user.verification_reason}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{T('verificationReference')}</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    maxLength={1000}
                    value={verificationReference}
                    onChange={event => setVerificationReference(event.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={savingVerification}
                  onClick={async () => {
                    setSavingVerification(true)
                    try {
                      const response = await submitFarmerVerification({
                        verification_reference: verificationReference.trim() || null,
                      })
                      const updatedUser = { ...user, ...response.data }
                      updateStoredUser(updatedUser)
                      setUser(updatedUser)
                      toast.success(T('verificationSaved'))
                    } catch (error) {
                      console.error('Could not submit farmer verification:', error)
                      toast.error(T('verificationFailed'))
                    } finally {
                      setSavingVerification(false)
                    }
                  }}
                >
                  {savingVerification ? T('loading') : T('submitVerification')}
                </button>
              </div>

              {/* Editable Info Card */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div className="card-title" style={{ marginBottom: 0 }}>📝 Personal Information</div>
                  {!profileEditMode ? (
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => setProfileEditMode(true)}>
                      ✏️ Edit
                    </button>
                  ) : (
                    <button className="btn btn-sm"
                      style={{ background: '#FFEBEE', color: '#C62828', border: 'none' }}
                      onClick={() => {
                        setProfileEditMode(false)
                        setProfileForm({
                          name_en: user?.name_en || '',
                          name_bn: user?.name_bn || '',
                          district: user?.district || 'Dhaka',
                          mobile_number: user?.mobile_number || '',
                        })
                      }}>
                      ✕ Cancel
                    </button>
                  )}
                </div>

                {/* View mode */}
                {!profileEditMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: 'Full Name (English)', val: user?.name_en || '—', icon: '👤' },
                      { label: 'নাম (বাংলা)', val: user?.name_bn || '—', icon: '🔤' },
                      { label: T('mobileNumber'), val: user?.mobile_number || '—', icon: '📱' },
                      { label: 'District', val: user?.district || '—', icon: '📍' },
                    ].map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', background: '#F8FAFC',
                        borderRadius: 8, border: '1px solid #EEF0F2'
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {f.label}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-dark)', marginTop: 2 }}>
                            {f.val}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Edit mode */
                  <div>
                    <div className="form-group">
                      <label className="form-label">Full Name (English) *</label>
                      <input className="form-input" value={profileForm.name_en}
                        onChange={e => setProfileForm({ ...profileForm, name_en: e.target.value })}
                        placeholder="Mohammad Rahim" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">নাম (বাংলা)</label>
                      <input className="form-input" value={profileForm.name_bn}
                        onChange={e => setProfileForm({ ...profileForm, name_bn: e.target.value })}
                        placeholder="মোহাম্মদ রহিম" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Number</label>
                      <input className="form-input" value={profileForm.mobile_number}
                        disabled style={{ background: '#F5F5F5', cursor: 'not-allowed' }}
                        placeholder="01711223344" />
                      <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 4 }}>
                        📵 Mobile number cannot be changed
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">District</label>
                      <select className="form-select" value={profileForm.district}
                        onChange={e => setProfileForm({ ...profileForm, district: e.target.value })}>
                        {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>

                    <button
                      className="btn btn-primary btn-full"
                      disabled={savingProfile}
                      onClick={async () => {
                        if (!profileForm.name_en.trim()) {
                          toast.error('Name is required')
                          return
                        }
                        setSavingProfile(true)
                        try {
                          const res = await updateProfile({
                            name_en: profileForm.name_en,
                            name_bn: profileForm.name_bn,
                            mobile_number: profileForm.mobile_number,
                            district: profileForm.district,
                          })
                          // localStorage sync করো যাতে refresh-এ নতুন data থাকে
                          const updatedUser = { ...user, ...res.data }
                          updateStoredUser(updatedUser)
                          setUser(updatedUser)
                          toast.success('Profile updated successfully!')
                          setProfileEditMode(false)
                        } catch {
                          toast.error('Could not update profile')
                        } finally {
                          setSavingProfile(false)
                        }
                      }}
                    >
                      {savingProfile ? '⏳ Saving…' : '✅ Save Changes'}
                    </button>
                  </div>
                )}
              </div>

              {/* Stats Summary Card */}
              <div className="card">
                <div className="card-title">📊 My Stats</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { icon: '📦', label: T('activeListings'), val: activeListings, color: '#E8F5E9', text: '#2E7D32' },
                    { icon: '🛒', label: T('totalOrdersLabel'), val: orders.length, color: '#E3F2FD', text: '#1976D2' },
                    { icon: '✅', label: 'Delivered', val: orderCounts.delivered, color: '#E8F5E9', text: '#2E7D32' },
                    { icon: '💰', label: T('totalEarningsStat'), val: `৳${totalEarnings.toLocaleString()}`, color: '#FFF3E0', text: '#E65100' },
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: s.color, borderRadius: 10,
                      padding: '16px 14px', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 28 }}>{s.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.text, marginTop: 4 }}>{s.val}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ════ Add / Edit Product Modal ════ */}
          {showModal && (
            <div className="fd-overlay">
              <div className="fd-modal">
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
                  {editingProduct ? T('editProduct') : T('addProduct')}
                </div>
                <div className="form-group">
                  <label className="form-label">{T('productCrop')} *</label>
                  <input className="form-input farmer-product-input" type="text" list="farmer-crop-options"
                    value={productForm.title_en}
                    onChange={e => setProductForm({
                      ...productForm,
                      title_en: e.target.value,
                      category: cropCategory(e.target.value),
                    })}
                    placeholder={T('cropInputPlaceholder')} required />
                  <datalist id="farmer-crop-options">
                    {[...new Set([...CROPS, ...AI_PRICE_CROPS])].map(cropName => (
                      <option key={cropName} value={cropName} />
                    ))}
                  </datalist>
                </div>
                {/* ── 📸 প্রোডাক্ট ছবি আপলোড ফিল্ড ── */}
                {/* ── 📸 প্রোডাক্ট ছবি আপলোড ফিল্ড ── */}
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">{T('productPhoto')}</label>

                  {/* ছবি লোকালি সিলেক্ট করা থাকলে বা আগের কোনো ইমেজ থাকলে তার প্রিভিউ দেখাবে */}
                  {productForm.image_url && (
                    <div style={{ marginBottom: 8, position: 'relative', width: 80, height: 80 }}>
                      <img
                        src={resolveImageUrl(productForm.image_url)}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
                      />
                      <button
                        type="button"
                        style={{ position: 'absolute', top: -5, right: -5, background: '#FFEBEE', color: '#C62828', border: 'none', borderRadius: '50%', cursor: 'pointer', width: 20, height: 20, fontSize: 10 }}
                        onClick={() => setProductForm({ ...productForm, image_url: '', image_file: null })}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <label className="farmer-photo-picker">
                    <span>{T('choosePhoto')}</span>
                    <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;

                      // লোকাল প্রিভিউ দেখানোর জন্য একটি টেম্পোরারি URL তৈরি করা হচ্ছে
                      const localPreviewUrl = URL.createObjectURL(file);

                      // স্টেটে ফাইল এবং প্রিভিউ URL দুটিই সেভ করে রাখা হচ্ছে
                      setProductForm({
                        ...productForm,
                        image_file: file,
                        image_url: localPreviewUrl
                      });

                      toast.success(T('photoSelected'));
                    }}
                    />
                  </label>
                </div>
                <div className="farmer-product-row">
                  <div className="form-group">
                    <label className="form-label">{T('productQuantity')} *</label>
                    <input className="form-input farmer-product-input" type="number" min="0.01"
                      value={productForm.quantity}
                      step={['dozen', 'piece'].includes(productForm.sale_unit) ? '1' : '0.01'}
                      onChange={e => setProductForm({ ...productForm, quantity: e.target.value })}
                      placeholder="0" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{T('productUnit')}</label>
                    <select className="form-select farmer-product-input" value={productForm.sale_unit}
                      onChange={e => {
                        const nextUnit = e.target.value
                        const previousUnit = productForm.sale_unit
                        const sameKind = ['kg', 'maund'].includes(previousUnit) === ['kg', 'maund'].includes(nextUnit)
                        setProductForm({
                          ...productForm,
                          sale_unit: nextUnit,
                          quantity: sameKind && productForm.quantity
                            ? Number(productForm.quantity) * UNIT_TO_BASE[previousUnit] / UNIT_TO_BASE[nextUnit]
                            : '',
                          unit_price_bdt: sameKind && productForm.unit_price_bdt
                            ? Number(productForm.unit_price_bdt) * UNIT_TO_BASE[nextUnit] / UNIT_TO_BASE[previousUnit]
                            : '',
                        })
                      }}>
                      {['kg', 'maund', 'dozen', 'piece'].map(unit => (
                        <option key={unit} value={unit}>{T(`unit_${unit}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                    <label className="form-label">
                      {T('productPrice')} (৳) · {T('productPricePerUnit').replace('{unit}', T(`unit_${productForm.sale_unit}`))}
                    </label>
                    <input className="form-input farmer-product-input" type="number" min="0.01" step="0.01"
                      value={productForm.unit_price_bdt}
                      onChange={e => setProductForm({ ...productForm, unit_price_bdt: e.target.value })}
                      placeholder="0" required />
                </div>

                {/* ── 🤖 AI Price Suggestion ── */}
                <div className="form-group" style={{
                  background: 'var(--green-pale, #E8F5E9)', borderRadius: 10, padding: 14, marginTop: 4
                }}>
                  <div className="form-label" style={{ marginBottom: 6 }}>
                  🤖 {T('aiPriceSuggestionLabel')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gray, #546E7A)' }}>
                    {aiPriceLoading ? T('aiPriceChecking') : aiPriceError
                      ? T('aiPriceUnavailable')
                      : aiPriceSuggestion
                        ? T('aiReferencePerKg').replace('{price}', String(aiPriceSuggestion.summary.avg_forecast))
                        : T('aiPriceTypeCrop')}
                  </div>

                  {aiPriceSuggestion && (
                    <div style={{
                      marginTop: 12, background: 'var(--bg-card, white)', borderRadius: 8,
                      padding: 12, border: '1px solid var(--border-col, #C8E6C9)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--gray, #546E7A)' }}>{T('Current market price', 'বর্তমান বাজারদর')}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-dark, #1B5E20)' }}>
                            ৳{aiPriceSuggestion.current_price}/kg
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--gray, #546E7A)' }}>{T('7-day AI forecast avg', '৭-দিনের AI পূর্বাভাস')}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-dark, #1B5E20)' }}>
                            ৳{aiPriceSuggestion.summary.avg_forecast}/kg
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 8 }}>{aiPriceSuggestion.summary.market_outlook}</div>
                      <div style={{
                        fontSize: 11, marginTop: 6, display: 'inline-block',
                        padding: '3px 8px', borderRadius: 12,
                        background: aiPriceSuggestion.model_used === 'prophet_xgboost_hybrid_v1'
                          ? 'var(--green-pale, #E8F5E9)' : '#FFF3E0',
                        color: aiPriceSuggestion.model_used === 'prophet_xgboost_hybrid_v1'
                          ? 'var(--green-dark, #1B5E20)' : '#E65100',
                      }}>
                        {aiPriceSuggestion.model_used === 'prophet_xgboost_hybrid_v1'
                          ? T('🤖 Trained AI model (Prophet + XGBoost)', '🤖 প্রশিক্ষিত AI মডেল (Prophet + XGBoost)')
                          : T('📊 Statistical estimate — no trained model yet for this crop/district', '📊 পরিসংখ্যানগত অনুমান — এই ফসল/জেলার জন্য এখনো প্রশিক্ষিত মডেল নেই')}
                      </div>
                      {['kg', 'maund'].includes(productForm.sale_unit) ? (
                      <button type="button" className="btn btn-primary btn-sm farmer-product-action" style={{ marginTop: 10, display: 'block' }}
                        onClick={() => {
                          const multiplier = UNIT_TO_BASE[productForm.sale_unit]
                          setProductForm({
                            ...productForm,
                            unit_price_bdt: Number(aiPriceSuggestion.summary.avg_forecast) * multiplier,
                          })
                          toast.success(T('priceApplied'))
                        }}>
                        ✅ {T('useSuggestedPrice')}
                      </button>
                      ) : <div style={{ fontSize: 12, marginTop: 8 }}>{T('aiCountUnitPriceNote')}</div>}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">{T('productDistrict')}</label>
                  <select className="form-select" value={productForm.district}
                    onChange={e => { setProductForm({ ...productForm, district: e.target.value }); setAiPriceSuggestion(null) }}>
                    {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="farmer-product-actions">
                  <button className="btn btn-primary farmer-product-action" style={{ flex: 1 }}
                    onClick={handleSaveProduct} disabled={savingProduct}>
                    {savingProduct ? '⏳ Saving…' : editingProduct ? T('updateListing') : T('addListing')}
                  </button>
                  <button className="btn btn-secondary farmer-product-action" onClick={() => setShowModal(false)}>{T('cancel')}</button>
                </div>
              </div>
            </div>
          )}

          {/* ════ Order Detail Modal ════ */}
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onStatusUpdate={handleOrderStatus}
            T={T}
          />

          {/* ════ Settings Tab ════ */}
          {activeTab === 'settings' && (
            <SettingsTab userRole="farmer" />
          )}

        </div>  {/* dashboard-content */}
      </div>  {/* dashboard-layout */}

    </div>
  )
}