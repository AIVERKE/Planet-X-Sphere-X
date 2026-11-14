import { Color, DoubleSide, ShaderMaterial } from 'three'
import { NOISE_GLSL } from './noise.glsl'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
${NOISE_GLSL}

void main() {
  vec2 uv = vUv * vec2(2.4, 1.4) + vec2(uTime * 0.012, uTime * 0.004);
  float n = fbm(vec3(uv, uTime * 0.02));
  float veil = smoothstep(0.28, 0.78, n);
  float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
  float alpha = veil * edge * uAlpha;
  gl_FragColor = vec4(uColor, alpha);
}
`

export function createFogMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uAlpha: { value: 0.28 },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
}
