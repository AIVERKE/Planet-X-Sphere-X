import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import type { Locale, Messages } from '@/i18n/types'

export const LOCALE_STORAGE_KEY = 'planet-x-locale'

export const messages: Record<Locale, Messages> = { es, en }

export function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en'
}

export function readStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'es'
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : 'es'
  } catch {
    return 'es'
  }
}

export function getMessages(locale: Locale): Messages {
  return messages[locale]
}
