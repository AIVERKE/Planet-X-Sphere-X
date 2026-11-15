import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  getMessages,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
} from '@/i18n'
import type { Locale } from '@/i18n/types'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<Locale>(readStoredLocale())

  const messages = computed(() => getMessages(locale.value))
  const otherLocale = computed<Locale>(() => (locale.value === 'es' ? 'en' : 'es'))

  function setLocale(next: Locale) {
    locale.value = next
  }

  function toggleLocale() {
    locale.value = otherLocale.value
  }

  watch(
    locale,
    (value) => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = value
      }
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, value)
      } catch {
        /* ignore */
      }
    },
    { immediate: true },
  )

  return {
    locale,
    messages,
    otherLocale,
    setLocale,
    toggleLocale,
  }
})
