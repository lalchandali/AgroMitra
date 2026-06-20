import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, getStoredUser } from '../api/agromitra'
import logo from '../assets/icone.png';

const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(getStoredUser)
  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link'

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser())
    window.addEventListener('storage', syncUser)
    window.addEventListener('agromitra-auth-changed', syncUser)
    return () => {
      window.removeEventListener('storage', syncUser)
      window.removeEventListener('agromitra-auth-changed', syncUser)
    }
  }, [])

  const handleLogout = () => {
    clearAuthSession()
    navigate('/auth')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={logo} alt="AgroMitra Logo" className="navbar-logo" style={{ height: '42px',width: '42px', border: '1px solid var(--FFEBEE)', borderRadius: '50%',objectFit: 'contain' }} />
        <span>AgroMitra</span>
      </Link>
      <div className="navbar-links">
        <Link to="/" className={isActive('/')}>Home</Link>

        {/* Role-based links — only show the dashboard relevant to the logged-in user */}
        {user?.role === 'farmer' && (
          <Link to="/farmer" className={isActive('/farmer')}>Farmer</Link>
        )}
        {(user?.role === 'buyer' || user?.role === 'consumer') && (
          <Link to="/buyer" className={isActive('/buyer')}>Buyer</Link>
        )}
        {user?.role === 'admin' && (
          <Link to="/admin" className={isActive('/admin')}>Admin</Link>
        )}

        {user ? (
          <>
            <span className="nav-user">{user.name_en}</span>
            <button className="nav-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <Link to="/auth" className="nav-btn">Login</Link>
        )}
      </div>
    </nav>
  )
}

export default Navbar
