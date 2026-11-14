import { Color, ShaderMaterial, BackSide, AdditiveBlending } from 'three'

const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
uniform vec3 uAtmosphereColor;
uniform float uPower;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - clamp(dot(viewDir, normalize(vNormal)), 0.0, 1.0), uPower);
  gl_FragColor = vec4(uAtmosphereColor, fresnel);
}
`

export function createFresnelMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: {
      uAtmosphereColor: { value: new Color(color) },
      uPower: { value: 2.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}
