import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import cs from './locales/cs.json'
import es from './locales/es.json'

const STORAGE_KEY = 'bloommate_language'

// Figures out which language to start with, before we know if the user is
// logged in yet: saved choice on this device > browser language > English.
function getInitialLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && ['en', 'cs', 'es'].includes(saved)) return saved
  const browserLang = (navigator.language || 'en').slice(0, 2)
  if (['en', 'cs', 'es'].includes(browserLang)) return browserLang
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cs: { translation: cs },
    es: { translation: es },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

// Called once we know the signed-in user's saved language preference
// (from user_metadata.language), so it can override the device guess.
export function applyUserLanguage(lang) {
  if (lang && ['en', 'cs', 'es'].includes(lang) && lang !== i18n.language) {
    i18n.changeLanguage(lang)
  }
}

// Called from the Profile page when the user picks a language.
export function setLanguage(lang) {
  i18n.changeLanguage(lang)
  localStorage.setItem(STORAGE_KEY, lang)
}

export default i18n
