// ============================================================
//   AgroMitra API Service
//   FastAPI backend calls
// ============================================================

import axios from 'axios'

const API = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('agromitra_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth Session Helpers ─────────────────────────────────────
export const saveAuthSession = ({ access_token, refresh_token, user }) => {
  localStorage.setItem('agromitra_access_token', access_token)
  localStorage.setItem('agromitra_refresh_token', refresh_token)
  localStorage.setItem('agromitra_user', JSON.stringify(user))
  window.dispatchEvent(new Event('agromitra-auth-changed'))
}

export const clearAuthSession = () => {
  localStorage.removeItem('agromitra_access_token')
  localStorage.removeItem('agromitra_refresh_token')
  localStorage.removeItem('agromitra_user')
  window.dispatchEvent(new Event('agromitra-auth-changed'))
}

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('agromitra_user'))
  } catch {
    return null
  }
}

// ── Auth ─────────────────────────────────────────────────────
export const loginUser      = (credentials) => API.post('/api/v1/auth/login', credentials)
export const registerUser   = (payload)     => API.post('/api/v1/auth/register', payload)
export const getCurrentUser = ()            => API.get('/api/v1/auth/me')

// ── Products ─────────────────────────────────────────────────
export const getMyProducts    = ()           => API.get('/api/v1/products/my')
export const getAllProducts    = (params)     => API.get('/api/v1/products/', { params })
export const getProduct        = (id)         => API.get(`/api/v1/products/${id}`)
export const createProduct     = (data)       => API.post('/api/v1/products/', data)
export const updateProduct     = (id, data)   => API.put(`/api/v1/products/${id}`, data)
export const deleteProduct     = (id)         => API.delete(`/api/v1/products/${id}`)

// ── Orders ───────────────────────────────────────────────────
export const getMyOrders       = ()           => API.get('/api/v1/orders/')
export const getOrder          = (id)         => API.get(`/api/v1/orders/${id}`)
export const placeOrder        = (data)       => API.post('/api/v1/orders/', data)
export const cancelOrder       = (id)         => API.delete(`/api/v1/orders/${id}`)
export const updateOrderStatus = (id, status) => API.put(`/api/v1/orders/${id}/status`, { status })
export const getAllOrders       = ()           => API.get('/api/v1/orders/admin/all')

// ── AI ───────────────────────────────────────────────────────
export const getPricePrediction    = (cropName, district, days = 7) =>
  API.post('/api/v1/ai/price-prediction', { crop_name: cropName, district, days })

export const getDemandForecast     = (cropName, district, days = 7) =>
  API.post('/api/v1/ai/demand-forecast', { crop_name: cropName, district, days })

export const getCropRecommendation = (profile) =>
  API.post('/api/v1/ai/crop-recommendation', profile)

export const getFairPrice          = (cropName, district) =>
  API.get('/api/v1/ai/fair-price', { params: { crop_name: cropName, district } })

// ── Market ───────────────────────────────────────────────────
export const getMarketPrices = (cropName = null, district = null) => {
  const params = {}
  if (cropName) params.crop_name = cropName
  if (district) params.district  = district
  return API.get('/api/v1/market/prices', { params })
}

// ── Misc ─────────────────────────────────────────────────────
export const getCrops     = () => API.get('/api/v1/crops')
export const getDistricts = () => API.get('/api/v1/districts')
export const getHealth    = () => API.get('/health')

// ── Admin ────────────────────────────────────────────────────
export const getAllUsers      = (params)            => API.get('/api/v1/auth/admin/users', { params })
export const updateUserStatus = (userId, isActive)  =>
  API.put(`/api/v1/auth/admin/users/${userId}/status`, null, { params: { is_active: isActive } })
export const verifyUser       = (userId)            => API.put(`/api/v1/auth/admin/users/${userId}/verify`)

// ── Weather & Calendar ───────────────────────────────────────
export const getWeatherAlert   = (district)  => API.get('/api/v1/weather/alert', { params: { district } })
export const getSowingCalendar = (month)     => API.get('/api/v1/crops/sowing-calendar', { params: month ? { month } : {} })

export default API
