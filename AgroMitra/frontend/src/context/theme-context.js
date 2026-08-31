// The context object itself lives here, separate from ThemeContext.jsx's
// ThemeProvider component, so that file can export only a component
// (react-refresh/only-export-components needs that for reliable Fast Refresh).
import { createContext } from 'react'

export const ThemeContext = createContext()
