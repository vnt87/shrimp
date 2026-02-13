import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type ThemePreference = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

interface ThemeContextValue {
    theme: ThemePreference
    resolvedTheme: ResolvedTheme
    setTheme: (theme: ThemePreference) => void
}

const STORAGE_KEY = 'shrimp-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
    return pref === 'system' ? getSystemTheme() : pref
}

function getStoredTheme(): ThemePreference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
    } catch { /* ignore */ }
    return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemePreference>(getStoredTheme)
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme))

    const applyTheme = useCallback((resolved: ResolvedTheme) => {
        document.documentElement.setAttribute('data-theme', resolved)
        setResolvedTheme(resolved)
    }, [])

    const setTheme = useCallback((newTheme: ThemePreference) => {
        setThemeState(newTheme)
        localStorage.setItem(STORAGE_KEY, newTheme)
        applyTheme(resolveTheme(newTheme))
    }, [applyTheme])

    // Apply theme on mount
    useEffect(() => {
        applyTheme(resolveTheme(theme))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for system theme changes when preference is 'system'
    useEffect(() => {
        if (theme !== 'system') return

        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = (e: MediaQueryListEvent) => {
            applyTheme(e.matches ? 'dark' : 'light')
        }
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [theme, applyTheme])

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
    return ctx
}
