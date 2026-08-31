import { useEffect, useState } from 'react'
import { ThemeContext } from './theme-context'

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