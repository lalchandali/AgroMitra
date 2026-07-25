import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('agromitra_dark') === '1'
    })

    useEffect(() => {
        document.body.classList.toggle('dark-mode', darkMode)
        localStorage.setItem('agromitra_dark', darkMode ? '1' : '0')
    }, [darkMode])

    const toggleDarkMode = () => {
        setDarkMode(prev => !prev)
    }

    return (
        <ThemeContext.Provider
            value={{
                darkMode,
                toggleDarkMode,
            }}
        >
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)