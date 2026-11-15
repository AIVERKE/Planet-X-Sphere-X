import {
  AdditiveBlending,
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Camera,
  type PerspectiveCamera,
  type Texture,
} from 'three'
import { markRaw } from 'vue'
import earthUrl from '@/assets/images/2k_earth_daymap.jpg?url'
import marsUrl from '@/assets/images/2k_mars.jpg?url'
import moonUrl from '@/assets/images/2k_moon.jpg?url'
import milkyWayUrl from '@/assets/images/8k_stars_milky_way.jpg?url'
import nebulaCloudUrl from '@/assets/images/nebulosa.png?url'
import nebulaPastelUrl from '@/assets/images/nebulosa2.png?url'
import probeUrl from '@/assets/images/Sonda espacial de reflector metálico aflorado.png?url'
import { smoothstep } from '@/utils/fadeWindow'

interface CameraKey {
  t: number
  pos: [number, number, number]
  look: [number, number, number]
}

const KEYS: CameraKey[] = [
  { t: 0, pos: [0, 1.2, 14], look: [0, 0.4, 0] },
  { t: 0.18, pos: [-2.2, 1.6, 8], look: [0.4, 0.2, -1] },
  { t: 0.36, pos: [3.5, 2.4, 2], look: [-1, 0.3, -6] },
  { t: 0.55, pos: [-1.5, 3.2, -8], look: [2, 0.8, -16] },
  { t: 0.74, pos: [4, 1.8, -18], look: [0, 1, -28] },
  { t: 1, pos: [0.5, 2.5, -32], look: [-1, 1.2, -42] },
]

function lerpKeys(progress: number) {
  const t = Math.min(1, Math.max(0, progress))
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].t < t) i += 1
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const u = (t - a.t) / Math.max(1e-5, b.t - a.t)
  const e = u * u * (3 - 2 * u)
  const pos = new Vector3(
    a.pos[0] + (b.pos[0] - a.pos[0]) * e,
    a.pos[1] + (b.pos[1] - a.pos[1]) * e,
    a.pos[2] + (b.pos[2] - a.pos[2]) * e,
  )
  const look = new Vector3(
    a.look[0] + (b.look[0] - a.look[0]) * e,
    a.look[1] + (b.look[1] - a.look[1]) * e,
    a.look[2] + (b.look[2] - a.look[2]) * e,
  )
  return { pos, look }
}

async function loadPlanet(
  url: string,
  radius: number,
  roughness = 0.9,
): Promise<{ mesh: Mesh; texture: Texture }> {
  const loader = new TextureLoader()
  const texture = await loader.loadAsync(url)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  const material = new MeshStandardMaterial({
    map: texture,
    roughness,
    metalness: 0.05,
  })
  const mesh = new Mesh(new SphereGeometry(radius, 48, 32), material)
  return { mesh: markRaw(mesh), texture: markRaw(texture) }
}

function makeSoftPlane(
  texture: Texture,
  width: number,
  height: number,
  opacity: number,
) {
  texture.colorSpace = SRGBColorSpace
  texture.premultiplyAlpha = true
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  const mesh = new Mesh(new PlaneGeometry(width, height), material)
  mesh.renderOrder = -8
  mesh.frustumCulled = false
  return { mesh: markRaw(mesh), material }
}

export function createAboutRig() {
  const scene = markRaw(new Scene())
  scene.background = new Color(0x03050a)

  const ambient = new AmbientLight(0xb8c4ff, 0.55)
  const sun = new DirectionalLight(0xfff2dd, 1.35)
  sun.position.set(12, 8, 6)
  scene.add(ambient, sun)

  const root = markRaw(new Group())
  scene.add(root)

  const lookTarget = markRaw(new Vector3())
  const disposables: Array<{ dispose: () => void }> = []
  const softPlanes: Mesh[] = []
  let sky: Mesh | null = null
  let probe: Sprite | null = null
  let ready = false

  async function load() {
    if (ready) return
    const loader = new TextureLoader()
    const [earth, moon, mars, milkyWay, nebulaCloud, nebulaPastel, probeTex] =
      await Promise.all([
        loadPlanet(earthUrl, 2.2),
        loadPlanet(moonUrl, 0.55),
        loadPlanet(marsUrl, 1.15),
        loader.loadAsync(milkyWayUrl),
        loader.loadAsync(nebulaCloudUrl),
        loader.loadAsync(nebulaPastelUrl),
        loader.loadAsync(probeUrl),
      ])

    // Fondo completo: Vía Láctea 8k en skybox.
    milkyWay.colorSpace = SRGBColorSpace
    milkyWay.anisotropy = 4
    const skyMat = new MeshBasicMaterial({
      map: milkyWay,
      side: FrontSide,
      depthWrite: false,
      toneMapped: false,
    })
    sky = new Mesh(new SphereGeometry(180, 48, 28), skyMat)
    sky.geometry.scale(-1, 1, 1)
    sky.frustumCulled = false
    sky.renderOrder = -20
    scene.add(sky)
    disposables.push(sky.geometry, skyMat, milkyWay)

    /**
     * Nebulosas: muy grandes y más atrás para que, al cargar (cámara en z≈14),
     * el borde rectangular del PNG quede fuera del FOV y solo se vea el centro suave.
     */
    const hero = makeSoftPlane(nebulaCloud, 64, 44, 0.82)
    hero.mesh.position.set(0, -2.2, -14)

    const sideA = makeSoftPlane(nebulaPastel, 48, 34, 0.72)
    sideA.mesh.position.set(18, 1.2, -22)

    const sideB = makeSoftPlane(nebulaCloud, 52, 36, 0.68)
    sideB.mesh.position.set(-16, 2.8, -30)
    sideB.mesh.scale.set(-1.05, 1.05, 1)

    const deep = makeSoftPlane(nebulaPastel, 46, 32, 0.62)
    deep.mesh.position.set(6, 0.6, -42)

    const planes = [hero.mesh, sideA.mesh, sideB.mesh, deep.mesh]
    root.add(...planes)
    softPlanes.push(...planes)

    disposables.push(hero.mesh.geometry, hero.material, nebulaCloud)
    disposables.push(sideA.mesh.geometry, sideA.material, nebulaPastel)
    disposables.push(sideB.mesh.geometry, sideB.material)
    disposables.push(deep.mesh.geometry, deep.material)

    earth.mesh.position.set(0, 0, 0)
    moon.mesh.position.set(3.4, 0.6, 1.2)
    mars.mesh.position.set(-4.5, 1.2, -14)
    root.add(earth.mesh, moon.mesh, mars.mesh)
    disposables.push(earth.mesh.geometry, earth.mesh.material as MeshStandardMaterial, earth.texture)
    disposables.push(moon.mesh.geometry, moon.mesh.material as MeshStandardMaterial, moon.texture)
    disposables.push(mars.mesh.geometry, mars.mesh.material as MeshStandardMaterial, mars.texture)

    probeTex.colorSpace = SRGBColorSpace
    const probeMat = new SpriteMaterial({
      map: probeTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    probe = new Sprite(probeMat)
    probe.scale.set(4.2, 4.2, 1)
    probe.position.set(1.5, 1.4, -38)
    root.add(probe)
    disposables.push(probeMat, probeTex)

    ready = true
  }

  function applyScroll(camera: PerspectiveCamera, progress: number) {
    const pose = lerpKeys(progress)
    camera.position.copy(pose.pos)
    lookTarget.copy(pose.look)
    camera.lookAt(lookTarget)
  }

  function update(time: number, progress: number, camera: Camera) {
    const spin = time * 0.12
    for (const child of root.children) {
      if ((child as Mesh).isMesh && !softPlanes.includes(child as Mesh)) {
        child.rotation.y = spin * (child.position.z < -10 ? 0.35 : 0.55)
      }
    }

    if (sky) {
      sky.position.copy(camera.position)
      sky.rotation.y = time * 0.004
    }

    // Solo yaw hacia la cámara: no inclinar el plano (eso revelaba el borde superior del PNG).
    for (const plane of softPlanes) {
      plane.lookAt(camera.position.x, plane.position.y, camera.position.z)
    }

    if (probe) {
      const reveal = smoothstep(0.72, 0.88, progress)
      ;(probe.material as SpriteMaterial).opacity = 0.35 + reveal * 0.65
      probe.position.y = 1.4 + Math.sin(time * 0.9) * 0.15
    }
  }

  function dispose() {
    for (const item of disposables) item.dispose?.()
    scene.clear()
  }

  return {
    scene,
    lookTarget,
    load,
    applyScroll,
    update,
    dispose,
  }
}

export type AboutRig = ReturnType<typeof createAboutRig>
