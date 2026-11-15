import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useLocaleStore } from '@/stores/useLocaleStore'

export function usePageTitle(fallback = 'Planet X and SPHEREx') {
  const route = useRoute()
  const localeStore = useLocaleStore()

  watchEffect(() => {
    const key = route.meta.titleKey
    const title =
      key === 'explorer' || key === 'mission' || key === 'home'
        ? localeStore.messages.routes[key]
        : fallback
    document.title = `${title} · Planet X and SPHEREx`
  })
}
