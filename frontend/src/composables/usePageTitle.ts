import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'

export function usePageTitle(fallback = 'Planet X and SPHEREx') {
  const route = useRoute()

  watchEffect(() => {
    const title = typeof route.meta.title === 'string' ? route.meta.title : fallback
    document.title = `${title} · Planet X and SPHEREx`
  })
}
