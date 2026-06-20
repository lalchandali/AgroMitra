import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { getAllProducts, getMyOrders, placeOrder, getStoredUser, getFairPrice, getPricePrediction, getDemandForecast } from '../api/agromitra'

const CROP_EMOJIS = {
  Tomato:'🍅', Onion:'🧅', Potato:'🥔', Brinjal:'🍆',
  Cabbage:'🥬', Cauliflower:'🥦', Garlic:'🧄', Rice:'🌾',
  Ginger:'🫚', Corn:'🌽', Chili:'🌶️', Carrot:'🥕',
  Cucumber:'🥒', Pumpkin:'🎃', Spinach:'🥗', Wheat:'🌾',
}

const orderBadge = (status) => {
  const map = {
    pending:   'badge-gold',
    confirmed: 'badge-blue',
    shipped:   'badge-blue',
    delivered: 'badge-green',
    cancelled: 'badge-red',
  }
  return map[status?.toLowerCase()] || 'badge-blue'
}

export default function BuyerMarketplace() {
  const user = getStoredUser()

  // ── Browse state ────────────────────────────────────────────
  const [products, setProducts]       = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [search, setSearch]           = useState('')
  const [filterDistrict, setFilterDistrict] = useState('All')
  const [filterOrganic, setFilterOrganic]   = useState(false)

  // ── Cart state ──────────────────────────────────────────────
  const [cart, setCart]               = useState([])  // [{product, quantity_kg}]
  const [activeTab, setActiveTab]     = useState('browse')

  // ── AI Insight state (per product, on-demand) ─────────────────
  const [aiInsights, setAiInsights]   = useState({})   // { [product_id]: {loading, data, error} }
  const [openInsightId, setOpenInsightId] = useState(null)

  // ── Checkout state ──────────────────────────────────────────
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '')
  const [paymentMethod, setPaymentMethod]     = useState('bkash')
  const [deliveryType, setDeliveryType]       = useState('pickup')
  const [placingOrder, setPlacingOrder]       = useState(false)

  // ── Orders state ────────────────────────────────────────────
  const [orders, setOrders]           = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // ── Fetch products ──────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await getAllProducts()
      setProducts(res.data || [])
    } catch {
      toast.error('Could not load products')
    } finally { setProductsLoading(false) }
  }, [])

  // ── Fetch orders ────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await getMyOrders()
      setOrders(res.data || [])
    } catch {
      toast.error('Could not load orders')
    } finally { setOrdersLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { if (activeTab === 'orders') fetchOrders() }, [activeTab, fetchOrders])

  // ── Derived stats ───────────────────────────────────────────
  const uniqueDistricts = [...new Set(products.map(p => p.district).filter(Boolean))]
  const organicCount    = products.filter(p => p.is_organic).length

  // ── Filter products ─────────────────────────────────────────
  const filtered = products.filter(p => {
    const matchSearch   = !search ||
      p.title_en?.toLowerCase().includes(search.toLowerCase()) ||
      p.district?.toLowerCase().includes(search.toLowerCase())
    const matchDistrict = filterDistrict === 'All' || p.district === filterDistrict
    const matchOrganic  = !filterOrganic || p.is_organic
    return matchSearch && matchDistrict && matchOrganic
  })

  // ── Cart helpers ────────────────────────────────────────────
  const getEmoji = (product) => {
    const name = product.title_en || ''
    for (const [key, emoji] of Object.entries(CROP_EMOJIS)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return emoji
    }
    return '🌿'
  }

  // ── AI Insight: fair price + price trend + demand, on-demand ──
  // Crop name guessed from title_en since product doesn't carry a raw crop_name field.
  const guessCropName = (product) => {
    const name = (product.title_en || '').trim()
    for (const key of Object.keys(CROP_EMOJIS)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return key
    }
    return name.split(' ')[0] || name
  }

  const toggleAiInsight = async (product) => {
    const id = product.product_id

    if (openInsightId === id) {
      setOpenInsightId(null)
      return
    }
    setOpenInsightId(id)

    if (aiInsights[id]?.data || aiInsights[id]?.loading) return

    setAiInsights(prev => ({ ...prev, [id]: { loading: true, data: null, error: null } }))

    const cropName = guessCropName(product)

    try {
      const [fairRes, priceRes, demandRes] = await Promise.all([
        getFairPrice(cropName, product.district),
        getPricePrediction(cropName, product.district, 7),
        getDemandForecast(cropName, product.district, 7),
      ])
      setAiInsights(prev => ({
        ...prev,
        [id]: {
          loading: false,
          error: null,
          data: {
            fair:   fairRes.data,
            price:  priceRes.data,
            demand: demandRes.data,
          },
        },
      }))
    } catch {
      setAiInsights(prev => ({ ...prev, [id]: { loading: false, data: null, error: true } }))
    }
  }

  const addToCart = (product) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.product_id === product.product_id)
      if (exists) return prev.map(i =>
        i.product.product_id === product.product_id
          ? { ...i, quantity_kg: i.quantity_kg + 1 }
          : i
      )
      return [...prev, { product, quantity_kg: 1 }]
    })
    toast.success(`${getEmoji(product)} ${product.title_en} added to cart!`)
  }

  const updateQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => i.product.product_id === productId ? { ...i, quantity_kg: Math.max(1, i.quantity_kg + delta) } : i)
    )
  }

  const removeFromCart = (productId) =>
    setCart(prev => prev.filter(i => i.product.product_id !== productId))

  const cartTotal = cart.reduce((sum, i) => sum + (i.product.unit_price_bdt * i.quantity_kg), 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity_kg, 0)

  // ── Place order ─────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      toast.error('Please enter a delivery address')
      return
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    setPlacingOrder(true)
    const results = { success: 0, failed: 0 }

    for (const item of cart) {
      try {
        await placeOrder({
          product_id:       item.product.product_id,
          quantity_kg:      item.quantity_kg,
          payment_method:   paymentMethod,
          delivery_type:    deliveryType,
          delivery_address: deliveryAddress,
        })
        results.success++
      } catch {
        results.failed++
      }
    }

    setPlacingOrder(false)

    if (results.success > 0) {
      toast.success(`✅ ${results.success} order(s) placed! Payment held in Escrow.`)
      setCart([])
      setActiveTab('orders')
      fetchOrders()
    }
    if (results.failed > 0) {
      toast.error(`${results.failed} order(s) failed`)
    }
  }

  // ════════════════════════════════════════════════════════════
  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-header flex justify-between">
        <div>
          <div className="page-title">🛒 Buyer Marketplace</div>
          <div className="page-subtitle">Fresh produce directly from Bangladeshi farmers — zero middlemen</div>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('cart')}>
          🛒 Cart
          {cartCount > 0 && (
            <span style={{ background:'white', color:'#2E7D32', borderRadius:20, padding:'1px 8px', marginLeft:6 }}>
              {cartCount} kg
            </span>
          )}
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        {[
          { icon:'🌾', label:'Active Listings',   val: productsLoading ? '…' : products.length,        color:'#E8F5E9', border:'#2E7D32' },
          { icon:'📍', label:'Districts',          val: productsLoading ? '…' : uniqueDistricts.length, color:'#FFF3E0', border:'#E65100' },
          { icon:'🌱', label:'Organic Products',   val: productsLoading ? '…' : organicCount,           color:'#E8F5E9', border:'#2E7D32' },
          { icon:'📦', label:'My Orders',          val: ordersLoading   ? '…' : orders.length,          color:'#F3E5F5', border:'#6A1B9A' },
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{ borderLeftColor: s.border }}>
            <div className="stat-icon" style={{ background: s.color, fontSize:28 }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {[
          ['browse', '🌾 Browse Products'],
          ['cart',   `🛒 Cart (${cartCount} kg)`],
          ['orders', '📦 My Orders'],
        ].map(([k,v]) => (
          <div key={k} className={`tab ${activeTab===k?'active':''}`} onClick={() => setActiveTab(k)}>{v}</div>
        ))}
      </div>

      {/* ════ Browse Tab ════ */}
      {activeTab === 'browse' && (
        <div>
          {/* Filters */}
          <div className="card mb-20">
            <div className="flex gap-12" style={{ flexWrap:'wrap', alignItems:'center' }}>
              <input
                className="form-input" style={{ flex:1, minWidth:200 }}
                placeholder="🔍 Search crops or districts..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
              <button
                className={`btn btn-sm ${filterOrganic ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterOrganic(p => !p)}
              >
                🌱 Organic Only
              </button>
              <button
                className={`btn btn-sm ${filterDistrict==='All' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterDistrict('All')}
              >All</button>
              {uniqueDistricts.slice(0,6).map(d => (
                <button key={d}
                  className={`btn btn-sm ${filterDistrict===d ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterDistrict(d)}
                >{d}</button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {productsLoading ? (
            <div className="spinner-box"><div className="spinner"/><span>Loading products…</span></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9E9E9E' }}>
              <div style={{ fontSize:48 }}>🔍</div>
              <div style={{ marginTop:16, fontSize:16 }}>No products found</div>
            </div>
          ) : (
            <div className="grid-auto">
              {filtered.map(p => (
                <div key={p.product_id} className="product-card">
                  <div className="product-img">{getEmoji(p)}</div>
                  <div className="product-body">
                    <div className="flex justify-between flex-center mb-20">
                      <div>
                        <div className="product-name">
                          {p.title_en}
                          {p.title_bn && <span style={{ fontSize:13, color:'#546E7A' }}> ({p.title_bn})</span>}
                        </div>
                        <div className="product-location">
                          📍 {p.district} • 👨‍🌾 {p.farmer_name || 'Farmer'}
                        </div>
                      </div>
                      <div className="flex gap-8" style={{ flexDirection:'column', alignItems:'flex-end' }}>
                        {p.is_organic && <span className="badge badge-green">🌱 Organic</span>}
                        {p.quality_grade && <span className="badge badge-blue">Grade {p.quality_grade}</span>}
                      </div>
                    </div>
                    <div className="flex justify-between flex-center">
                      <div>
                        <div className="product-price">৳{p.unit_price_bdt}<span>/kg</span></div>
                        <div style={{ fontSize:13, color:'#546E7A' }}>
                          Available: {p.quantity_kg?.toLocaleString()} kg
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="product-footer" style={{ flexDirection:'column', gap:8 }}>
                    <div style={{ display:'flex', gap:8, width:'100%' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex:1 }}
                        onClick={() => addToCart(p)}
                      >🛒 Add to Cart</button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleAiInsight(p)}
                      >🤖 AI Insight</button>
                    </div>

                    {openInsightId === p.product_id && (
                      <div style={{
                        width:'100%', background:'#F4FBF6', border:'1px solid #DCEFE0',
                        borderRadius:8, padding:12, fontSize:13,
                      }}>
                        {aiInsights[p.product_id]?.loading && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#546E7A' }}>
                            <div className="spinner" style={{ width:16, height:16, borderWidth:2 }} />
                            Analyzing market data…
                          </div>
                        )}
                        {aiInsights[p.product_id]?.error && (
                          <div style={{ color:'#C62828' }}>⚠️ Could not load AI insight for this crop/district.</div>
                        )}
                        {aiInsights[p.product_id]?.data && (() => {
                          const { fair, price, demand } = aiInsights[p.product_id].data
                          const listed = p.unit_price_bdt
                          const isFair = fair && listed >= fair.fair_price_min && listed <= fair.fair_price_max
                          return (
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span>💰 Fair price range</span>
                                <strong>৳{fair?.fair_price_min}–{fair?.fair_price_max}/kg</strong>
                              </div>
                              <span className={`badge ${isFair ? 'badge-green' : 'badge-orange'}`} style={{ alignSelf:'flex-start' }}>
                                {isFair ? '✅ Listed price is fair' : '⚠️ Above typical fair range'}
                              </span>
                              <div style={{ display:'flex', justifyContent:'space-between' }}>
                                <span>📈 7-day trend</span>
                                <strong>{(price?.summary?.trend_pct ?? 0) > 0 ? '↑' : '↓'} {Math.abs(price?.summary?.trend_pct ?? 0).toFixed(1)}%</strong>
                              </div>
                              <div style={{ display:'flex', justifyContent:'space-between' }}>
                                <span>📊 Demand signal</span>
                                <strong>{demand?.forecasts?.[0]?.market_signal || '—'}</strong>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ Cart Tab ════ */}
      {activeTab === 'cart' && (
        <div className="grid-2">
          {/* Cart Items */}
          <div className="card">
            <div className="card-title">🛒 Your Cart</div>
            {cart.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#9E9E9E' }}>
                <div style={{ fontSize:48 }}>🛒</div>
                <div style={{ marginTop:12 }}>Your cart is empty</div>
                <button className="btn btn-primary mt-16" onClick={() => setActiveTab('browse')}>
                  Browse Products
                </button>
              </div>
            ) : (
              <>
                {cart.map((item, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'14px 0', borderBottom:'1px solid #F0F0F0'
                  }}>
                    <span style={{ fontSize:32 }}>{getEmoji(item.product)}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600 }}>{item.product.title_en}</div>
                      <div style={{ fontSize:13, color:'#546E7A' }}>
                        ৳{item.product.unit_price_bdt}/kg
                      </div>
                    </div>
                    {/* Qty controls */}
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <button className="btn btn-sm btn-secondary"
                        style={{ padding:'2px 10px' }}
                        onClick={() => updateQty(item.product.product_id, -1)}>−</button>
                      <span style={{ fontWeight:600, minWidth:32, textAlign:'center' }}>
                        {item.quantity_kg} kg
                      </span>
                      <button className="btn btn-sm btn-secondary"
                        style={{ padding:'2px 10px' }}
                        onClick={() => updateQty(item.product.product_id, 1)}>+</button>
                    </div>
                    <div style={{ fontWeight:700, color:'#2E7D32', minWidth:70, textAlign:'right' }}>
                      ৳{(item.product.unit_price_bdt * item.quantity_kg).toLocaleString()}
                    </div>
                    <button
                      className="btn btn-sm"
                      style={{ background:'#FFEBEE', color:'#C62828', border:'none' }}
                      onClick={() => removeFromCart(item.product.product_id)}
                    >✕</button>
                  </div>
                ))}
                <div style={{ paddingTop:16, borderTop:'2px solid #E0E0E0', marginTop:8 }}>
                  <div className="flex justify-between" style={{ fontSize:20, fontWeight:700 }}>
                    <span>Total</span>
                    <span style={{ color:'#2E7D32' }}>৳{cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Checkout */}
          {cart.length > 0 && (
            <div className="card">
              <div className="card-title">💳 Checkout</div>

              <div className="form-group">
                <label className="form-label">Delivery Address *</label>
                <input className="form-input"
                  placeholder="House, Road, Area, District..."
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}/>
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Type</label>
                <select className="form-select" value={deliveryType}
                  onChange={e => setDeliveryType(e.target.value)}>
                  <option value="pickup">📦 Pickup</option>
                  <option value="delivery">🚚 Home Delivery</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="bkash">💚 bKash</option>
                  <option value="nagad">🔵 Nagad</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                  <option value="cash_on_delivery">💵 Cash on Delivery</option>
                </select>
              </div>

              <div className="alert alert-info">
                🔒 Payment protected by AgroMitra Escrow — funds released only after delivery confirmation.
              </div>

              {/* Order summary */}
              <div style={{ background:'#F9FBF9', borderRadius:8, padding:12, marginBottom:16 }}>
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between" style={{ fontSize:13, marginBottom:4 }}>
                    <span>{getEmoji(item.product)} {item.product.title_en} × {item.quantity_kg} kg</span>
                    <span style={{ color:'#2E7D32', fontWeight:600 }}>
                      ৳{(item.product.unit_price_bdt * item.quantity_kg).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between" style={{ fontWeight:700, marginTop:8, borderTop:'1px solid #E0E0E0', paddingTop:8 }}>
                  <span>Total ({cart.length} item{cart.length>1?'s':''})</span>
                  <span style={{ color:'#2E7D32' }}>৳{cartTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                className="btn btn-primary btn-full"
                onClick={handlePlaceOrder}
                disabled={placingOrder}
              >
                {placingOrder ? '⏳ Placing Order…' : `✅ Place Order — ৳${cartTotal.toLocaleString()}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════ Orders Tab ════ */}
      {activeTab === 'orders' && (
        <div>
          <div className="flex justify-between mb-20">
            <div className="section-title">📦 My Orders</div>
            <button className="btn btn-secondary" onClick={fetchOrders}>🔄 Refresh</button>
          </div>

          {ordersLoading ? (
            <div className="spinner-box"><div className="spinner"/><span>Loading orders…</span></div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
              <div style={{ fontSize:16, color:'#546E7A' }}>No orders yet</div>
              <button className="btn btn-primary mt-16" onClick={() => setActiveTab('browse')}>
                Browse Products
              </button>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th><th>Product</th><th>Qty</th>
                      <th>Total</th><th>Payment</th><th>Status</th><th>Escrow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.order_id}>
                        <td style={{ fontFamily:'monospace', fontSize:12 }}>
                          #{o.order_id?.slice(-6)}
                        </td>
                        <td><strong>🌿 {o.product_id?.slice(-6) || '—'}</strong></td>
                        <td>{o.quantity_kg} kg</td>
                        <td style={{ color:'#2E7D32', fontWeight:600 }}>
                          ৳{o.total_amount?.toLocaleString() || '—'}
                        </td>
                        <td>
                          <span className="badge badge-blue">
                            {o.payment_method || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${orderBadge(o.status)}`}>{o.status}</span>
                        </td>
                        <td>
                          <span className={`badge ${o.payment_status === 'released' ? 'badge-green' : 'badge-gold'}`}>
                            {o.payment_status || 'in_escrow'}
                          </span>
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

    </div>
  )
}
