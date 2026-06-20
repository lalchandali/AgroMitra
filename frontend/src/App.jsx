import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import Home from './pages/Home.jsx'
import FarmerDashboard from './pages/FarmerDashboard.jsx'
import BuyerMarketplace from './pages/BuyerMarketplace.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import AuthPage from './pages/AuthPage.jsx'
import './index.css'

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/"        element={<Home />} />
          <Route path="/farmer"  element={<FarmerDashboard />} />
          <Route path="/buyer"   element={<BuyerMarketplace />} />
          <Route path="/admin"   element={<AdminPanel />} />
          <Route path="/auth"    element={<AuthPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
