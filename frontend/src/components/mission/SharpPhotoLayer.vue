<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { panstarrsColorJpeg } from '@/services/panstarrs'

const props = defineProps<{
  ra: number
  dec: number
  fovDeg: number
  aspect: number
  enabled: boolean
}>()

/** Solo cuando el campo ya cabe en píxeles reales de PanSTARRS (0.25″). */
const SHOW_BELOW_DEG = 0.1

const src = ref<string | null>(null)
const ready = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let token = 0

const active = computed(
  () =>
    props.enabled &&
    props.dec >= -30 &&
    Number.isFinite(props.ra) &&
    Number.isFinite(props.dec) &&
    Number.isFinite(props.fovDeg) &&
    props.fovDeg > 0 &&
    props.fovDeg <= SHOW_BELOW_DEG,
)

async function load() {
  if (!active.value) {
    ready.value = false
    return
  }
  const aspect = Number.isFinite(props.aspect) && props.aspect > 0 ? props.aspect : 1.6
  const longDeg = props.fovDeg * Math.max(aspect, 1 / aspect)
  // Un píxel de la foto = 0.25″. Sin ampliar más, no salen bloques.
  const sizePx = Math.round((longDeg * 3600) / 0.25)
  const my = ++token
  try {
    const url = await panstarrsColorJpeg(props.ra, props.dec, sizePx)
    if (my !== token) return
    src.value = url
    ready.value = true
  } catch {
    if (my !== token) return
    ready.value = false
  }
}

watch(
  () => [props.ra, props.dec, props.fovDeg, props.aspect, props.enabled] as const,
  () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void load(), ready.value ? 450 : 40)
  },
  { immediate: true },
)

onUnmounted(() => {
  token += 1
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div v-show="active && ready && src" class="sharp">
    <img :src="src || undefined" alt="" draggable="false" />
  </div>
</template>

<style scoped>
.sharp {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.sharp img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: auto;
}
</style>
