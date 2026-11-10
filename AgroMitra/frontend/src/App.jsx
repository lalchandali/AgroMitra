import { Component, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import { useLanguage } from './hooks/useLanguage'
import { tr } from './translations'
import { getStoredUser } from './api/agromitra'
import './index.css'

const Home = lazy(() => import('./pages/Home.jsx'))
const FarmerDashboard = lazy(() => import('./pages/FarmerDashboard.jsx'))
const BuyerMarketplace = lazy(() => import('./pages/BuyerMarketplace.jsx'))
const AdminPanel = lazy(() => import('./pages/AdminPanel.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))

function PageLoadingFallback() {
  return (
    <div className="page-loading-fallback" role="status" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true" />
      <span>Loading page…</span>
    </div>
  )
}

class RouteLoadErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Could not load the requested page:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-load-error" role="alert">
          <p>{tr('pageLoadError', this.props.lang)}</p>
          <button type="button" className="btn btn-primary" onClick={() => globalThis.location.reload()}>
            {tr('tryAgain', this.props.lang)}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function LocalizedRouteErrorBoundary({ children }) {
  const { lang } = useLanguage()
  return <RouteLoadErrorBoundary lang={lang}>{children}</RouteLoadErrorBoundary>
}

// ── Protected Route ──────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const user = getStoredUser()
  const token = sessionStorage.getItem('agromitra_access_token')

  // Token নেই → login page
  if (!token || !user) {
    return <Navigate to="/auth" replace />
  }

  // Role match না করলে → তার নিজের dashboard-এ
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleRoutes = {
      farmer: '/farmer',
      buyer: '/buyer',
      consumer: '/buyer',
      admin: '/admin',
    }
    return <Navigate to={roleRoutes[user.role] || '/'} replace />
  }

  return children
}

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Navbar />
      <div className="main-content">
        <LocalizedRouteErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route path="/farmer" element={
                <ProtectedRoute allowedRoles={['farmer']}>
                  <FarmerDashboard />
                </ProtectedRoute>
              } />

              <Route path="/buyer" element={<BuyerMarketplace />} />

              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanel />
                </ProtectedRoute>
              } />

              {/* Unknown route → 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </LocalizedRouteErrorBoundary>
      </div>
    </Router>
  )
}

export default App