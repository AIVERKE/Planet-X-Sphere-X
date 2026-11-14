import {
  FrontSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type DataTexture,
  type WebGLRenderer,
} from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { markRaw } from 'vue'
import landscapeUrl from '@/assets/images/rogland_clear_night_4k.exr?url'

export async function loadQwantaniSky(_renderer: WebGLRenderer) {
  const loader = new EXRLoader()
  const texture = (await loader.loadAsync(landscapeUrl)) as DataTexture
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true

  const material = new ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: 1 },
      uExposure: { value: 1.45 },
      uLift: { value: 0.07 },
      uHighlight: { value: 0.42 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform float uExposure;
      uniform float uLift;
      uniform float uHighlight;
      varying vec2 vUv;

      void main() {
        vec3 hdr = texture2D(uMap, vUv).rgb * uExposure;
        float lum = max(max(hdr.r, hdr.g), hdr.b);
        float compressed = lum / (1.0 + max(0.0, lum - 1.2) * uHighlight);
        hdr *= lum > 1e-4 ? compressed / lum : 1.0;
        vec3 ldr = hdr / (hdr + vec3(0.82));
        ldr = pow(max(ldr, vec3(0.0)), vec3(0.96));
        ldr = ldr + uLift * (1.0 - ldr);
        gl_FragColor = vec4(clamp(ldr, 0.0, 1.0), uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    toneMapped: false,
  })

  const mesh = new Mesh(new SphereGeometry(90, 32, 20), material)
  mesh.geometry.scale(-1, 1, 1)
  mesh.frustumCulled = false
  mesh.renderOrder = -20
  mesh.name = 'landscape-sky'

  return {
    mesh: markRaw(mesh),
    material,
    texture,
    setOpacity(value: number) {
      const opacity = Math.min(1, Math.max(0, value))
      material.uniforms.uOpacity.value = opacity
      mesh.visible = opacity > 0.01
    },
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}

export type QwantaniSky = Awaited<ReturnType<typeof loadQwantaniSky>>
