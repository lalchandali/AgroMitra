import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, getStoredUser } from '../api/agromitra'
import { useLanguage } from '../hooks/useLanguage'
import logo from '../assets/icone.png'

const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const [user, setUser] = useState(() => getStoredUser())
  const [menuOpen, setMenuOpen] = useState(false)

  const { lang, toggleLang } = useLanguage()

  const isActive = (path) =>
    location.pathname === path ? 'nav-link active' : 'nav-link'

  const closeMenu = () => setMenuOpen(false)

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
          title="Switch Language / ভাষা পরিবর্তন"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.5,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.22)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
          }}
        >
          {lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 English'}
        </button>

        {user ? (
          <>
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