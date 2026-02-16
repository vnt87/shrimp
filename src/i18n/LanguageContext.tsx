import { createContext, useContext, useState, type ReactNode } from 'react'
import { en, TranslationKey } from './en'
import { vi } from './vi'

type Language = 'en' | 'vi'

interface LanguageContextValue {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const translations = {
    en,
    vi,
}

const STORAGE_KEY = 'shrimp-language'

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        return (stored === 'en' || stored === 'vi') ? stored : 'en'
    })

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
        localStorage.setItem(STORAGE_KEY, lang)
    }

    const t = (key: TranslationKey): string => {
        const translation = translations[language][key]
        if (!translation) {
            console.warn(`Missing translation for key: ${key} in language: ${language}`)
            return translations['en'][key] || key
        }
        return translation
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
