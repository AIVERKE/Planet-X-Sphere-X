import { computed } from 'vue'
import { useLocaleStore } from '@/stores/useLocaleStore'
import type { Messages } from '@/i18n/types'

type Path = string

function resolvePath(source: Messages, path: Path): string | undefined {
  const parts = path.split('.')
  let current: unknown = source
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function useI18n() {
  const store = useLocaleStore()

  const t = (path: Path, fallback = path) => {
    return resolvePath(store.messages, path) ?? fallback
  }

  const locale = computed(() => store.locale)
  const m = computed(() => store.messages)

  return {
    t,
    m,
    locale,
    toggleLocale: store.toggleLocale,
    setLocale: store.setLocale,
  }
}
