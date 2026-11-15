import { computed, nextTick, ref, type Ref } from 'vue'

export type MissionTourStepId =
  | 'atlas'
  | 'targets'
  | 'data'
  | 'motion'
  | 'interpret'

export const MISSION_TOUR_STEPS: MissionTourStepId[] = [
  'atlas',
  'targets',
  'data',
  'motion',
  'interpret',
]

const STORAGE_KEY = 'planet-x-mission-onboarding'

type StoredStatus = 'done' | 'skipped'

function readSessionStatus(): StoredStatus | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    if (value === 'done' || value === 'skipped') return value
  } catch {
    /* private mode / blocked */
  }
  return null
}

function writeSessionStatus(status: StoredStatus) {
  try {
    sessionStorage.setItem(STORAGE_KEY, status)
  } catch {
    /* ignore */
  }
}

export type MissionOnboardingOptions = {
  isEmbed: Ref<boolean>
  /** Abre paneles / anclas antes de medir el spotlight. */
  prepareStep: (id: MissionTourStepId) => void | Promise<void>
}

/**
 * Tour corto de misión + panel Guía.
 * Persistencia solo de sesión (sessionStorage). Sin onboarding en embed.
 */
export function useMissionOnboarding(options: MissionOnboardingOptions) {
  const tourActive = ref(false)
  const guideOpen = ref(false)
  const stepIndex = ref(0)
  const targetRect = ref<DOMRect | null>(null)
  const autoStarted = ref(false)

  const stepId = computed(
    () => MISSION_TOUR_STEPS[stepIndex.value] ?? MISSION_TOUR_STEPS[0],
  )
  const isFirst = computed(() => stepIndex.value <= 0)
  const isLast = computed(
    () => stepIndex.value >= MISSION_TOUR_STEPS.length - 1,
  )
  const stepCount = MISSION_TOUR_STEPS.length

  function measureAnchor(id: MissionTourStepId) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`)
    targetRect.value = el?.getBoundingClientRect() ?? null
  }

  async function goToStep(index: number) {
    const next = Math.max(0, Math.min(MISSION_TOUR_STEPS.length - 1, index))
    stepIndex.value = next
    const id = MISSION_TOUR_STEPS[next]!
    await options.prepareStep(id)
    await nextTick()
    // Paneles con transición corta: segunda medida.
    requestAnimationFrame(() => {
      measureAnchor(id)
      window.setTimeout(() => measureAnchor(id), 180)
    })
  }

  async function startTour(fromStep = 0) {
    if (options.isEmbed.value) return
    guideOpen.value = false
    tourActive.value = true
    await goToStep(fromStep)
  }

  function closeTour(status: StoredStatus) {
    tourActive.value = false
    targetRect.value = null
    writeSessionStatus(status)
  }

  function skipTour() {
    closeTour('skipped')
  }

  function finishTour() {
    closeTour('done')
    guideOpen.value = true
  }

  async function nextStep() {
    if (isLast.value) {
      finishTour()
      return
    }
    await goToStep(stepIndex.value + 1)
  }

  async function prevStep() {
    if (isFirst.value) return
    await goToStep(stepIndex.value - 1)
  }

  function openGuide() {
    if (options.isEmbed.value) return
    if (tourActive.value) writeSessionStatus('skipped')
    tourActive.value = false
    targetRect.value = null
    guideOpen.value = true
  }

  function closeGuide() {
    guideOpen.value = false
  }

  function toggleGuide() {
    if (guideOpen.value) closeGuide()
    else openGuide()
  }

  /** Primera visita de la sesión (no embed). */
  async function tryAutoStart() {
    if (autoStarted.value || options.isEmbed.value) return
    if (readSessionStatus()) return
    autoStarted.value = true
    await startTour(0)
  }

  function remountMeasure() {
    if (!tourActive.value) return
    measureAnchor(stepId.value)
  }

  return {
    tourActive,
    guideOpen,
    stepIndex,
    stepId,
    stepCount,
    isFirst,
    isLast,
    targetRect,
    startTour,
    skipTour,
    finishTour,
    nextStep,
    prevStep,
    openGuide,
    closeGuide,
    toggleGuide,
    tryAutoStart,
    remountMeasure,
    goToStep,
  }
}
