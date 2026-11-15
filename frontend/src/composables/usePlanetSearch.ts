import { computed } from 'vue'
import { useLocalizedContent } from '@/composables/useLocalizedContent'
import { useSpaceStore } from '@/stores/useSpaceStore'

export function usePlanetSearch() {
  const store = useSpaceStore()
  const { planets } = useLocalizedContent()

  const results = computed(() => {
    const query = store.query.trim().toLowerCase()
    if (!query) return planets.value
    return planets.value.filter((planet) => {
      const haystack = [
        planet.name,
        planet.type,
        planet.category,
        ...planet.atmosphere.map((gas) => gas.gas),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })

  return { results }
}
