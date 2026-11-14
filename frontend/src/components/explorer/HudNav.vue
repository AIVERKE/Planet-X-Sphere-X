<script setup lang="ts">
import { ref } from 'vue'
import { useSpaceStore } from '@/stores/useSpaceStore'

const store = useSpaceStore()
const open = ref(false)

const links = [
  { label: 'Paisaje', progress: 0 },
  { label: 'Mundo', progress: 0.4 },
  { label: 'Espacio', progress: 0.6 },
  { label: 'Explorar', progress: 0.8 },
  { label: 'SPHEREx', progress: 0.96 },
]

function go(progress: number) {
  open.value = false
  if (progress <= 0 && store.cameraMode !== 'look') {
    window.location.reload()
    return
  }
  if (store.cameraMode === 'look' && progress > 0) {
    store.requestAscent()
    return
  }
  store.requestRail(progress)
}
</script>

<template>
  <header class="pointer-events-none fixed inset-x-0 top-0 z-30">
    <div
      class="flex items-center justify-between px-5 py-5 md:px-10"
      :style="{ opacity: store.phase === 3 ? 0.7 : 1 }"
    >
      <button
        type="button"
        class="hud-text pointer-events-auto text-left text-[11px] tracking-[0.2em] uppercase"
        @click="go(0)"
      >
        Planet X and SPHEREx
      </button>
      <nav class="pointer-events-auto hidden items-center gap-8 md:flex">
        <button
          v-for="link in links"
          :key="link.label"
          type="button"
          class="hud-link hud-underline pb-1 text-[11px] tracking-[0.24em] uppercase"
          @click="go(link.progress)"
        >
          {{ link.label }}
        </button>
      </nav>
      <button
        type="button"
        class="hud-link pointer-events-auto text-[11px] tracking-[0.24em] uppercase md:hidden"
        :aria-expanded="open"
        @click="open = !open"
      >
        {{ open ? 'Cerrar' : 'Menú' }}
      </button>
      <span class="pointer-events-none hidden w-[11.5rem] md:block" aria-hidden="true" />
    </div>

    <nav
      v-if="open"
      class="pointer-events-auto flex flex-col gap-3 px-5 pb-4 md:hidden"
    >
      <button
        v-for="link in links"
        :key="link.label"
        type="button"
        class="hud-link hud-underline w-fit pb-1 text-[12px] tracking-[0.28em] uppercase"
        @click="go(link.progress)"
      >
        {{ link.label }}
      </button>
    </nav>
  </header>
</template>
