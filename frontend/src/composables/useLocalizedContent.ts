import { computed } from 'vue'
import { chapters as baseChapters } from '@/data/chapters'
import { planets as basePlanets } from '@/data/planets'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useSpaceStore } from '@/stores/useSpaceStore'
import type { AtmosphereGas, Chapter, Hotspot, Planet } from '@/types/explorer'

export function useLocalizedContent() {
  const localeStore = useLocaleStore()
  const spaceStore = useSpaceStore()

  const chapters = computed<Chapter[]>(() =>
    baseChapters.map((chapter) => {
      const copy = localeStore.messages.chapters[chapter.id]
      return {
        ...chapter,
        name: copy?.name ?? chapter.name,
        title: copy?.title ?? chapter.title,
        body: copy?.body ?? chapter.body,
      }
    }),
  )

  const planets = computed<Planet[]>(() =>
    basePlanets.map((planet) => {
      const copy = localeStore.messages.planets[planet.id]
      const hotspots = planet.hotspots.map((hotspot) => ({
        ...hotspot,
        label: copy?.hotspots[hotspot.id] ?? hotspot.label,
      })) as [Hotspot, Hotspot]

      const atmosphere: AtmosphereGas[] = planet.atmosphere.map((entry) => ({
        ...entry,
        gas: localeStore.messages.gases[entry.gas] ?? entry.gas,
      }))

      return {
        ...planet,
        name: copy?.name ?? planet.name,
        type: copy?.type ?? planet.type,
        hotspots,
        atmosphere,
      }
    }),
  )

  const activePlanet = computed(
    () => planets.value.find((planet) => planet.id === spaceStore.activePlanetId) ?? planets.value[0],
  )

  function localizeGas(gas: string) {
    return localeStore.messages.gases[gas] ?? gas
  }

  return {
    chapters,
    planets,
    activePlanet,
    localizeGas,
  }
}
