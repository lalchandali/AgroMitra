import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, getStoredUser } from '../api/agromitra'
import { useLanguage } from '../hooks/useLanguage'
import logo from '../assets/icone.PNG'
import { useTheme } from '../hooks/useTheme'
import { FiSun, FiMoon } from "react-icons/fi";
import NotificationBell from './NotificationBell'

const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const [user, setUser] = useState(() => getStoredUser())
  const [menuOpen, setMenuOpen] = useState(false)

  const { lang, toggleLang } = useLanguage()

  const isActive = (path) =>
    location.pathname === path ? 'nav-link active' : 'nav-link'

  const closeMenu = () => setMenuOpen(false)
  const { darkMode, toggleDarkMode } = useTheme()

  const L = {
    home: lang === 'bn' ? 'হোম' : 'Home',
    marketplace: lang === 'bn' ? 'মার্কেট' : 'Marketplace',
    dashboard: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard',
    admin: lang === 'bn' ? 'প্রশাসন' : 'Admin',
    logout: lang === 'bn' ? 'লগআউট' : 'Logout',
    login: lang === 'bn' ? 'লগইন' : 'Login',
  }

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser())

    globalThis.addEventListener('storage', syncUser)
    globalThis.addEventListener('agromitra-auth-changed', syncUser)

    return () => {
      globalThis.removeEventListener('storage', syncUser)
      globalThis.removeEventListener('agromitra-auth-changed', syncUser)
    }
  }, [])

  const handleLogout = () => {
    clearAuthSession()
    closeMenu()
    navigate('/auth')
  }

  const navLinks = (
    <>
      <Link to="/" className={isActive('/')} onClick={closeMenu}>
        {L.home}
      </Link>

      <Link
        to="/buyer"
        className={isActive('/buyer')}
        onClick={closeMenu}
      >
        {L.marketplace}
      </Link>

      {user?.role === 'farmer' && (
        <Link
          to="/farmer"
          className={isActive('/farmer')}
          onClick={closeMenu}
        >
          {L.dashboard}
        </Link>
      )}

      {user?.role === 'admin' && (
        <Link
          to="/admin"
          className={isActive('/admin')}
          onClick={closeMenu}
        >
          {L.admin}
        </Link>
      )}
    </>
  )

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={closeMenu}>
        <img
          src={logo}
          alt="AgroMitra Logo"
          className="navbar-logo"
          style={{
            height: 42,
            width: 42,
            borderRadius: '50%',
            objectFit: 'contain',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
        <span>AgroMitra</span>
      </Link>

      {/* Desktop Menu */}
      <div className="navbar-links navbar-desktop">
        {navLinks}

        <button
          onClick={toggleLang}
          title="Switch Language"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.2)',
            cursor: 'pointer',
            transition: 'all .25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.18)';
            e.currentTarget.style.transform = 'translateY(-3px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.12)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
              background: lang === 'en' ? '#22C55E' : 'transparent',
              color: lang === 'en' ? '#fff' : 'rgba(255,255,255,.75)',
              transition: '.25s',
            }}
          >
            EN
          </span>

          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
              background: lang === 'bn' ? '#22C55E' : 'transparent',
              color: lang === 'bn' ? '#fff' : 'rgba(255,255,255,.75)',
              transition: '.25s',
            }}
          >
            BN
          </span>
        </button>
        <button
          onClick={toggleDarkMode}
          className="theme-toggle"
        >
          {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
        </button>
        

        {user ? (
          <>
            <NotificationBell />

            <span className="nav-user">
              {user.name_en || user.full_name}
            </span>

            <button className="nav-btn" onClick={handleLogout}>
              {L.logout}
            </button>
          </>
        ) : (
          <Link to="/auth" className="nav-btn" onClick={closeMenu}>
            {L.login}
          </Link>
        )}
      </div>

      {/* Mobile Hamburger */}
      <button
        className="nav-hamburger"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
      >
        <span className={`hamburger-line ${menuOpen ? 'open-1' : ''}`} />
        <span className={`hamburger-line ${menuOpen ? 'open-2' : ''}`} />
        <span className={`hamburger-line ${menuOpen ? 'open-3' : ''}`} />
      </button>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          {navLinks}

          <div className="nav-mobile-divider" />

          <button
            onClick={() => {
              toggleLang()
              closeMenu()
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#A5D6A7',
              fontSize: 15,
              textAlign: 'left',
              padding: '14px 24px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {lang === 'en' ? '🇧🇩 বাংলায় দেখুন' : '🇬🇧 View in English'}
          </button>

          <div className="nav-mobile-divider" />

          {user ? (
            <>
              <div style={{ padding: '10px 24px' }}>
                <NotificationBell />
              </div>

              <div className="nav-mobile-user">
                👤 {user.name_en || user.full_name}
              </div>

              <button
                className="nav-mobile-logout"
                onClick={handleLogout}
              >
                🚪 {L.logout}
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="nav-mobile-btn"
              onClick={closeMenu}
            >
              🔑 {L.login}
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar