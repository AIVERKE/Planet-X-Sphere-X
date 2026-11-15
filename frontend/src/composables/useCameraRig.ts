import { shallowRef, watch } from 'vue'
import gsap from 'gsap'
import { Euler, Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useSpaceStore } from '@/stores/useSpaceStore'
import { scrollToProgress } from '@/composables/useScrollProgress'
import type { createEarthToSpaceRig } from '@/three/EarthToSpaceRig'

const lookDir = new Vector3()
const lookHome = new Vector3(0, 1.4, 0)
const SKY_HOLD_SECONDS = 2
/** Progress del rail al aterrizar tras mirar al cielo. */
const ASCENT_RAIL_PROGRESS = 0.42

type Rig = ReturnType<typeof createEarthToSpaceRig>

interface BoundRig {
  camera: PerspectiveCamera
  controls: OrbitControls
  rig: Rig
  canvas: HTMLCanvasElement
}

export function useCameraRig() {
  const store = useSpaceStore()
  const ctx = shallowRef<BoundRig | null>(null)
  let flight = 0
  let moveTween: gsap.core.Tween | null = null
  let lookTween: gsap.core.Tween | null = null
  let visualTween: gsap.core.Tween | null = null

  let yaw = 0.15
  let pitch = -0.05
  let dragging = false
  let lastX = 0
  let lastY = 0
  let gaze = 0
  let lastFrame = performance.now()

  function bind(next: BoundRig) {
    ctx.value = next
    next.controls.enableDamping = true
    next.controls.enablePan = false
    next.controls.enableZoom = false
    next.controls.enabled = false
    next.controls.minPolarAngle = 0.2
    next.controls.maxPolarAngle = Math.PI - 0.2

    next.camera.rotation.order = 'YXZ'
    next.camera.position.copy(lookHome)
    applyLook(next.camera)
    bindPointer(next.canvas)
  }

  function applyLook(camera: PerspectiveCamera) {
    camera.position.copy(lookHome)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw
    camera.rotation.x = pitch
    camera.rotation.z = 0
  }

  function lookTargetFromOrientation() {
    return new Vector3(0, 0, -1)
      .applyEuler(new Euler(pitch, yaw, 0, 'YXZ'))
      .add(lookHome)
  }

  function bindPointer(canvas: HTMLCanvasElement) {
    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function onDown(event: PointerEvent) {
    if (store.cameraMode !== 'look') return
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
    ;(event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }

  function onMove(event: PointerEvent) {
    if (!dragging || store.cameraMode !== 'look') return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    // Mouse arriba = mirar al cielo (pitch negativo en orden YXZ).
    yaw -= dx * 0.0045
    pitch += dy * 0.0038
    pitch = Math.max(-1.35, Math.min(1.1, pitch))
  }

  function onUp() {
    dragging = false
  }

  function killTweens() {
    moveTween?.kill()
    lookTween?.kill()
    visualTween?.kill()
    moveTween = null
    lookTween = null
    visualTween = null
  }

  function duration() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : 1.65
  }

  function clearPageScroll() {
    window.scrollTo({ top: 0, behavior: 'auto' })
    store.scrollProgress = 0
  }

  function ascend() {
    const current = ctx.value
    if (!current || store.cameraMode !== 'look') return

    const ticket = ++flight
    const seconds = duration() * 1.1
    store.cameraMode = 'travel'
    document.documentElement.classList.remove('is-look-locked')

    const pose = current.rig.poseAt(ASCENT_RAIL_PROGRESS)
    killTweens()
    store.visualOverride = 0

    visualTween = gsap.to({ v: 0 }, {
      v: 0.88,
      duration: seconds,
      ease: 'power2.inOut',
      onUpdate() {
        store.visualOverride = Number((this.targets()[0] as { v: number }).v)
      },
    })

    moveTween = gsap.to(current.camera.position, {
      x: pose.pos.x,
      y: pose.pos.y,
      z: pose.pos.z,
      duration: seconds,
      ease: 'power3.inOut',
      onComplete: () => {
        if (ticket !== flight) return
        store.visualOverride = null
        // Instantáneo: smooth dejaba el scroll en 0 un instante y rebotaba al paisaje.
        requestAnimationFrame(() => {
          if (ticket !== flight) return
          scrollToProgress(ASCENT_RAIL_PROGRESS, 'auto')
          store.scrollProgress = ASCENT_RAIL_PROGRESS
          store.cameraMode = 'scroll'
        })
      },
    })

    lookTween = gsap.to(current.rig.lookTarget, {
      x: pose.look.x,
      y: pose.look.y,
      z: pose.look.z,
      duration: seconds,
      ease: 'power3.inOut',
      onUpdate: () => {
        current.camera.lookAt(current.rig.lookTarget)
      },
    })
  }

  function descend() {
    const current = ctx.value
    if (!current || store.cameraMode === 'look') return

    const ticket = ++flight
    const seconds = duration() * 1.15
    const fromVisual =
      store.visualOverride ??
      (store.cameraMode === 'scroll' ? store.scrollProgress : Math.max(store.scrollProgress, 0.88))

    current.controls.enabled = false
    killTweens()
    store.cameraMode = 'travel'
    document.documentElement.classList.remove('is-look-locked')

    yaw = 0.15
    pitch = -0.05
    gaze = 0
    store.skyGaze = 0
    store.lookingAtSky = false
    clearPageScroll()

    const endLook = lookTargetFromOrientation()
    current.rig.lookTarget.copy(
      current.camera.getWorldDirection(lookDir).multiplyScalar(12).add(current.camera.position),
    )

    store.visualOverride = fromVisual
    visualTween = gsap.to({ v: fromVisual }, {
      v: 0,
      duration: seconds,
      ease: 'power2.inOut',
      onUpdate() {
        store.visualOverride = Number((this.targets()[0] as { v: number }).v)
      },
    })

    moveTween = gsap.to(current.camera.position, {
      x: lookHome.x,
      y: lookHome.y,
      z: lookHome.z,
      duration: seconds,
      ease: 'power3.inOut',
      onComplete: () => {
        if (ticket !== flight) return
        store.visualOverride = null
        applyLook(current.camera)
        clearPageScroll()
        document.documentElement.classList.add('is-look-locked')
        store.cameraMode = 'look'
      },
    })

    lookTween = gsap.to(current.rig.lookTarget, {
      x: endLook.x,
      y: endLook.y,
      z: endLook.z,
      duration: seconds,
      ease: 'power3.inOut',
      onUpdate: () => {
        current.camera.lookAt(current.rig.lookTarget)
      },
    })
  }

  function fly() {
    const current = ctx.value
    if (!current || store.travelNonce === 0) return
    if (store.cameraMode === 'look') return
    const group = current.rig.planetGroups.get(store.activePlanetId)
    if (!group) return

    const ticket = ++flight
    const radius = Number(group.userData.visualRadius) || 3
    const center = new Vector3()
    group.getWorldPosition(center)
    const distance = store.approach === 'surface' ? radius * 1.9 : radius * 3.55
    const destination = center.clone().add(new Vector3(0, radius * 0.3, distance))
    const seconds = duration()

    current.controls.enabled = false
    killTweens()
    store.visualOverride = null
    store.cameraMode = 'travel'
    moveTween = gsap.to(current.camera.position, {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      duration: seconds,
      ease: 'power2.inOut',
      onComplete: () => {
        if (ticket !== flight) return
        current.controls.target.copy(center)
        current.controls.minDistance = radius * 1.45
        current.controls.maxDistance = 220
        current.controls.enabled = true
        current.controls.update()
        store.cameraMode = 'orbit'
      },
    })
    lookTween = gsap.to(current.rig.lookTarget, {
      x: center.x,
      y: center.y,
      z: center.z,
      duration: seconds,
      ease: 'power2.inOut',
    })
  }

  function returnToRail() {
    const current = ctx.value
    if (!current) return
    const target = store.railTarget

    if (target !== null && target <= 0) {
      if (store.cameraMode !== 'look') store.requestDescent()
      return
    }

    if (store.cameraMode === 'look') {
      if (target !== null && target >= 0.35) store.requestAscent()
      return
    }

    if (store.cameraMode === 'scroll') {
      if (target !== null) scrollToProgress(target)
      return
    }

    const ticket = ++flight
    const pose = current.rig.poseAt(Math.max(store.scrollProgress, 0.42))
    const seconds = duration() * 0.55
    current.controls.enabled = false
    killTweens()
    store.visualOverride = null
    store.cameraMode = 'travel'
    moveTween = gsap.to(current.camera.position, {
      x: pose.pos.x,
      y: pose.pos.y,
      z: pose.pos.z,
      duration: seconds,
      ease: 'power2.inOut',
      onComplete: () => {
        if (ticket !== flight) return
        store.cameraMode = 'scroll'
        if (target !== null) scrollToProgress(target)
      },
    })
    lookTween = gsap.to(current.rig.lookTarget, {
      x: pose.look.x,
      y: pose.look.y,
      z: pose.look.z,
      duration: seconds,
      ease: 'power2.inOut',
    })
  }

  function frame() {
    const current = ctx.value
    if (!current) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastFrame) / 1000)
    lastFrame = now

    if (store.cameraMode === 'look') {
      current.controls.enabled = false
      applyLook(current.camera)

      // Dirección real de la cámara: +Y = cielo, -Y = suelo.
      current.camera.getWorldDirection(lookDir)
      const lookingUp = lookDir.y > 0.28
      store.lookingAtSky = lookingUp
      if (lookingUp) gaze = Math.min(SKY_HOLD_SECONDS, gaze + dt)
      else gaze = Math.max(0, gaze - dt * 1.6)
      store.skyGaze = gaze / SKY_HOLD_SECONDS

      if (gaze >= SKY_HOLD_SECONDS) {
        gaze = 0
        store.requestAscent()
      }
      return
    }

    if (store.cameraMode === 'travel') {
      current.controls.enabled = false
      if (store.ascentNonce > 0 && store.scrollProgress < 0.2 && store.visualOverride == null) {
        return
      }
      current.camera.lookAt(current.rig.lookTarget)
      return
    }

    if (store.cameraMode === 'scroll') {
      current.controls.enabled = false
      current.rig.applyScroll(current.camera, store.scrollProgress)
      return
    }

    current.controls.enabled = true
    current.controls.update()
  }

  const stopTravel = watch(() => store.travelNonce, fly)
  const stopRail = watch(() => store.railNonce, returnToRail)
  const stopAscent = watch(() => store.ascentNonce, ascend)
  const stopDescent = watch(() => store.descentNonce, descend)

  function dispose() {
    stopTravel()
    stopRail()
    stopAscent()
    stopDescent()
    killTweens()
    const canvas = ctx.value?.canvas
    canvas?.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    document.documentElement.classList.remove('is-look-locked')
    ctx.value?.controls.dispose()
    ctx.value = null
  }

  return { bind, frame, dispose }
}
