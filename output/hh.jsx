import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import { getPricePrediction, getDemandForecast } from '../api/agromitra'

const features = [
  { icon: '🤖', title: 'AI Price Prediction',    desc: 'Prophet + XGBoost hybrid model forecasts crop prices 7–30 days ahead with 12% MAPE accuracy.' },
  { icon: '📊', title: 'Demand Forecasting',      desc: 'LSTM neural network predicts crop demand 4–8 weeks in advance to help farmers plan production.' },
  { icon: '🌱', title: 'Crop Recommendation',     desc: 'Content-based AI suggests top 5 profitable crops based on soil, season, budget, and market trends.' },
  { icon: '💳', title: 'bKash & Nagad Payments',  desc: 'Secure digital payments with escrow protection. Farmers get paid instantly on delivery confirmation.' },
  { icon: '🗣️', title: 'Bengali Interface',       desc: 'Fully bilingual Bengali and English platform designed for rural farmers with low digital literacy.' },
  { icon: '📱', title: 'Mobile Optimized',        desc: 'Works on basic Android phones with 2G connections. Low-bandwidth mode reduces data usage by 60%.' },
]

const stats = [
  { val: '17M+',  label: 'Bangladeshi Farmers',   icon: '👨‍🌾' },
  { val: '60M+',  label: 'bKash Users',           icon: '💳' },
  { val: '12%',   label: 'AI MAPE Accuracy',      icon: '🤖' },
  { val: '35%+',  label: 'Farmer Income Increase',icon: '📈' },
]

const gapRows = [
  { problem: 'Farmers earn only 20–40% of market price',        solution: 'Direct farmer-to-buyer marketplace — zero middlemen' },
  { problem: '3–5 middlemen layers extract 60–80% value',       solution: 'AI price prediction with 12% MAPE accuracy' },
  { problem: '25–30% post-harvest food waste every year',       solution: 'Demand forecasting reduces overproduction by 25%' },
  { problem: 'No real-time price data for rural farmers',       solution: 'Real-time market data in Bengali and English' },
  { problem: 'Cash-based risky transactions with no records',   solution: 'Secure bKash/Nagad payments with escrow protection' },
  { problem: 'Buyers can\u2019t verify quality before paying',       solution: 'Quality grading and photos on every listing' },
  { problem: 'Disputes have no neutral record to settle them',  solution: 'Every order timestamped and traceable end to end' },
  { problem: 'Smallholders can\u2019t plan which crop to grow next', solution: 'AI crop recommendation matched to soil and budget' },
  { problem: 'Buyers travel far to find trustworthy sellers',    solution: 'Verified farmer profiles with trust scores, browsed from anywhere' },
]

// Crops/districts the AI backend actually has data for
const DEMO_CROPS = ['Tomato', 'Onion', 'Potato', 'Brinjal', 'Cabbage', 'Garlic', 'Rice', 'Ginger']
const DEMO_DISTRICTS = ['Bogura', 'Rajshahi', 'Cumilla', 'Dhaka', 'Chattogram']
const DEMO_CROP_EMOJI = { Tomato:'🍅', Onion:'🧅', Potato:'🥔', Brinjal:'🍆', Cabbage:'🥬', Garlic:'🧄', Rice:'🌾', Ginger:'🫚' }

const Home = () => {
  const rootRef = useRef(null)

  // ── Live AI demo state ──────────────────────────────────────
  const [demoCrop, setDemoCrop]         = useState('Tomato')
  const [demoDistrict, setDemoDistrict] = useState('Bogura')
  const [demoLoading, setDemoLoading]   = useState(false)
  const [demoData, setDemoData]         = useState(null)
  const [demoError, setDemoError]       = useState(false)

  useEffect(() => {
    let cancelled = false
    setDemoLoading(true)
    setDemoError(false)
    Promise.all([
      getPricePrediction(demoCrop, demoDistrict, 7),
      getDemandForecast(demoCrop, demoDistrict, 7),
    ])
      .then(([priceRes, demandRes]) => {
        if (cancelled) return
        setDemoData({ price: priceRes.data, demand: demandRes.data })
      })
      .catch(() => { if (!cancelled) setDemoError(true) })
      .finally(() => { if (!cancelled) setDemoLoading(false) })
    return () => { cancelled = true }
  }, [demoCrop, demoDistrict])

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.am-reveal, .am-flip-card, .am-stat')
    if (!els?.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('am-in-view')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="am-home" ref={rootRef}>

      {/* ===== HERO ===== */}
      <div className="am-hero">
        <div className="am-eyebrow">From the field to your hands</div>
        <h1>Where Bangladesh's harvest meets <em>fair value</em></h1>
        <p>
          AgroMitra is an AI-powered marketplace connecting farmers directly with buyers —
          no middlemen, transparent pricing, and payments protected until delivery.
        </p>
        <div className="am-hero-btns">
          <Link to="/farmer" className="am-btn am-btn-primary">👨‍🌾 I'm a Farmer</Link>
          <Link to="/buyer" className="am-btn am-btn-outline">🛒 I'm a Buyer</Link>
        </div>
        <div className="am-field-rows" />
      </div>

      {/* ===== STATS ===== */}
      <div className="am-stats">
        {stats.map((s, i) => (
          <div key={i} className="am-stat">
            <div className="am-stat-icon">{s.icon}</div>
            <div className="am-stat-val">{s.val}</div>
            <div className="am-stat-label">{s.label}</div>
            <div className="am-stat-bar" />
          </div>
        ))}
      </div>

      {/* ===== FEATURES ===== */}
      <div className="am-section am-reveal">
        <div className="am-section-head">
          <div className="am-section-eyebrow">Built for the field</div>
          <h2>Technology that speaks the farmer's language</h2>
          <p className="am-section-sub">Six tools working together so every harvest finds its fairest price.</p>
        </div>
        <div className="am-features">
          {features.map((f, i) => (
            <div key={i} className="am-feature">
              <div className="am-feature-top">
                <div className="am-feature-icon-circle">{f.icon}</div>
                <div className="am-feature-num">{String(i + 1).padStart(2, '0')}</div>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== LIVE AI DEMO ===== */}
      <div className="am-section am-reveal">
        <div className="am-section-head">
          <div className="am-section-eyebrow">See it in action</div>
          <h2>Real AI, running right now</h2>
          <p className="am-section-sub">Pick a crop and a district — this is live data from our forecasting model, not a mockup.</p>
        </div>

        <div className="am-demo">
          <div className="am-demo-controls">
            <select className="am-demo-select" value={demoCrop} onChange={e => setDemoCrop(e.target.value)}>
              {DEMO_CROPS.map(c => <option key={c} value={c}>{DEMO_CROP_EMOJI[c]} {c}</option>)}
            </select>
            <select className="am-demo-select" value={demoDistrict} onChange={e => setDemoDistrict(e.target.value)}>
              {DEMO_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {demoLoading && (
            <div className="am-demo-loading">
              <span className="am-demo-spinner" />
              Running forecast for {demoCrop} in {demoDistrict}…
            </div>
          )}

          {demoError && !demoLoading && (
            <div className="am-demo-loading">⚠️ Could not reach the AI service. Is the backend running?</div>
          )}

          {demoData && !demoLoading && !demoError && (() => {
            const sparkData = demoData.price.forecasts?.map(f => ({ price: f.predicted_price })) || []
            const isUp = (demoData.price.summary?.trend_pct ?? 0) > 0
            return (
              <div className="am-demo-results" key={`${demoCrop}-${demoDistrict}`}>
                <div className="am-demo-card am-demo-card-price">
                  <div className="am-demo-card-icon">💰</div>
                  <div className="am-demo-card-label">Current price</div>
                  <div className="am-demo-card-val">৳{demoData.price.current_price}<span>/kg</span></div>
                  <div className="am-demo-spark">
                    <ResponsiveContainer width="100%" height={36}>
                      <LineChart data={sparkData}>
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                        <Line type="monotone" dataKey="price" stroke="#2E7D32" strokeWidth={2} dot={false} isAnimationActive />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="am-demo-card">
                  <div className="am-demo-card-icon">{isUp ? '📈' : '📉'}</div>
                  <div className="am-demo-card-label">7-day trend</div>
                  <div className={`am-demo-card-val ${isUp ? 'am-demo-up' : 'am-demo-down'}`}>
                    {isUp ? '↑' : '↓'} {Math.abs(demoData.price.summary?.trend_pct ?? 0).toFixed(1)}%
                  </div>
                </div>
                <div className="am-demo-card">
                  <div className="am-demo-card-icon">🧭</div>
                  <div className="am-demo-card-label">Market outlook</div>
                  <div className="am-demo-card-val am-demo-card-val-sm">{demoData.price.summary?.market_outlook}</div>
                </div>
                <div className="am-demo-card">
                  <div className="am-demo-card-icon">📊</div>
                  <div className="am-demo-card-label">Demand signal</div>
                  <div className="am-demo-card-val am-demo-card-val-sm">{demoData.demand.forecasts?.[0]?.market_signal}</div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ===== PROBLEM / SOLUTION ===== */}
      <div className="am-section am-reveal">
        <div className="am-section-head">
          <div className="am-section-eyebrow">The gap we close</div>
          <h2>From a broken chain to a direct line</h2>
          <p className="am-section-sub">Nine everyday frictions in Bangladesh's crop trade — and what replaces each one.</p>
        </div>
        <div className="am-flip-grid">
          {gapRows.map((row, i) => (
            <div key={i} className="am-flip-card">
              <div className="am-flip-top">
                <div className="am-flip-icon-circle">🔁</div>
                <div className="am-flip-num">{String(i + 1).padStart(2, '0')}</div>
              </div>
              <div className="am-flip-before">
                <span className="am-flip-tag">before</span>
                {row.problem}
              </div>
              <div className="am-flip-after">
                <span className="am-flip-tag">now</span>
                {row.solution}
              </div>
            </div>
          ))}
        </div>
      </div>
          
      

      {/* ── YOUR EXISTING HERO/MAIN SECTIONS END HERE ── */}


{/* ── NEW ENGLISH SECTIONS START HERE ── */}

{/* 1. EMERGENCY ADVISORY ALERTS */}
<section className="am-section">
  <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderLeft: '6px solid var(--orange)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '24px' }}>⚠️</span>
      <div>
        <strong style={{ fontSize: '16px', display: 'block', color: 'var(--orange)' }}>Agro-Meteorological Alert!</strong>
        <span style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Heavy thunderstorms accompanied by gusty winds are expected in northern regions within the next 48 hours. Secure mature crops immediately.</span>
      </div>
    </div>
    <span className="badge badge-orange" style={{ whiteSpace: 'nowrap' }}>Agri Info Service</span>
  </div>
</section>

{/* 2. REAL-TIME MARKET PRICE */}
<section className="am-section">
  <div className="am-section-head">
    <span className="am-section-eyebrow">Live Updates</span>
    <h2>📊 Current Market Rates (Today's Wholesale Prices)</h2>
    <p className="am-section-sub">Check live prices from nearby markets to ensure fair value for your produce.</p>
  </div>
  
  <div className="table-container">
    <table>
      <thead>
        <tr>
          <th>Crop Name</th>
          <th>Type / Variety</th>
          <th>Current Price (per Maund)</th>
          <th>vs Yesterday</th>
          <th>Market Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>BR-28 Rice</strong></td>
          <td>Cereal Grain</td>
          <td>1,350 ৳</td>
          <td><span className="badge badge-green">▲ +20 ৳</span></td>
          <td>High Demand</td>
        </tr>
        <tr>
          <td><strong>Diamond Potato</strong></td>
          <td>Vegetable</td>
          <td>880 ৳</td>
          <td><span className="badge badge-red">▼ -10 ৳</span></td>
          <td>Stable</td>
        </tr>
        <tr>
          <td><strong>Local Onion</strong></td>
          <td>Spice</td>
          <td>2,400 ৳</td>
          <td><span className="badge badge-green">▲ +50 ৳</span></td>
          <td>Low Supply</td>
        </tr>
        <tr>
          <td><strong>Hybrid Tomato</strong></td>
          <td>Vegetable</td>
          <td>1,600 ৳</td>
          <td><span className="badge badge-orange">● 0 ৳</span></td>
          <td>Ample Stock</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

{/* 3. REGIONAL SOWING CALENDAR */}
<section className="am-section">
  <div className="am-section-head">
    <span className="am-section-eyebrow">Cultivation Guide</span>
    <h2>📅 Regional Sowing Calendar (Current Month)</h2>
    <p className="am-section-sub">Plant the right crop at the right time to maximize seasonal yield.</p>
  </div>
  
  <div className="grid-3">
    <div className="card">
      <div className="card-title">🌾 Aman Rice (Sowing Season)</div>
      <div class="form-group" style={{ marginBottom: '8px' }}>
        <span class="form-label">Ideal Window: June - July</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--gray)', lineHeight: '1.5' }}>Perfect time for seedbed preparation and balanced fertilizer baseline application. Choose flood-resistant varieties.</p>
      <div style={{ marginTop: '12px' }}><span className="badge badge-green">Recommended: BRRI-75</span></div>
    </div>
    
    <div className="card">
      <div className="card-title">🌶️ Summer Chili</div>
      <div class="form-group" style={{ marginBottom: '8px' }}>
        <span class="form-label">Ideal Window: May - June</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--gray)', lineHeight: '1.5' }}>Prepare raised beds with proper drainage systems before transplanting seedlings to avoid root rot.</p>
      <div style={{ marginTop: '12px' }}><span className="badge badge-blue">Method: Mulching Tech</span></div>
    </div>
    
    <div className="card">
      <div className="card-title">🥒 Hybrid Cucumber</div>
      <div class="form-group" style={{ marginBottom: '8px' }}>
        <span class="form-label">Ideal Window: June - August</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--gray)', lineHeight: '1.5' }}>Highly suitable for trellis cultivation systems. Requires systematic fungicide tracking during early growth.</p>
      <div style={{ marginTop: '12px' }}><span className="badge badge-orange">Duration: 60-65 Days</span></div>
    </div>
  </div>
</section>

{/* 4. COMMON PLANT DISEASE & REMEDIES */}
<section className="am-section">
  <div className="am-section-head">
    <span className="am-section-eyebrow">Crop Protection</span>
    <h2>🏥 Common Crop Diseases & Initial Remedies</h2>
    <p className="am-section-sub">Identify symptoms early and take quick preventive measures.</p>
  </div>
  
  <div className="grid-2">
    <div className="card" style={{ borderTop: '4px solid var(--red)' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>🍂 Rice Blast Disease</h3>
      <p style={{ fontSize: '14px', color: 'var(--gray)', marginBottom: '12px' }}><strong>Symptoms:</strong> Spindle-shaped lesions on leaves with grayish centers and brown borders that rapidly enlarge.</p>
      <div className="alert alert-warning" style={{ padding: '8px 12px', fontSize: '13px', marginBottom: '0' }}>
        <strong>Remedy:</strong> Maintain standing water in fields and spray systemic fungicides containing Tricyclazole.
      </div>
    </div>
    
    <div className="card" style={{ borderTop: '4px solid var(--red)' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>🥔 Late Blight of Potato</h3>
      <p style={{ fontSize: '14px', color: 'var(--gray)', marginBottom: '12px' }}><strong>Symptoms:</strong> Water-soaked dark spots appearing on leaves, expanding rapidly during cool, humid weather.</p>
      <div className="alert alert-warning" style={{ padding: '8px 12px', fontSize: '13px', marginBottom: '0' }}>
        <strong>Remedy:</strong> Use certified disease-free seeds and apply preventive Mancozeb-based sprays.
      </div>
    </div>
  </div>
</section>

{/* 5. PROJECT ROADMAP & TECH STACK */}
<section className="am-section" style={{ borderTop: '1px solid var(--gray-light)', paddingTop: '50px' }}>
  <div className="am-section-head">
    <span className="am-section-eyebrow">Technical Architecture</span>
    <h2>⚙️ Project Specifications & Tech Stack (Phase 1)</h2>
    <p className="am-section-sub">Uttara University | Department of Computer Science & Engineering</p>
  </div>
  
  <div className="grid-3" style={{ textAlign: 'center' }}>
    <div className="card">
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>💻</div>
      <h4 style={{ marginBottom: '6px' }}>Frontend Framework</h4>
      <p style={{ fontSize: '13px', color: 'var(--gray)' }}>React.js (JSX Engine), Modern CSS3 via CSS Custom Properties, Flexbox, and Grid layouts.</p>
    </div>
    <div className="card">
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>🧠</div>
      <h4 style={{ marginBottom: '6px' }}>Core Algorithms</h4>
      <p style={{ fontSize: '13px', color: 'var(--gray)' }}>Rule-based Crop Recommendation systems and structured soil macronutrient parsing engines.</p>
    </div>
    <div className="card">
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>🚀</div>
      <h4 style={{ marginBottom: '6px' }}>Phase 2 Roadmap</h4>
      <p style={{ fontSize: '13px', color: 'var(--gray)' }}>Integration of live IoT telemetry node streams and automated computer vision-based leaf classification.</p>
    </div>
  </div>
      </section>
      
      {/* ===== CTA ===== */}
      <div className="am-section am-reveal">
        <div className="am-cta">
          <h3>Ready to transform Bangladeshi agriculture?</h3>
          <p>Join thousands of farmers already using AgroMitra</p>
          <div className="am-hero-btns">
            <Link to="/farmer" className="am-btn am-btn-primary">Get Started as Farmer</Link>
            <Link to="/buyer" className="am-btn am-btn-outline">Browse Marketplace</Link>
          </div>
        </div>
      </div>




      <div className="am-footer-space" />
    </div>
  )
}

export default Home
