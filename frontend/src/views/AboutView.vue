<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import AboutCanvas from '@/components/about/AboutCanvas.vue'
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { aboutSections } from '@/data/aboutSections'
import { useI18n } from '@/composables/useI18n'
import { fadeWindow } from '@/utils/fadeWindow'
import '@/styles/explorer.css'

gsap.registerPlugin(ScrollTrigger)

const router = useRouter()
const { m } = useI18n()
const stage = ref<HTMLElement | null>(null)
const progress = ref(0)
let trigger: ScrollTrigger | null = null

const activeIndex = computed(() => {
  const p = progress.value
  let best = 0
  for (let i = 0; i < aboutSections.length; i += 1) {
    if (p >= aboutSections[i].copyStart) best = i
  }
  return best
})

const activeSection = computed(() => aboutSections[activeIndex.value])

function sectionOpacity(id: string) {
  const section = aboutSections.find((item) => item.id === id)
  if (!section) return 0
  return fadeWindow(progress.value, section.copyStart, section.copyEnd)
}

function sectionCopy(id: string) {
  return m.value.about.sections[id]
}

function goBack() {
  void router.push({ name: 'explorer' })
}

function goCatalog() {
  void router.push({ name: 'catalog' })
}

function jumpTo(sectionProgress: number) {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  window.scrollTo({ top: max * sectionProgress, behavior: 'smooth' })
}

function goSection(delta: number) {
  const next = Math.min(
    aboutSections.length - 1,
    Math.max(0, activeIndex.value + delta),
  )
  if (next === activeIndex.value) return
  jumpTo(aboutSections[next].cameraAt)
}

function onKey(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    goSection(1)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    goSection(-1)
  }
}

onMounted(() => {
  document.documentElement.classList.add('is-explorer')
  document.documentElement.classList.remove('is-look-locked')
  window.scrollTo(0, 0)
  window.addEventListener('keydown', onKey)

  if (!stage.value) return
  trigger = ScrollTrigger.create({
    trigger: stage.value,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.65,
    onUpdate: (self) => {
      progress.value = self.progress
    },
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  trigger?.kill()
  trigger = null
  document.documentElement.classList.remove('is-explorer')
})
</script>

<template>
  <div class="about-root explorer-root text-white">
    <AboutCanvas :progress="progress" />

    <div class="pointer-events-none fixed inset-0 z-10">
      <div class="explorer-vignette" />

      <header class="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div class="flex items-center justify-between gap-3 px-4 py-5 sm:gap-4 sm:px-6 md:px-10">
          <button
            type="button"
            class="hud-text-gold pointer-events-auto max-w-[42vw] truncate text-left text-[11px] tracking-[0.18em] uppercase sm:max-w-none sm:text-[12px] md:text-[13px]"
            @click="goBack"
          >
            {{ m.brand }}
          </button>
          <div class="pointer-events-auto flex shrink-0 items-center gap-3 sm:gap-5">
            <span class="hud-kicker-gold hidden text-[12px] tracking-[0.24em] uppercase md:inline md:text-[13px]">
              {{ m.about.brand }}
            </span>
            <LanguageToggle />
            <button
              type="button"
              class="hud-link hud-underline max-w-[34vw] truncate pb-1 text-[11px] tracking-[0.18em] uppercase sm:max-w-none sm:text-[12px] md:text-[13px]"
              @click="goBack"
            >
              {{ m.about.back }}
            </button>
          </div>
        </div>
      </header>

      <nav
        class="pointer-events-none fixed top-1/2 left-4 z-20 hidden w-[10rem] -translate-y-1/2 flex-col gap-2 lg:left-8 lg:flex lg:w-[11.5rem]"
        aria-label="Secciones"
      >
        <button
          v-for="(section, index) in aboutSections"
          :key="section.id"
          type="button"
          class="pointer-events-auto flex items-center gap-2.5 text-left"
          @click="jumpTo(section.cameraAt)"
        >
          <span
            class="hud-diamond block h-1.5 w-1.5 shrink-0 rotate-45 border transition"
            :class="
              activeIndex === index
                ? 'border-[var(--hud-gold)] bg-[var(--hud-gold)]/80'
                : 'border-white/35 bg-transparent'
            "
          />
          <span
            class="truncate text-[10px] tracking-[0.16em] uppercase transition lg:text-[11px]"
            :class="
              activeIndex === index
                ? 'hud-link-gold hud-underline hud-underline-gold is-active'
                : 'hud-text-muted'
            "
          >
            {{ section.index }} {{ sectionCopy(section.id)?.name }}
          </span>
        </button>
      </nav>

      <div
        class="pointer-events-none fixed top-20 left-4 z-20 flex items-center gap-3 sm:top-24 lg:hidden"
        :style="{ opacity: Math.max(sectionOpacity(activeSection.id), 0.55) }"
      >
        <span class="hud-diamond block h-2 w-2 rotate-45 border" aria-hidden="true" />
        <div>
          <p class="hud-kicker-gold text-[11px] tracking-[0.28em]">{{ activeSection.index }}</p>
          <p class="hud-text text-[13px] tracking-[0.2em] uppercase sm:text-[14px]">
            {{ sectionCopy(activeSection.id)?.name }}
          </p>
        </div>
      </div>

      <!-- Columna única: tipografía contenida + scroll si no cabe en el viewport -->
      <section
        v-for="section in aboutSections"
        :key="section.id"
        class="pointer-events-none fixed inset-x-0 top-0 bottom-0 z-10 flex items-start justify-center overflow-hidden px-4 pt-[9vh] pb-24 sm:px-8 sm:pt-[10vh] lg:justify-start lg:pl-[14rem] lg:pr-10"
        :style="{ opacity: sectionOpacity(section.id) }"
        :aria-hidden="sectionOpacity(section.id) < 0.08"
      >
        <div
          class="about-copy-panel hud-panel hud-panel--soft flex w-full max-w-[min(92vw,34rem)] flex-col gap-3 overflow-y-auto overscroll-contain p-4 sm:gap-3.5 sm:p-5 lg:max-w-[min(48vw,36rem)]"
        >
          <p class="hud-kicker-gold shrink-0 text-[10px] tracking-[0.32em] uppercase">
            {{ section.index }} · {{ sectionCopy(section.id)?.name }}
          </p>
          <h2
            class="hud-text-gold shrink-0 text-[clamp(22px,3.6vw,44px)] leading-[1.12] font-medium tracking-[0.08em] uppercase break-words"
          >
            {{ sectionCopy(section.id)?.title }}
          </h2>
          <p
            class="hud-text-muted max-w-[38rem] shrink-0 border-l border-[var(--hud-gold-border)] pl-3.5 text-[14px] leading-relaxed sm:text-[15px] md:text-[16px]"
          >
            {{ sectionCopy(section.id)?.body }}
          </p>
          <ul
            v-if="sectionCopy(section.id)?.points?.length"
            class="max-w-[38rem] shrink-0 space-y-2.5 pb-1"
          >
            <li
              v-for="point in sectionCopy(section.id)?.points"
              :key="point"
              class="hud-text flex items-start gap-3 text-[13px] leading-snug tracking-[0.02em] sm:text-[14px] md:text-[15px]"
            >
              <span
                class="hud-diamond mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 border bg-[var(--hud-gold)]/70"
              />
              <span class="min-w-0 break-words">{{ point }}</span>
            </li>
          </ul>
          <button
            v-if="section.id === 'cierre'"
            type="button"
            class="hud-panel pointer-events-auto mt-2 inline-flex w-fit items-center gap-3 border border-[var(--hud-gold-border)] px-4 py-2.5 text-left transition hover:bg-white/5"
            @click="goCatalog"
          >
            <span class="hud-diamond h-1.5 w-1.5 rotate-45 border bg-[var(--hud-gold)]/80" aria-hidden="true" />
            <span class="hud-text-gold text-[12px] tracking-[0.22em] uppercase sm:text-[13px]">
              {{ m.about.catalogCta }}
            </span>
          </button>
        </div>
      </section>

      <div
        class="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex items-center justify-center gap-4 px-4 sm:bottom-8"
      >
        <button
          type="button"
          class="hud-panel pointer-events-auto flex h-10 w-10 items-center justify-center border border-[var(--hud-gold-border)] text-[var(--hud-gold)] transition hover:bg-white/5 disabled:opacity-30"
          :disabled="activeIndex <= 0"
          aria-label="Anterior"
          @click="goSection(-1)"
        >
          <span aria-hidden="true" class="text-lg tracking-normal">←</span>
        </button>

        <div class="min-w-[10rem] text-center">
          <p class="hud-kicker-gold text-[11px] tracking-[0.28em] uppercase sm:text-[12px]">
            {{ activeSection.index }} / {{ String(aboutSections.length).padStart(2, '0') }}
          </p>
          <p
            v-show="progress < 0.08"
            class="hud-text-muted mt-1 text-[11px] tracking-[0.2em] uppercase"
          >
            {{ m.about.scrollHint }}
          </p>
        </div>

        <button
          type="button"
          class="hud-panel pointer-events-auto flex h-10 w-10 items-center justify-center border border-[var(--hud-gold-border)] text-[var(--hud-gold)] transition hover:bg-white/5 disabled:opacity-30"
          :disabled="activeIndex >= aboutSections.length - 1"
          aria-label="Siguiente"
          @click="goSection(1)"
        >
          <span aria-hidden="true" class="text-lg tracking-normal">→</span>
        </button>
      </div>

      <div
        class="hud-meter fixed right-5 bottom-24 hidden h-28 w-px md:block"
        aria-hidden="true"
      >
        <div class="hud-meter__fill w-px" :style="{ height: `${progress * 100}%` }" />
      </div>
    </div>

    <div ref="stage" class="relative h-[1080vh]" aria-hidden="true" />
  </div>
</template>

<style scoped>
.about-copy-panel {
  max-height: min(78vh, calc(100dvh - 7.5rem));
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(232, 196, 120, 0.45) transparent;
}

.about-copy-panel::-webkit-scrollbar {
  width: 4px;
}

.about-copy-panel::-webkit-scrollbar-thumb {
  background: rgba(232, 196, 120, 0.4);
  border-radius: 999px;
}

@media (max-height: 720px) {
  .about-copy-panel {
    max-height: min(82vh, calc(100dvh - 5.5rem));
  }
}
</style>
