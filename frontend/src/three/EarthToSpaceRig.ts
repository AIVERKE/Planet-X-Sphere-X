import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector3,
  type Camera,
  type Material,
  type WebGLRenderer,
} from 'three'
import type { CameraMode } from '@/types/explorer'
import { planets } from '@/data/planets'
import { createEarthGlobe } from '@/three/scene/EarthGlobe'
import { createPlanetBody } from '@/three/scene/PlanetBody'
import { loadMilkyWayBackground, type SpaceBackground } from '@/three/scene/Starfield'
import { loadQwantaniSky, type QwantaniSky } from '@/three/loadQwantaniSky'
import { preloadPlanetTextures } from '@/three/textures/planetMaps'
import { bindProjectedPoint } from '@/composables/useProjectedMarkers'
import { smoothstep } from '@/utils/fadeWindow'

interface CameraKey {
  t: number
  pos: [number, number, number]
  look: [number, number, number]
}

const KEYS: CameraKey[] = [
  { t: 0, pos: [0, 1.4, 0.01], look: [0, 1.4, -1] },
  { t: 0.22, pos: [0, 4, 8], look: [0, 1, -2] },
  { t: 0.4, pos: [1.2, 7.2, 20], look: [0, 0, 0] },
  { t: 0.62, pos: [8, 12, 38], look: [10, 0.5, -4] },
  { t: 0.85, pos: [18, 18, 70], look: [20, 1, -6] },
  { t: 1, pos: [24, 22, 88], look: [28, 1, -4] },
]

const space = new Color('#03050a')
const clear = new Color('#03050a')

export function createEarthToSpaceRig() {
  const scene = new Scene()
  const lookTarget = new Vector3(0, 1.4, -1)
  const planetGroups = new Map<string, Group>()
  const planetMaterials: Material[] = []
  let sky: QwantaniSky | null = null
  let milkyWay: SpaceBackground | null = null
  let assetsReady = false
  let lastTime = 0

  const ambient = new AmbientLight(0x9aa7c2, 0.45)
  const keyLight = new DirectionalLight(0xffffff, 2.1)
  keyLight.position.set(40, 28, 50)
  scene.add(ambient, keyLight)

  function buildPlanets() {
    if (planetGroups.size > 0) return

    const earthData = planets.find((planet) => planet.id === 'earth')
    if (!earthData) return

    const earth = createEarthGlobe(earthData)
    // ~30 % de vuelta: evita empezar de cara al océano vacío.
    earth.group.rotation.y = Math.PI * 2 * 0.3
    earth.group.visible = false
    scene.add(earth.group)
    planetGroups.set(earthData.id, earth.group)
    planetMaterials.push(earth.material)
    bindHotspots(earth.group, earthData.hotspots.map((hotspot) => hotspot.id))

    for (const planet of planets) {
      if (planet.id === 'earth') continue
      const body = createPlanetBody(planet)
      body.group.visible = false
      scene.add(body.group)
      planetGroups.set(planet.id, body.group)
      planetMaterials.push(body.material)
      bindHotspots(body.group, planet.hotspots.map((hotspot) => hotspot.id))
    }
  }

  async function loadSky(renderer: WebGLRenderer) {
    if (assetsReady) return
    await preloadPlanetTextures()
    buildPlanets()
    const [landscape, stars] = await Promise.all([
      loadQwantaniSky(renderer),
      loadMilkyWayBackground(),
    ])
    sky = landscape
    milkyWay = stars
    scene.add(sky.mesh)
    scene.add(milkyWay.mesh)
    assetsReady = true
  }

  function poseAt(progress: number) {
    const t = Math.min(1, Math.max(0, progress))
    let index = 0
    while (index < KEYS.length - 2 && KEYS[index + 1].t < t) index += 1
    const from = KEYS[index]
    const to = KEYS[index + 1]
    const span = to.t - from.t || 1
    const eased = smoothstep(0, 1, (t - from.t) / span)
    return {
      pos: new Vector3(
        from.pos[0] + (to.pos[0] - from.pos[0]) * eased,
        from.pos[1] + (to.pos[1] - from.pos[1]) * eased,
        from.pos[2] + (to.pos[2] - from.pos[2]) * eased,
      ),
      look: new Vector3(
        from.look[0] + (to.look[0] - from.look[0]) * eased,
        from.look[1] + (to.look[1] - from.look[1]) * eased,
        from.look[2] + (to.look[2] - from.look[2]) * eased,
      ),
    }
  }

  function applyScroll(camera: Camera, progress: number) {
    const pose = poseAt(Math.max(progress, 0.22))
    camera.position.copy(pose.pos)
    lookTarget.copy(pose.look)
    camera.lookAt(lookTarget)
  }

  function setSkyOpacity(value: number) {
    sky?.setOpacity(value)
  }

  function update(
    time: number,
    progress: number,
    renderer: WebGLRenderer,
    camera: Camera,
    cameraMode: CameraMode,
    visualOverride: number | null = null,
  ) {
    const inLook = cameraMode === 'look'
    const visual = inLook
      ? 0
      : visualOverride != null
        ? visualOverride
        : cameraMode === 'scroll'
          ? progress
          : Math.max(progress, 0.88)

    clear.copy(space)
    renderer.setClearColor(clear, 1)
    renderer.toneMappingExposure = inLook ? 1.15 : 1

    if (sky) {
      const skyFade = inLook ? 1 : 1 - smoothstep(0.18, 0.42, visual)
      sky.setOpacity(skyFade)
      sky.mesh.position.copy(camera.position)
    }

    if (milkyWay) {
      const starsFade = inLook ? 0 : smoothstep(0.32, 0.55, visual)
      milkyWay.setOpacity(starsFade)
      milkyWay.mesh.position.copy(camera.position)
      milkyWay.mesh.rotation.y = time * 0.004
    }

    const earthGroup = planetGroups.get('earth')
    const earthAppear = inLook ? 0 : smoothstep(0.28, 0.45, visual)
    if (earthGroup) {
      earthGroup.visible = earthAppear > 0.02
      earthGroup.scale.setScalar(0.62 + earthAppear * 0.38)
    }

    const spin = cameraMode === 'scroll' || cameraMode === 'look' ? 1 : 0.22
    const delta = Math.min(0.05, Math.max(0, time - lastTime))
    lastTime = time

    for (const [id, group] of planetGroups) {
      const speed = id === 'sun' ? 0.04 : id === 'jupiter' ? 0.18 : 0.08
      group.rotation.y += delta * speed * spin
      if (id === 'earth') continue
      const appear = inLook
        ? 0
        : id === 'moon'
          ? earthAppear
          : smoothstep(0.58, 0.78, visual)
      group.visible = appear > 0.02
      group.scale.setScalar(Math.max(appear, 0.001))
    }

    for (const material of planetMaterials) {
      if (material instanceof ShaderMaterial && material.uniforms?.uTime) {
        material.uniforms.uTime.value = time
      }
    }
  }

  function dispose() {
    sky?.dispose()
    milkyWay?.dispose()
    scene.traverse((object) => {
      const mesh = object as Mesh & { isMesh?: boolean; isPoints?: boolean }
      if (!mesh.isMesh && !mesh.isPoints) return
      mesh.geometry?.dispose()
      const material = mesh.material
      const materials = Array.isArray(material) ? material : material ? [material] : []
      materials.forEach((item) => item.dispose())
    })
  }

  return {
    scene,
    lookTarget,
    planetGroups,
    poseAt,
    applyScroll,
    setSkyOpacity,
    loadSky,
    update,
    dispose,
  }
}

function bindHotspots(group: Group, ids: string[]) {
  for (const id of ids) {
    const anchor = group.getObjectByName(id)
    if (!anchor) continue
    const target = new Vector3()
    bindProjectedPoint(id, () => anchor.getWorldPosition(target))
  }
}
