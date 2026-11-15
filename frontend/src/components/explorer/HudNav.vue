<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { useI18n } from '@/composables/useI18n'
import { useSpaceStore } from '@/stores/useSpaceStore'

const store = useSpaceStore()
const router = useRouter()
const open = ref(false)
const { m } = useI18n()

const links = computed(() => [
  { label: m.value.nav.landscape, progress: 0, phase: 1 },
  { label: m.value.nav.world, progress: 0.4, phase: 2 },
  { label: m.value.nav.space, progress: 0.6, phase: 3 },
  { label: m.value.nav.explore, progress: 0.8, phase: 4 },
  { label: m.value.nav.spherex, progress: 0.96, phase: 5 },
])

function isActive(phase: number) {
  if (store.cameraMode === 'look') return phase === 1
  return store.phase === phase
}

function go(progress: number) {
  open.value = false
  if (progress <= 0) {
    if (store.cameraMode !== 'look') store.requestDescent()
    return
  }
  if (store.cameraMode === 'look') {
    store.requestAscent()
    return
  }
  store.requestRail(progress)
}

function openAbout() {
  open.value = false
  void router.push({ name: 'about' })
}
</script>

<template>
  <header class="pointer-events-none fixed inset-x-0 top-0 z-30">
    <div
      class="flex items-center justify-between gap-4 px-5 py-5 md:px-10"
      :style="{ opacity: store.phase === 3 ? 0.7 : 1 }"
    >
      <button
        type="button"
        class="hud-text-gold pointer-events-auto text-left text-[11px] tracking-[0.2em] uppercase"
        @click="go(0)"
      >
        {{ m.brand }}
      </button>
      <nav class="pointer-events-auto hidden items-center gap-7 md:flex">
        <button
          v-for="link in links"
          :key="link.label"
          type="button"
          class="hud-underline pb-1 text-[11px] tracking-[0.24em] uppercase"
          :class="
            isActive(link.phase)
              ? 'hud-link-gold hud-underline-gold is-active'
              : 'hud-link'
          "
          @click="go(link.progress)"
        >
          {{ link.label }}
        </button>
        <button
          type="button"
          class="hud-link hud-underline pb-1 text-[11px] tracking-[0.24em] uppercase"
          @click="openAbout"
        >
          {{ m.nav.about }}
        </button>
        <LanguageToggle />
      </nav>
      <div class="pointer-events-auto flex items-center gap-4 md:hidden">
        <LanguageToggle compact />
        <button
          type="button"
          class="hud-link text-[11px] tracking-[0.24em] uppercase"
          :aria-expanded="open"
          @click="open = !open"
        >
          {{ open ? m.nav.close : m.nav.menu }}
        </button>
      </div>
    </div>

    <nav
      v-if="open"
      class="pointer-events-auto flex flex-col gap-3 px-5 pb-4 md:hidden"
    >
      <button
        v-for="link in links"
        :key="link.label"
        type="button"
        class="hud-underline w-fit pb-1 text-[12px] tracking-[0.28em] uppercase"
        :class="
          isActive(link.phase)
            ? 'hud-link-gold hud-underline-gold is-active'
            : 'hud-link'
        "
        @click="go(link.progress)"
      >
        {{ link.label }}
      </button>
      <button
        type="button"
        class="hud-link hud-underline w-fit pb-1 text-[12px] tracking-[0.28em] uppercase"
        @click="openAbout"
      >
        {{ m.nav.about }}
      </button>
    </nav>
  </header>
</template>
