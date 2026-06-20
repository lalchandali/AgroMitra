import { useState, useEffect, useCallback } from 'react'
import { getHealth, getAllOrders, getAllUsers, updateUserStatus, verifyUser } from '../api/agromitra'
import toast from 'react-hot-toast'

const orderBadge = (status) => {
  const map = {
    placed:    'badge-gold',
    confirmed: 'badge-blue',
    ready:     'badge-blue',
    dispatched:'badge-blue',
    delivered: 'badge-green',
    cancelled: 'badge-red',
  }
  return map[status?.toLowerCase()] || 'badge-blue'
}

const roleBadge = (role) => {
  const map = { farmer: 'badge-green', buyer: 'badge-blue', consumer: 'badge-gold', admin: 'badge-red' }
  return map[role] || 'badge-blue'
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview')
  const [apiStatus, setApiStatus] = useState(null)

  // ── Users state ──────────────────────────────────────────────
  const [users, setUsers]               = useState([])
  const [usersLoading, setUsersLoading]  = useState(false)
  const [userSearch, setUserSearch]      = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')

  // ── Orders state ─────────────────────────────────────────────
  const [orders, setOrders]              = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  useEffect(() => {
    getHealth().then(r => setApiStatus(r.data)).catch(() => setApiStatus({ status:'offline' }))
  }, [])

  // ── Fetch users ──────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const params = {}
      if (userRoleFilter) params.role = userRoleFilter
      if (userSearch) params.search = userSearch
      const res = await getAllUsers(params)
      setUsers(res.data || [])
    } catch {
      toast.error('Could not load users — admin access required')
    } finally { setUsersLoading(false) }
  }, [userRoleFilter, userSearch])

  // ── Fetch orders ─────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await getAllOrders()
      setOrders(res.data || [])
    } catch {
      toast.error('Could not load orders — admin access required')
    } finally { setOrdersLoading(false) }
  }, [])

  useEffect(() => { if (activeTab === 'users')  fetchUsers() },  [activeTab, fetchUsers])
  useEffect(() => { if (activeTab === 'orders') { fetchOrders(); fetchUsers() } }, [activeTab, fetchOrders, fetchUsers])
  useEffect(() => { if (activeTab === 'overview') fetchOrders() }, [activeTab, fetchOrders])

  // ── User actions ─────────────────────────────────────────────
  const handleToggleStatus = async (user) => {
    try {
      await updateUserStatus(user.user_id, !user.is_active)
      toast.success(user.is_active ? 'User suspended' : 'User activated')
      fetchUsers()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not update status')
    }
  }

  const handleVerify = async (user) => {
    try {
      await verifyUser(user.user_id)
      toast.success('User verified!')
      fetchUsers()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not verify user')
    }
  }

  // ── Derived stats (real where possible) ─────────────────────
  const totalFarmers  = users.filter(u => u.role === 'farmer').length
  const totalBuyers   = users.filter(u => u.role === 'buyer' || u.role === 'consumer').length
  const totalRevenue  = orders
    .filter(o => o.payment_status === 'released')
    .reduce((sum, o) => sum + (o.platform_fee || 0), 0)
  const completedOrders = orders.filter(o => o.status === 'delivered').length
  const completionRate  = orders.length ? ((completedOrders / orders.length) * 100).toFixed(1) : 0

  // ── user_id → name lookup, for showing readable names in Orders table ──
  const userMap = {}
  users.forEach(u => { userMap[u.user_id] = u })
  const nameFor = (userId) => userMap[userId]?.name_en || null

  return (
    <div className="page">
      <div className="page-header flex justify-between">
        <div>
          <div className="page-title">⚙️ Admin Panel</div>
          <div className="page-subtitle">AgroMitra Platform Management — Uttara University</div>
        </div>
        <div className="flex gap-8 flex-center">
          <span className={`badge ${apiStatus?.status === 'healthy' ? 'badge-green' : 'badge-red'}`}>
            {apiStatus?.status === 'healthy' ? '🟢 API Online' : '🔴 API Offline'}
          </span>
          <span style={{ fontSize:13, color:'#546E7A' }}>{apiStatus?.timestamp?.slice(0,19)}</span>
        </div>
      </div>

      {/* Stats — real counts where data is loaded */}
      <div className="stats-grid">
        {[
          { icon:'👨‍🌾', label:'Total Farmers',    val: users.length ? totalFarmers : '…',    color:'#E8F5E9', border:'#2E7D32' },
          { icon:'🛒',   label:'Total Buyers',     val: users.length ? totalBuyers : '…',     color:'#E3F2FD', border:'#1976D2' },
          { icon:'📦',   label:'Total Orders',     val: orders.length || (ordersLoading ? '…' : 0), color:'#FFF3E0', border:'#E65100' },
          { icon:'💰',   label:'Platform Fees',    val: `৳${totalRevenue.toLocaleString()}`,  color:'#F3E5F5', border:'#6A1B9A' },
          { icon:'✅',   label:'Completed Orders', val: completedOrders,                       color:'#FFFDE7', border:'#F9A825' },
          { icon:'📊',   label:'Completion Rate',  val: `${completionRate}%`,                  color:'#E0F2F1', border:'#00695C' },
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{ borderLeftColor: s.border }}>
            <div className="stat-icon" style={{ background: s.color, fontSize:24 }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['overview','📊 Overview'],['users','👥 Users'],['orders','📦 Orders'],['api','🤖 AI API']].map(([k,v]) => (
          <div key={k} className={`tab ${activeTab===k?'active':''}`} onClick={() => setActiveTab(k)}>{v}</div>
        ))}
      </div>

      {/* ════ Overview Tab ════ */}
      {activeTab === 'overview' && (
        <div>
          <div className="card">
            <div className="card-title">📦 Recent Orders (Live)</div>
            {ordersLoading ? (
              <div className="spinner-box"><div className="spinner"/><span>Loading…</span></div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign:'center', padding:30, color:'#9E9E9E' }}>No orders yet</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
                  <tbody>
                    {orders.slice(0, 8).map(o => (
                      <tr key={o.order_id}>
                        <td style={{ fontFamily:'monospace', fontSize:12 }}>#{o.order_id?.slice(-6)}</td>
                        <td style={{ color:'#2E7D32', fontWeight:600 }}>৳{o.total_amount?.toLocaleString()}</td>
                        <td><span className={`badge ${orderBadge(o.status)}`}>{o.status}</span></td>
                        <td><span className={`badge ${o.payment_status==='released'?'badge-green':o.payment_status==='refunded'?'badge-red':'badge-gold'}`}>{o.payment_status}</span></td>
                        <td style={{ color:'#546E7A', fontSize:13 }}>{o.created_at?.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mt-20">
            <div className="card-title">🤖 AI Model Status</div>
            {[
              { name:'Price Prediction API',    status:'Healthy', color:'#2E7D32' },
              { name:'Demand Forecasting API',  status:'Healthy', color:'#2E7D32' },
              { name:'Crop Recommendation API', status:'Healthy', color:'#2E7D32' },
              { name:'FastAPI Server', status: apiStatus?.status === 'healthy' ? 'Online' : 'Offline', color: apiStatus?.status === 'healthy' ? '#2E7D32' : '#C62828' },
            ].map((m,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #F5F5F5' }}>
                <span style={{ fontSize:14 }}>{m.name}</span>
                <span className="badge" style={{ background: m.color+'22', color: m.color }}>● {m.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ Users Tab ════ */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="flex justify-between mb-20" style={{ flexWrap:'wrap', gap:12 }}>
            <div className="section-title">👥 User Management</div>
            <div className="flex gap-8">
              <input
                className="form-input" style={{ width:220 }}
                placeholder="🔍 Search name or mobile..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchUsers()}
              />
              <select className="form-select" style={{ width:140 }} value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="farmer">Farmer</option>
                <option value="buyer">Buyer</option>
                <option value="consumer">Consumer</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={fetchUsers}>Search</button>
            </div>
          </div>

          {usersLoading ? (
            <div className="spinner-box"><div className="spinner"/><span>Loading users…</span></div>
          ) : users.length === 0 ? (
            <div style={{ textAlign:'center', padding:30, color:'#9E9E9E' }}>No users found</div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>District</th><th>Verified</th><th>Trust</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id}>
                      <td><strong>{u.name_en}</strong>{u.name_bn && <div style={{ fontSize:11, color:'#888' }}>{u.name_bn}</div>}</td>
                      <td style={{ color:'#546E7A' }}>{u.mobile_number}</td>
                      <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                      <td>{u.district || '—'}</td>
                      <td>{u.is_verified ? '✅ Verified' : '⏳ Pending'}</td>
                      <td>{u.trust_score}/100</td>
                      <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Suspended'}</span></td>
                      <td>
                        <div className="flex gap-8">
                          {!u.is_verified && (
                            <button className="btn btn-sm btn-secondary" onClick={() => handleVerify(u)}>✅ Verify</button>
                          )}
                          <button
                            className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.is_active ? '🚫 Suspend' : '✅ Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════ Orders Tab ════ */}
      {activeTab === 'orders' && (
        <div className="card">
          <div className="flex justify-between mb-20">
            <div className="section-title">📦 All Orders</div>
            <button className="btn btn-secondary" onClick={fetchOrders}>🔄 Refresh</button>
          </div>
          {ordersLoading ? (
            <div className="spinner-box"><div className="spinner"/><span>Loading orders…</span></div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign:'center', padding:30, color:'#9E9E9E' }}>No orders yet</div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Order ID</th><th>Farmer</th><th>Buyer</th><th>Qty</th><th>Amount</th><th>Platform Fee</th><th>Status</th><th>Payment</th><th>Delivery</th><th>Date</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.order_id}>
                      <td style={{ fontFamily:'monospace', fontSize:12 }}>#{o.order_id?.slice(-6)}</td>
                      <td style={{ fontSize:13 }}>{nameFor(o.farmer_id) || <span style={{ fontFamily:'monospace', color:'#9E9E9E' }}>#{o.farmer_id?.slice(-6)}</span>}</td>
                      <td style={{ fontSize:13 }}>{nameFor(o.buyer_id) || <span style={{ fontFamily:'monospace', color:'#9E9E9E' }}>#{o.buyer_id?.slice(-6)}</span>}</td>
                      <td>{o.quantity_kg} kg</td>
                      <td style={{ color:'#2E7D32', fontWeight:600 }}>৳{o.total_amount?.toLocaleString()}</td>
                      <td style={{ color:'#546E7A' }}>৳{o.platform_fee?.toLocaleString()}</td>
                      <td><span className={`badge ${orderBadge(o.status)}`}>{o.status}</span></td>
                      <td><span className={`badge ${o.payment_status==='released'?'badge-green':o.payment_status==='refunded'?'badge-red':'badge-gold'}`}>{o.payment_status}</span></td>
                      <td style={{ fontSize:13 }}>
                        <span className="badge badge-blue" style={{ textTransform:'capitalize' }}>{o.delivery_type}</span>
                        {o.delivery_address && (
                          <div style={{ color:'#9E9E9E', fontSize:11, marginTop:3, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={o.delivery_address}>
                            📍 {o.delivery_address}
                          </div>
                        )}
                      </td>
                      <td style={{ color:'#546E7A', fontSize:13 }}>{o.created_at?.slice(0,10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════ AI API Tab ════ */}
      {activeTab === 'api' && (
        <div>
          <div className="ai-section mb-20">
            <div className="ai-section-title">🤖 AI API Status</div>
            <div className="ai-section-sub">FastAPI Server running on localhost:8000</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
              {Object.entries(apiStatus?.models || {}).map(([k,v],i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.1)', borderRadius:8, padding:14 }}>
                  <div style={{ fontSize:12, opacity:0.8, marginBottom:4 }}>{k.replace(/_/g,' ')}</div>
                  <div style={{ fontWeight:600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title">🗄️ Database</div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F5F5F5' }}>
              <span>Enabled</span>
              <span className={`badge ${apiStatus?.database?.enabled ? 'badge-green' : 'badge-red'}`}>
                {apiStatus?.database?.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0' }}>
              <span>Connection Status</span>
              <span className={`badge ${apiStatus?.database?.status === 'connected' ? 'badge-green' : 'badge-red'}`}>
                {apiStatus?.database?.status || 'unknown'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
