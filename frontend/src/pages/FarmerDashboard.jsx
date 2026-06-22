import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import {
  getPricePrediction, getDemandForecast, getCropRecommendation,
  getMyProducts, createProduct, updateProduct, deleteProduct,
  getMyOrders, updateOrderStatus,
  getStoredUser
} from '../api/agromitra'
import toast from 'react-hot-toast'

// ── Constants ────────────────────────────────────────────────
const CROPS = [
  "Rice","Wheat","Corn","Tomato","Onion","Potato","Brinjal","Cabbage",
  "Cauliflower","Cucumber","Chili","Pumpkin","Spinach","Carrot","Radish",
  "Lettuce","Beetroot","Okra","Pea","Garlic","Ginger","Turmeric",
  "Fenugreek","Mustard","Bitter Gourd","Bottle Gourd","Snake Gourd",
  "Ridge Gourd","Yam","Sweet Potato"
]
const DISTRICTS = [
  "Bagerhat","Bandarban","Barguna","Barishal","Bhola","Bogura",
  "Brahmanbaria","Chandpur","Chapai Nawabganj","Chattogram","Chuadanga",
  "Cumilla","Cox's Bazar","Dhaka","Dinajpur","Faridpur","Feni","Gaibandha",
  "Gazipur","Gopalganj","Habiganj","Jamalpur","Jashore","Jhalokathi",
  "Jhenaidah","Joypurhat","Khagrachhari","Khulna","Kishoreganj","Kurigram",
  "Kushtia","Lakshmipur","Lalmonirhat","Madaripur","Magura","Manikganj",
  "Meherpur","Moulvibazar","Munshiganj","Mymensingh","Naogaon","Narail",
  "Narayanganj","Narsingdi","Natore","Netrokona","Nilphamari","Noakhali",
  "Pabna","Panchagarh","Patuakhali","Pirojpur","Rajbari","Rajshahi",
  "Rangamati","Rangpur","Satkhira","Shariatpur","Sherpur","Sirajganj",
  "Sunamganj","Sylhet","Tangail","Thakurgaon"
]
const CROP_EMOJIS = {
  Tomato:'🍅', Onion:'🧅', Potato:'🥔', Brinjal:'🍆',
  Cabbage:'🥬', Cauliflower:'🥦', Garlic:'🧄', Rice:'🌾',
  Ginger:'🫚', Corn:'🌽', Chili:'🌶️', Carrot:'🥕',
  Cucumber:'🥒', Pumpkin:'🎃', Spinach:'🥗'
}

// ── Blank product form ────────────────────────────────────────
const BLANK_PRODUCT = {
  title_en: '', title_bn: '', category: 'Vegetable',
  description_en: '', quantity_kg: '', unit_price_bdt: '',
  quality_grade: 'A', district: 'Dhaka',
  is_organic: false, harvest_date: '', availability_until: ''
}

// ── Order status badge color ──────────────────────────────────
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

// ════════════════════════════════════════════════════════════
export default function FarmerDashboard() {
  const user = getStoredUser()

  // ── Tab & AI state ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview')
  const [crop, setCrop]           = useState('Tomato')
  const [district, setDistrict]   = useState('Bogura')
  const [priceData, setPriceData] = useState(null)
  const [demandData, setDemandData] = useState(null)
  const [recData, setRecData]     = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [recForm, setRecForm]     = useState({
    farmer_name:   user?.full_name || 'Mohammad Rahim',
    district:      'Bogura',
    soil_type:     'Loam',
    land_acres:    2.5,
    budget_bdt:    80000,
    experience:    'Intermediate',
    planting_month: new Date().getMonth() + 1
  })

  // ── Products state ──────────────────────────────────────────
  const [products, setProducts]         = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [showModal, setShowModal]       = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)   // null = add new
  const [productForm, setProductForm]   = useState(BLANK_PRODUCT)
  const [savingProduct, setSavingProduct] = useState(false)

  // ── Orders state ────────────────────────────────────────────
  const [orders, setOrders]             = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // ── Fetch AI data ───────────────────────────────────────────
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

  // ── Fetch Products ──────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await getMyProducts()
      setProducts(res.data || [])
    } catch {
      toast.error('Could not load your products')
    } finally { setProductsLoading(false) }
  }, [])

  // ── Fetch Orders ────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await getMyOrders()
      setOrders(res.data || [])
    } catch {
      toast.error('Could not load your orders')
    } finally { setOrdersLoading(false) }
  }, [])

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => { fetchAI() },      [fetchAI])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchOrders() },   [fetchOrders])

  // ── Derived stats ───────────────────────────────────────────
  const activeListings  = products.filter(p => p.is_available !== false).length
  const pendingOrders   = orders.filter(o => o.status?.toLowerCase() === 'placed').length
  const totalEarnings   = orders
    .filter(o => o.status?.toLowerCase() === 'delivered')
    .reduce((sum, o) => sum + (o.total_price || 0), 0)

  // ── Chart data ──────────────────────────────────────────────
  const priceChartData = priceData?.forecasts?.map(f => ({
    date:  f.date.slice(5),
    price: f.predicted_price,
    low:   f.lower_bound,
    high:  f.upper_bound,
  })) || []

  const demandChartData = demandData?.forecasts?.map(f => ({
    date:   f.date.slice(5),
    demand: f.predicted_demand,
  })) || []

  // ── Product modal helpers ────────────────────────────────────
  const openAddModal = () => {
    setEditingProduct(null)
    setProductForm(BLANK_PRODUCT)
    setShowModal(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setProductForm({
      title_en:           product.title_en || '',
      title_bn:           product.title_bn || '',
      category:           product.category || 'Vegetable',
      description_en:     product.description_en || '',
      quantity_kg:        product.quantity_kg,
      unit_price_bdt:     product.unit_price_bdt,
      quality_grade:      product.quality_grade || 'A',
      district:           product.district,
      is_organic:         product.is_organic || false,
      harvest_date:       product.harvest_date || '',
      availability_until: product.availability_until || '',
    })
    setShowModal(true)
  }

  const handleSaveProduct = async () => {
    if (!productForm.title_en || !productForm.quantity_kg || !productForm.unit_price_bdt) {
      toast.error('Title, quantity, and price are required')
      return
    }
    setSavingProduct(true)
    try {
      const payload = {
        ...productForm,
        quantity_kg:    Number(productForm.quantity_kg),
        unit_price_bdt: Number(productForm.unit_price_bdt),
        harvest_date:       productForm.harvest_date       || new Date().toISOString(),
        availability_until: productForm.availability_until || new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      }
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload)
        toast.success('Product updated!')
      } else {
        await createProduct(payload)
        toast.success('Product listed!')
      }
      setShowModal(false)
      fetchProducts()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save product')
    } finally { setSavingProduct(false) }
  }

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this listing?')) return
    try {
      await deleteProduct(id)
      toast.success('Listing deleted')
      fetchProducts()
    } catch {
      toast.error('Could not delete listing')
    }
  }

  // ── Order status update ──────────────────────────────────────
  const handleOrderStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Order marked as ${newStatus}`)
      fetchOrders()
    } catch {
      toast.error('Could not update order status')
    }
  }

  // ── AI recommendations ───────────────────────────────────────
  const fetchRecommendations = async () => {
    setAiLoading(true)
    try {
      const res = await getCropRecommendation(recForm)
      setRecData(res.data)
      toast.success('Crop recommendations ready!')
    } catch {
      toast.error('Failed to get recommendations')
    } finally { setAiLoading(false) }
  }

  // ════════════════════════════════════════════════════════════
  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-header flex justify-between">
        <div>
          <div className="page-title">👨‍🌾 Farmer Dashboard</div>
          <div className="page-subtitle">
            Welcome, {user?.full_name || 'Farmer'} — AI-powered insights by AgroMitra
          </div>
        </div>
        <div className="flex gap-8">
          <select className="form-select" style={{ width:140 }} value={crop}     onChange={e => setCrop(e.target.value)}>
            {CROPS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-select" style={{ width:140 }} value={district} onChange={e => setDistrict(e.target.value)}>
            {DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <button className="btn btn-primary" onClick={fetchAI} disabled={aiLoading}>
            {aiLoading ? '⏳' : '🔄'} Refresh AI
          </button>
        </div>
      </div>

      {/* ── Stats (live) ── */}
      <div className="stats-grid">
        {[
          { icon:'📦', label:'My Listings',    val: productsLoading ? '…' : activeListings,               change:'Active listings',         color:'#E8F5E9', border:'#2E7D32' },
          { icon:'🛒', label:'Pending Orders', val: ordersLoading   ? '…' : pendingOrders,                change:`${orders.length} total orders`, color:'#E3F2FD', border:'#1976D2' },
          { icon:'💰', label:'Total Earnings', val: ordersLoading   ? '…' : `৳${totalEarnings.toLocaleString()}`, change:'From delivered orders',  color:'#FFF3E0', border:'#E65100' },
          { icon:'⭐', label:'Trust Score',    val:'87/100',                                               change:'Verified ✅',              color:'#F3E5F5', border:'#6A1B9A' },
        ].map((s,i) => (
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

      {/* ── Tabs ── */}
      <div className="tabs">
        {[
          ['overview',  '📊 Overview'],
          ['price',     '🤖 Price AI'],
          ['demand',    '📈 Demand AI'],
          ['recommend', '🌱 Crop AI'],
          ['listings',  '📦 My Listings'],
          ['orders',    '🛒 Orders'],
        ].map(([k,v]) => (
          <div key={k} className={`tab ${activeTab===k?'active':''}`} onClick={() => setActiveTab(k)}>{v}</div>
        ))}
      </div>

      {/* ════ Overview Tab ════ */}
      {activeTab === 'overview' && (
        <div>
          <div className="ai-section">
            <div className="ai-section-title">🤖 AI Market Intelligence</div>
            <div className="ai-section-sub">
              {CROP_EMOJIS[crop] || '🌿'} {crop} in {district} — Prophet + XGBoost + LSTM
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16 }}>
              {priceData && [
                { label:'Current Price',  val:`৳${priceData.current_price}/kg`,                       icon:'💰' },
                { label:'7-Day Avg',      val:`৳${priceData.summary?.avg_7day_price}/kg`,             icon:'📊' },
                { label:'Market Outlook', val: priceData.summary?.market_outlook || '—',              icon:'📈' },
                { label:'Trend',          val:`${(priceData.summary?.trend_pct||0)>0?'↑':'↓'} ${Math.abs(priceData.summary?.trend_pct||0).toFixed(1)}%`, icon:'📉' },
              ].map((item,i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.12)', borderRadius:8, padding:16 }}>
                  <div style={{ fontSize:13, opacity:0.8 }}>{item.icon} {item.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, marginTop:4 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-title">💰 Price Forecast (7 Days)</div>
              {aiLoading
                ? <div className="spinner-box"><div className="spinner"/><span>Loading…</span></div>
                : <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={priceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                      <XAxis dataKey="date" tick={{ fontSize:12 }}/>
                      <YAxis tick={{ fontSize:12 }}/>
                      <Tooltip formatter={v => [`৳${v}`, 'Price']}/>
                      <Line type="monotone" dataKey="price" stroke="#2E7D32" strokeWidth={2.5} dot={{ r:4 }}/>
                      <Line type="monotone" dataKey="high"  stroke="#A5D6A7" strokeWidth={1} strokeDasharray="4 4" dot={false}/>
                      <Line type="monotone" dataKey="low"   stroke="#FFCC80" strokeWidth={1} strokeDasharray="4 4" dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
              }
            </div>
            <div className="card">
              <div className="card-title">📊 Demand Forecast (7 Days)</div>
              {aiLoading
                ? <div className="spinner-box"><div className="spinner"/><span>Loading…</span></div>
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={demandChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                      <XAxis dataKey="date" tick={{ fontSize:12 }}/>
                      <YAxis tick={{ fontSize:12 }}/>
                      <Tooltip formatter={v => [`${v} kg`, 'Demand']}/>
                      <Bar dataKey="demand" fill="#0a987e" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
              }
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
        <div className="grid-2">
          <div className="card">
            <div className="card-title">🤖 7-Day Price Forecast — {CROP_EMOJIS[crop]||'🌿'} {crop}</div>
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Predicted Price</th><th>Range</th><th>Trend</th></tr></thead>
                <tbody>
                  {priceData?.forecasts?.map((f,i) => (
                    <tr key={i}>
                      <td>{f.date}</td>
                      <td><strong style={{ color:'#2E7D32' }}>৳{f.predicted_price}/kg</strong></td>
                      <td style={{ color:'#546E7A', fontSize:13 }}>৳{f.lower_bound} – ৳{f.upper_bound}</td>
                      <td><span className={`badge ${f.trend?.includes('↑')?'badge-green':f.trend?.includes('↓')?'badge-orange':'badge-blue'}`}>{f.trend}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-title">📈 Price Trend Chart</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={priceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                <XAxis dataKey="date" tick={{ fontSize:11 }}/>
                <YAxis tick={{ fontSize:11 }}/>
                <Tooltip formatter={v => [`৳${v}/kg`, 'Price']}/>
                <Line type="monotone" dataKey="price" stroke="#2E7D32" strokeWidth={3} dot={{ r:5, fill:'#2E7D32' }}/>
                <Line type="monotone" dataKey="high"  stroke="#A5D6A7" strokeWidth={1.5} strokeDasharray="4 4" dot={false}/>
                <Line type="monotone" dataKey="low"   stroke="#FFCC80" strokeWidth={1.5} strokeDasharray="4 4" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
            {priceData && (
              <div className={`alert ${(priceData.summary?.trend_pct||0)>0?'alert-success':'alert-warning'} mt-16`}>
                📊 {priceData.summary?.market_outlook}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ Demand AI Tab ════ */}
      {activeTab === 'demand' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">📊 Demand Forecast Table</div>
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Predicted Demand</th><th>Range</th><th>Signal</th></tr></thead>
                <tbody>
                  {demandData?.forecasts?.map((f,i) => (
                    <tr key={i}>
                      <td>{f.date}</td>
                      <td><strong>{f.predicted_demand?.toLocaleString()} kg</strong></td>
                      <td style={{ color:'#546E7A', fontSize:13 }}>{f.lower_bound?.toLocaleString()} – {f.upper_bound?.toLocaleString()}</td>
                      <td><span className={`badge ${f.market_signal?.includes('High')?'badge-green':f.market_signal?.includes('Low')?'badge-red':'badge-blue'}`}>{f.market_signal}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-title">📈 Demand Chart</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={demandChartData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date" tick={{ fontSize:11 }}/>
                <YAxis tick={{ fontSize:11 }}/>
                <Tooltip formatter={v => [`${v} kg`, 'Demand']}/>
                <Bar dataKey="demand" fill="#1976D2" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            {demandData && (
              <div className="alert alert-info mt-16">
                💡 {demandData.summary?.farmer_advisory}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ Crop AI Tab ════ */}
      {activeTab === 'recommend' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">🌱 Your Farm Profile</div>
            {[
              ['farmer_name','Your Name','text'],
              ['land_acres','Land (acres)','number'],
              ['budget_bdt','Budget (৳)','number'],
            ].map(([field, label, type]) => (
              <div className="form-group" key={field}>
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} value={recForm[field]}
                  onChange={e => setRecForm({...recForm, [field]: type==='number' ? Number(e.target.value) : e.target.value})}/>
              </div>
            ))}
            {[
              ['district','District', DISTRICTS],
              ['soil_type','Soil Type',['Loam','Sandy Loam','Clay Loam','Clay']],
              ['experience','Experience',['Beginner','Intermediate','Expert']],
            ].map(([field, label, opts]) => (
              <div className="form-group" key={field}>
                <label className="form-label">{label}</label>
                <select className="form-select" value={recForm[field]} onChange={e => setRecForm({...recForm, [field]: e.target.value})}>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <button className="btn btn-primary btn-full" onClick={fetchRecommendations} disabled={aiLoading}>
              {aiLoading ? '⏳ Analyzing…' : '🌱 Get AI Recommendations'}
            </button>
          </div>
          <div>
            {recData ? (
              <div>
                <div className="alert alert-success mb-20">
                  🏆 Top Pick: <strong>{recData.top_pick?.crop}</strong> ({recData.top_pick?.name_bn}) — Score: {recData.top_pick?.score}/100
                </div>
                {recData.recommendations?.map((r,i) => (
                  <div key={i} className="rec-card mb-20">
                    <div className="flex justify-between flex-center">
                      <div>
                        <div className="rec-rank">#{r.rank}</div>
                        <div className="rec-crop">{CROP_EMOJIS[r.crop]||'🌿'} {r.crop}</div>
                        <div className="rec-crop-bn">{r.name_bn}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:28, fontWeight:800, color:'#2E7D32' }}>{r.score}</div>
                        <div style={{ fontSize:12, color:'#546E7A' }}>/ 100</div>
                      </div>
                    </div>
                    <div className="rec-score-bar">
                      <div className="rec-score-fill" style={{ width:`${r.score}%` }}/>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
                      <div>💰 Est. Profit: <strong style={{ color:'#2E7D32' }}>৳{r.est_profit_bdt?.toLocaleString()}</strong></div>
                      <div>⏱️ Duration: <strong>{r.grow_days} days</strong></div>
                      <div>⚠️ Risk: <span className={`badge ${r.risk_level==='Low'?'badge-green':r.risk_level==='Medium'?'badge-gold':'badge-red'}`}>{r.risk_level}</span></div>
                      <div>📊 Demand: <span className="badge badge-blue">{r.market_demand}</span></div>
                    </div>
                    <div className="alert alert-success mt-16" style={{ padding:'8px 12px', fontSize:13 }}>{r.advisory}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:64, marginBottom:16 }}>🌱</div>
                <div style={{ fontSize:18, fontWeight:600, color:'#546E7A' }}>Fill your profile and click</div>
                <div style={{ fontSize:15, color:'#9E9E9E', marginTop:8 }}>"Get AI Recommendations"</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ My Listings Tab ════ */}
      {activeTab === 'listings' && (
        <div>
          <div className="flex justify-between mb-20">
            <div className="section-title">📦 My Product Listings</div>
            <button className="btn btn-primary" onClick={openAddModal}>+ Add New Listing</button>
          </div>

          {productsLoading ? (
            <div className="spinner-box"><div className="spinner"/><span>Loading products…</span></div>
          ) : products.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
              <div style={{ fontSize:16, color:'#546E7A' }}>No listings yet</div>
              <button className="btn btn-primary mt-16" onClick={openAddModal}>+ Add Your First Listing</button>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Crop</th><th>Quantity</th><th>Price/kg</th>
                      <th>District</th><th>Organic</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.title_en}</strong>{p.title_bn && <div style={{fontSize:11,color:'#888'}}>{p.title_bn}</div>}</td>
                        <td>{p.quantity_kg?.toLocaleString()} kg</td>
                        <td style={{ color:'#2E7D32', fontWeight:600 }}>৳{p.unit_price_bdt}</td>
                        <td>{p.district}</td>
                        <td>{p.is_organic ? '✅ Yes' : '—'}</td>
                        <td>
                          <span className={`badge ${p.is_available!==false?'badge-green':'badge-orange'}`}>
                            {p.is_available!==false ? 'Active' : 'Unavailable'}
                          </span>
                        </td>
                        <td style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(p)}>Edit</button>
                          <button className="btn btn-sm" style={{ background:'#FFEBEE', color:'#C62828', border:'none' }}
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

      {/* ════ Orders Tab ════ */}
      {activeTab === 'orders' && (
        <div>
          <div className="flex justify-between mb-20">
            <div className="section-title">🛒 Incoming Orders</div>
            <button className="btn btn-secondary" onClick={fetchOrders}>🔄 Refresh</button>
          </div>

          {ordersLoading ? (
            <div className="spinner-box"><div className="spinner"/><span>Loading orders…</span></div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🛒</div>
              <div style={{ fontSize:16, color:'#546E7A' }}>No orders yet</div>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th><th>Crop</th><th>Qty</th>
                      <th>Total</th><th>Buyer</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.order_id}>
                        <td style={{ fontFamily:'monospace', fontSize:12 }}>#{o.order_id?.slice(-6)}</td>
                        <td><strong>🌿 {o.product_id?.slice(-6) || '—'}</strong></td>
                        <td>{o.quantity_kg} kg</td>
                        <td style={{ color:'#2E7D32', fontWeight:600 }}>৳{o.total_amount?.toLocaleString()}</td>
                        <td style={{ fontFamily:'monospace', fontSize:11 }}>{o.buyer_id?.slice(-6) || '—'}</td>
                        <td><span className={`badge ${orderBadge(o.status)}`}>{o.status}</span></td>
                        <td>
                          {o.status?.toLowerCase() === 'placed' && (
                            <div style={{ display:'flex', gap:6 }}>
                              <button className="btn btn-sm" style={{ background:'#E8F5E9', color:'#2E7D32', border:'none' }}
                                onClick={() => handleOrderStatus(o.order_id, 'confirmed')}>Confirm</button>
                              <button className="btn btn-sm" style={{ background:'#FFEBEE', color:'#C62828', border:'none' }}
                                onClick={() => handleOrderStatus(o.order_id, 'cancelled')}>Cancel</button>
                            </div>
                          )}
                          {o.status?.toLowerCase() === 'confirmed' && (
                            <button className="btn btn-sm" style={{ background:'#E3F2FD', color:'#1976D2', border:'none' }}
                              onClick={() => handleOrderStatus(o.order_id, 'shipped')}>Mark Shipped</button>
                          )}
                          {o.status?.toLowerCase() === 'shipped' && (
                            <button className="btn btn-sm" style={{ background:'#E8F5E9', color:'#2E7D32', border:'none' }}
                              onClick={() => handleOrderStatus(o.order_id, 'delivered')}>Mark Delivered</button>
                          )}
                          {['delivered','cancelled'].includes(o.status?.toLowerCase()) && (
                            <span style={{ color:'#9E9E9E', fontSize:12 }}>Done</span>
                          )}
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

      {/* ════ Add / Edit Product Modal ════ */}
      {showModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'#fff', borderRadius:12, padding:32,
            width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>
              {editingProduct ? '✏️ Edit Listing' : '➕ Add New Listing'}
            </div>

            {/* Title EN */}
            <div className="form-group">
              <label className="form-label">Product Title (English) *</label>
              <input className="form-input" type="text"
                value={productForm.title_en}
                onChange={e => setProductForm({...productForm, title_en: e.target.value})}
                placeholder="e.g. Fresh Tomato"/>
            </div>

            {/* Title BN */}
            <div className="form-group">
              <label className="form-label">Product Title (বাংলা)</label>
              <input className="form-input" type="text"
                value={productForm.title_bn}
                onChange={e => setProductForm({...productForm, title_bn: e.target.value})}
                placeholder="যেমন: তাজা টমেটো"/>
            </div>

            {/* Category + Grade */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={productForm.category}
                  onChange={e => setProductForm({...productForm, category: e.target.value})}>
                  {['Vegetable','Fruit','Grain','Spice','Root'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quality Grade</label>
                <select className="form-select" value={productForm.quality_grade}
                  onChange={e => setProductForm({...productForm, quality_grade: e.target.value})}>
                  {['A','B','C'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Quantity + Price */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Quantity (kg) *</label>
                <input className="form-input" type="number" min="1"
                  value={productForm.quantity_kg}
                  onChange={e => setProductForm({...productForm, quantity_kg: e.target.value})}
                  placeholder="e.g. 500"/>
              </div>
              <div className="form-group">
                <label className="form-label">Price per kg (৳) *</label>
                <input className="form-input" type="number" min="1"
                  value={productForm.unit_price_bdt}
                  onChange={e => setProductForm({...productForm, unit_price_bdt: e.target.value})}
                  placeholder="e.g. 22"/>
              </div>
            </div>

            {/* District */}
            <div className="form-group">
              <label className="form-label">District</label>
              <select className="form-select" value={productForm.district}
                onChange={e => setProductForm({...productForm, district: e.target.value})}>
                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={3} style={{ resize:'vertical' }}
                value={productForm.description_en}
                onChange={e => setProductForm({...productForm, description_en: e.target.value})}
                placeholder="Fresh from farm, pesticide-free…"/>
            </div>

            {/* Organic checkbox */}
            <div className="form-group" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" id="is_organic" checked={productForm.is_organic}
                onChange={e => setProductForm({...productForm, is_organic: e.target.checked})}/>
              <label htmlFor="is_organic" style={{ marginBottom:0, cursor:'pointer' }}>
                🌿 Organic product
              </label>
            </div>

            {/* Buttons */}
            <div style={{ display:'flex', gap:12, marginTop:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }}
                onClick={handleSaveProduct} disabled={savingProduct}>
                {savingProduct ? '⏳ Saving…' : editingProduct ? '✅ Update Listing' : '➕ Add Listing'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
