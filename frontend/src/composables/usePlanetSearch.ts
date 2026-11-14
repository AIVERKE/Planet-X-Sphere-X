import { computed } from 'vue'
import { planets } from '@/data/planets'
import { useSpaceStore } from '@/stores/useSpaceStore'

export function usePlanetSearch() {
  const store = useSpaceStore()

  const results = computed(() => {
    const query = store.query.trim().toLowerCase()
    return planets.filter((planet) => {
      if (store.filter !== 'todos' && planet.category !== store.filter) return false
      if (!query) return true
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
