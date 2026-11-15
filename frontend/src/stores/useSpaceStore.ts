import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { planets } from '@/data/planets'
import type { Approach, CameraMode, Phase, PlanetFilter } from '@/types/explorer'

export const useSpaceStore = defineStore('space', () => {
  const scrollProgress = ref(0)
  const activePlanetId = ref('earth')
  const query = ref('')
  const filter = ref<PlanetFilter>('todos')
  const cameraMode = ref<CameraMode>('look')
  const approach = ref<Approach>('orbit')
  const travelNonce = ref(0)
  const railNonce = ref(0)
  const railTarget = ref<number | null>(null)
  const ascentNonce = ref(0)
  const descentNonce = ref(0)
  /** Override visual rail during ascend/descend tweens (null = use normal rules). */
  const visualOverride = ref<number | null>(null)
  const skyReady = ref(false)
  const lookingAtSky = ref(false)
  const skyGaze = ref(0)

  const hasAscended = computed(() => cameraMode.value !== 'look')

  /** 1 paisaje · 2 mundo · 3 ascenso · 4 planetas · 5 misión SPHEREx */
  const phase = computed<Phase>(() => {
    if (cameraMode.value === 'look') return 1
    const progress = scrollProgress.value
    if (progress < 0.3) return 1
    if (progress < 0.5) return 2
    if (progress < 0.68) return 3
    if (progress < 0.9) return 4
    return 5
  })

  const showPlanetHud = computed(() => {
    if (cameraMode.value === 'look') return false
    return scrollProgress.value >= 0.72 && scrollProgress.value < 0.9
  })

  const showSpherexMission = computed(() => {
    if (cameraMode.value === 'look') return false
    return scrollProgress.value >= 0.9
  })

  const activePlanet = computed(
    () => planets.find((planet) => planet.id === activePlanetId.value) ?? planets[0],
  )

  function requestTravel(id: string, next: Approach) {
    activePlanetId.value = id
    approach.value = next
    cameraMode.value = 'travel'
    travelNonce.value += 1
  }

  function requestRail(progress: number | null = null) {
    railTarget.value = progress
    railNonce.value += 1
  }

  function requestAscent() {
    if (cameraMode.value !== 'look') return
    ascentNonce.value += 1
  }

  function requestDescent() {
    if (cameraMode.value === 'look') return
    descentNonce.value += 1
  }

  function reset() {
    scrollProgress.value = 0
    activePlanetId.value = 'earth'
    query.value = ''
    filter.value = 'todos'
    cameraMode.value = 'look'
    approach.value = 'orbit'
    railTarget.value = null
    visualOverride.value = null
    lookingAtSky.value = false
    skyGaze.value = 0
  }

  return {
    scrollProgress,
    activePlanetId,
    query,
    filter,
    cameraMode,
    approach,
    travelNonce,
    railNonce,
    railTarget,
    ascentNonce,
    descentNonce,
    visualOverride,
    skyReady,
    lookingAtSky,
    skyGaze,
    hasAscended,
    phase,
    showPlanetHud,
    showSpherexMission,
    activePlanet,
    requestTravel,
    requestRail,
    requestAscent,
    requestDescent,
    reset,
  }
})
