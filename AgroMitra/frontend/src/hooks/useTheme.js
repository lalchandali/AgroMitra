// ============================================================
//   AgroMitra — useTheme hook
//   Reads dark-mode state from ThemeContext
// ============================================================
//
//   Split out of context/ThemeContext.jsx: that file exporting both the
//   ThemeProvider component and this hook tripped the react-refresh/
//   only-export-components ESLint rule (a file has to export only
//   components for Vite Fast Refresh to hot-reload it reliably).
//
import { useContext } from 'react'
import { ThemeContext } from '../context/theme-context'

export const useTheme = () => useContext(ThemeContext)
