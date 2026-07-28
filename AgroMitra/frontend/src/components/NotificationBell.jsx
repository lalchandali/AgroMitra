// ============================================================
//   AgroMitra — Notification Bell
//   Navbar-এ বসে থাকা bell icon: unread count badge দেখায়,
//   click করলে dropdown-এ latest notification list খোলে।
//   /api/v1/notifications/* endpoints ব্যবহার করে।
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/agromitra'
import { useLanguage } from '../hooks/useLanguage'
import { tr } from '../translations'

const POLL_MS = 20000 // প্রতি ২০ সেকেন্ডে unread count refresh হয়

// ── "৫ মিনিট আগে" style relative time ──────────────────────
function timeAgo(isoString, lang) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  const units = [
    [60, lang === 'bn' ? 'এইমাত্র' : 'just now'],
  ]
  if (seconds < 60) return units[0][1]

  const mins = Math.floor(seconds / 60)
  if (mins < 60) return lang === 'bn' ? `${mins} মিনিট আগে` : `${mins}m ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return lang === 'bn' ? `${hours} ঘণ্টা আগে` : `${hours}h ago`

  const days = Math.floor(hours / 24)
  return lang === 'bn' ? `${days} দিন আগে` : `${days}d ago`
}

const NotificationBell = () => {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const T = (key) => tr(key, lang)

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadNotificationCount()
      setUnreadCount(res.data.unread_count)
    } catch {
      // silent — badge just won't update this cycle, no need to interrupt the user
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotifications()
      setNotifications(res.data)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── প্রথমবার mount হলে + প্রতি ২০ সেকেন্ডে unread count poll ──
  useEffect(() => {
    refreshUnreadCount()
    const interval = setInterval(refreshUnreadCount, POLL_MS)
    return () => clearInterval(interval)
  }, [refreshUnreadCount])

  // ── বাইরে click করলে dropdown বন্ধ ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) loadNotifications()
  }

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((x) => (x.notification_id === n.notification_id ? { ...x, is_read: true } : x))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      try {
        await markNotificationRead(n.notification_id)
      } catch {
        // local state already optimistically updated; a failed mark-read isn't worth blocking navigation
      }
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const handleMarkAllRead = async (e) => {
    e.stopPropagation()
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch {
      // ignore — worst case a stale unread badge reappears next poll cycle
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        aria-label={T('notifications')}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,.2)',
          background: open ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.12)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all .2s ease',
        }}
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: '#EF4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: '2px solid var(--navbar-bg, #1B5E20)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 340,
            maxWidth: '90vw',
            maxHeight: 420,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--card-bg, #fff)',
            color: 'var(--text-dark, #1a1a1a)',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,.18)',
            border: '1px solid rgba(0,0,0,.06)',
            overflow: 'hidden',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(0,0,0,.08)',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <span>🔔 {T('notifications')}</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2E7D32',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {T('markAllRead')}
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
                {T('loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
                {T('noNotifications')}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(0,0,0,.05)',
                    cursor: 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(76, 175, 80, 0.08)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  {!n.is_read && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#2E7D32',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: 13.5 }}>
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-muted, #666)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {timeAgo(n.created_at, lang)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
