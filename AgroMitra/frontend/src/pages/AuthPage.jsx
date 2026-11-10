import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiLock, FiLogIn, FiPhone, FiShield, FiUser, FiUserPlus } from 'react-icons/fi'
import { getStoredUser, loginUser, loginWithOtp, registerUser, requestLoginOtp, saveAuthSession } from '../api/agromitra'
import { useLanguage } from '../hooks/useLanguage'
import { tr } from '../translations'

const districts = [
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

// ── Self-service roles only. "admin" is intentionally left out: the
// backend's UserRegister schema now rejects it too (see user_schema.py),
// since letting anyone self-register as Administrator was a real
// privilege-escalation bug, not just a UI choice. Admin accounts should
// be created directly in the DB or via an admin-only promotion endpoint.
//
// Only two choices shown here: "consumer" used to be a separate option
// but routed to the exact same /buyer dashboard with the exact same
// permissions as "buyer" (see ROLE_ROUTES below and order_routes.py —
// nothing in the backend ever distinguished them), so it was a
// distinction without a difference. Kept the "buyer" value under the
// hood since that's what the rest of the code (getMyOrders('buyer'),
// BuyerMarketplace.jsx) already expects — just relabeled it "Customer".
const roleOptions = [
  { value: 'farmer', label: 'farmerAccount' },
  { value: 'buyer',  label: 'customerAccount' },
]

const emptyLogin = {
  mobile_number: '',
  password: '',
}

const emptyRegister = {
  mobile_number: '',
  name_en: '',
  name_bn: '',
  role: 'farmer',
  district: 'Bogura',
  password: '',
  confirm_password: '',
}

const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(', ')
  }
  return detail || error?.message || 'Something went wrong. Please try again.'
}

// ── Single source of truth for role → route mapping ──
const ROLE_ROUTES = {
  farmer:   '/farmer',
  buyer:    '/buyer',
  consumer: '/buyer',   // consumers browse the same marketplace as buyers
  admin:    '/admin',
}

const AuthPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState(initialMode)
  const [loginForm, setLoginForm] = useState(emptyLogin)
  const [registerForm, setRegisterForm] = useState(emptyRegister)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginMethod, setLoginMethod] = useState('otp')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const { lang } = useLanguage()
  const T = (key) => tr(key, lang)

  const isRegister = mode === 'register'
  const activeForm = isRegister ? registerForm : loginForm

  const title = useMemo(() => (
    isRegister ? 'Create your AgroMitra account' : 'Welcome back to AgroMitra'
  ), [isRegister])

  const updateMode = (nextMode) => {
    setMode(nextMode)
    setSearchParams(nextMode === 'register' ? { mode: 'register' } : {})
  }

  const updateLogin = (event) => {
    const { name, value } = event.target
    setLoginForm((current) => ({ ...current, [name]: value }))
    if (name === 'mobile_number') {
      setOtpSent(false)
      setOtpCode('')
    }
  }

  const updateRegister = (event) => {
    const { name, value } = event.target
    setRegisterForm((current) => ({ ...current, [name]: value }))
  }

  const completeLogin = async (credentials) => {
    const response = await loginUser(credentials)
    saveAuthSession(response.data)
    return response.data.user
  }

  const redirectByRole = (user) => {
    const path = ROLE_ROUTES[user?.role] || '/buyer'
    navigate(path)
  }

  // ইতিমধ্যে login করা থাকলে /auth-এ এসে login form দেখানোর দরকার নাই —
  // সরাসরি তার dashboard-এ পাঠিয়ে দাও
  useEffect(() => {
    const existingUser = getStoredUser()
    const token = sessionStorage.getItem('agromitra_access_token')
    if (existingUser && token) {
      redirectByRole(existingUser)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const user = await completeLogin(loginForm)
      toast.success(`Logged in as ${user.name_en}`)
      redirectByRole(user)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      if (!otpSent) {
        await requestLoginOtp(loginForm.mobile_number)
        setOtpSent(true)
        toast.success(T('otpSentToConsole'))
        return
      }
      const { data } = await loginWithOtp(loginForm.mobile_number, otpCode)
      saveAuthSession(data)
      toast.success(`Logged in as ${data.user.name_en}`)
      redirectByRole(data.user)
    } catch (error) {
      const detail = error?.response?.data?.detail
      toast.error(
        typeof detail !== 'string'
          ? getErrorMessage(error)
          : detail.includes('SMS provider')
            ? T('otpProductionUnavailable')
            : detail.includes('farmer account')
              ? T('otpFarmerOnly')
              : detail.includes('expired')
                ? T('otpExpired')
                : detail.includes('Too many attempts')
                  ? T('otpTooManyAttempts')
                  : detail.includes('Invalid OTP') || detail.includes('OTP not found')
                    ? T('otpInvalid')
                    : getErrorMessage(error)
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    if (registerForm.password !== registerForm.confirm_password) {
      toast.error('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = { ...registerForm }
      delete payload.confirm_password
      await registerUser({
        ...payload,
        name_bn: payload.name_bn.trim() || null,
      })
      const user = await completeLogin({
        mobile_number: registerForm.mobile_number,
        password: registerForm.password,
      })
      toast.success(`Account created for ${user.name_en}`)
      redirectByRole(user)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-mark">A</span>
            <span>AgroMitra</span>
          </Link>
          <div>
            <h1>{title}</h1>
            <p>
              Access your crop intelligence, marketplace activity, and secure farmer-buyer workflow from one account.
            </p>
          </div>
          <div className="auth-proof-grid">
            <div>
              <FiShield />
              <span>JWT protected API</span>
            </div>
            <div>
              <FiPhone />
              <span>Mobile number login</span>
            </div>
            <div>
              <FiUser />
              <span>Role based experience</span>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              className={mode === 'login' ? 'active' : ''}
              onClick={() => updateMode('login')}
              type="button"
            >
              <FiLogIn /> Login
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => updateMode('register')}
              type="button"
            >
              <FiUserPlus /> Register
            </button>
          </div>

          {!isRegister && (
            <div className="auth-login-methods" aria-label={T('loginMethod')}>
              <button type="button" className={loginMethod === 'otp' ? 'active' : ''}
                onClick={() => { setLoginMethod('otp'); setOtpSent(false); setOtpCode('') }}>
                {T('farmerPhoneOtp')}
              </button>
              <button type="button" className={loginMethod === 'password' ? 'active' : ''}
                onClick={() => { setLoginMethod('password'); setOtpSent(false); setOtpCode('') }}>
                {T('passwordLogin')}
              </button>
            </div>
          )}

          <form onSubmit={isRegister ? handleRegister : loginMethod === 'otp' ? handleOtpLogin : handleLogin}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="name_en">{T('fullName')}</label>
                  <input
                    id="name_en"
                    name="name_en"
                    className="form-input"
                    value={registerForm.name_en}
                    onChange={updateRegister}
                    placeholder={T('namePlaceholder')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="name_bn">{T('banglaName')}</label>
                  <input
                    id="name_bn"
                    name="name_bn"
                    className="form-input"
                    value={registerForm.name_bn}
                    onChange={updateRegister}
                    placeholder={T('optionalField')}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="mobile_number">{T('mobileNumber')}</label>
              <input
                id="mobile_number"
                name="mobile_number"
                className="form-input"
                value={activeForm.mobile_number}
                onChange={isRegister ? updateRegister : updateLogin}
                placeholder="01711223344"
                inputMode="numeric"
                minLength={11}
                maxLength={11}
                required
              />
            </div>

            {isRegister && (
              <div className="auth-form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="role">{T('accountType')}</label>
                  <select
                    id="role"
                    name="role"
                    className="form-select"
                    value={registerForm.role}
                    onChange={updateRegister}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.value === 'farmer' ? '👨‍🌾 ' : '🛒 '}{T(role.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="district">{T('district')}</label>
                  <select
                    id="district"
                    name="district"
                    className="form-select"
                    value={registerForm.district}
                    onChange={updateRegister}
                  >
                    {districts.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {(isRegister || loginMethod === 'password') && (
              <div className="form-group">
                <label className="form-label" htmlFor="password">{T('passwordLabel')}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-input"
                  value={activeForm.password}
                  onChange={isRegister ? updateRegister : updateLogin}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />
              </div>
            )}

            {!isRegister && loginMethod === 'otp' && otpSent && (
              <div className="form-group">
                <label className="form-label" htmlFor="login_otp">{T('otpCodeLabel')}</label>
                <input id="login_otp" className="form-input" value={otpCode}
                  onChange={event => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" minLength={6} maxLength={6} required />
              </div>
            )}

            {isRegister && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirm_password">{T('confirmPasswordLabel')}</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  className="form-input"
                  value={registerForm.confirm_password}
                  onChange={updateRegister}
                  placeholder="Repeat your password"
                  minLength={6}
                  required
                />
              </div>
            )}

            {!isRegister && loginMethod === 'password' && (
              <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 8 }}>
                <Link to="/forgot-password"
                  style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>
                  🔑 Forgot Password?
                </Link>
              </div>
            )}

            <button className="btn btn-primary btn-full auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <span className="spinner auth-spinner" /> Processing </>
              ) : isRegister ? (
                <>
                  <FiUserPlus /> Create account
                </>
              ) : loginMethod === 'otp' ? (
                <>
                  <FiPhone /> {otpSent ? T('verifyAndLogin') : T('sendLoginOtp')}
                </>
              ) : (
                <>
                  <FiLock /> Login securely
                </>
              )}
            </button>
          </form>

          <div className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to AgroMitra?'}
            <button type="button" onClick={() => updateMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Login now' : 'Create account'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AuthPage
