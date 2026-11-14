import { Color, ShaderMaterial } from 'three'
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
  float n = fbm(vec3(vUv * 1.6, uTime * 0.01));
  float cloud = smoothstep(0.42, 0.82, n);
  float alpha = cloud * uAlpha * 0.55;
  gl_FragColor = vec4(uColor, alpha);
}
`

export function createNebulaMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uAlpha: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}
