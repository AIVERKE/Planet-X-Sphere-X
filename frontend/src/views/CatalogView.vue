<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CatalogOrb from '@/components/catalog/CatalogOrb.vue'
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { CATALOG_ROWS, SKY_CATALOG, type CatalogEntry, type CatalogRow } from '@/data/skyCatalog'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useI18n } from '@/composables/useI18n'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { missionQuery } from '@/utils/catalogLink'
import '@/styles/explorer.css'

type CompareView = 'model' | 'photo'

const ONBOARDING_KEY = 'planet-x-catalog-onboarded'

const router = useRouter()
const { m } = useI18n()
const locale = useLocaleStore()

const selectedId = ref<string | null>(null)
/** Momento en que se abrió la ficha: fecha que se muestra en el CTA de efemérides. */
const openedAt = ref(new Date())
const compareView = ref<CompareView>('model')
/** Señales marcadas por entrada (solo en memoria). */
const checks = reactive<Record<string, boolean[]>>({})
const dialogEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const showOnboarding = ref(!readOnboarded())
const focusTrap = useFocusTrap(dialogEl)

const selected = computed(() => SKY_CATALOG.find((item) => item.id === selectedId.value) ?? null)

const progress = computed(() => {
  const entry = selected.value
  if (!entry) return ''
  const marks = checks[entry.id] ?? []
  return fill(m.value.catalog.identifyProgress, {
    n: String(marks.filter(Boolean).length),
    total: String(text(entry).identify.length),
  })
})

const cta = computed(() => {
  const entry = selected.value
  if (!entry || !missionQuery(entry, openedAt.value)) return null
  const copy = text(entry)
  if (entry.missionLink.kind === 'ephemeris') {
    return {
      label: fill(m.value.catalog.ctaEphemeris, { name: copy.name, date: formatDate(openedAt.value) }),
      note: m.value.catalog.ephemerisNote,
    }
  }
  return { label: fill(m.value.catalog.ctaFixed, { name: copy.example.name }), note: null }
})

function text(entry: CatalogEntry) {
  return entry[locale.locale]
}

function entries(row: CatalogRow) {
  return SKY_CATALOG.filter((item) => item.row === row)
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

function formatDate(date: Date) {
  const tag = locale.locale === 'es' ? 'es-ES' : 'en-GB'
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return false
  }
}

function dismissOnboarding() {
  showOnboarding.value = false
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    /* sin almacenamiento: el aviso volverá en la próxima visita */
  }
}

function open(entry: CatalogEntry, event: Event) {
  const opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  checks[entry.id] ??= entry.es.identify.map(() => false)
  openedAt.value = new Date()
  selectedId.value = entry.id
  void nextTick(() => focusTrap.activate(titleEl.value, opener))
}

function close() {
  if (!selectedId.value) return
  selectedId.value = null
  // Tras el render: el contenido de fondo deja de ser `inert` y puede recibir el foco.
  void nextTick(() => focusTrap.deactivate())
}

/** Júpiter se calcula ahora mismo, no al abrir la ficha. */
function openInMission(entry: CatalogEntry) {
  const to = missionQuery(entry, new Date())
  if (to) void router.push(to)
}

function goBack() {
  void router.push({ name: 'explorer' })
}

function onKey(event: KeyboardEvent) {
  if (!selectedId.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  focusTrap.onKeydown(event)
}

onMounted(() => {
  document.documentElement.classList.add('is-explorer')
  document.documentElement.classList.remove('is-look-locked')
  window.addEventListener('keydown', onKey)
  window.scrollTo(0, 0)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove('is-explorer')
})
</script>

<template>
  <div class="catalog explorer-root">
    <header class="catalog__bar" :inert="!!selected">
      <button type="button" class="hud-text-gold catalog__brand" @click="goBack">
        {{ m.brand }}
      </button>
      <div class="catalog__bar-actions">
        <span class="hud-kicker-gold catalog__mark">{{ m.nav.catalog }}</span>
        <LanguageToggle />
        <button type="button" class="hud-link hud-underline catalog__back" @click="goBack">
          {{ m.catalog.back }}
        </button>
      </div>
    </header>

    <main class="catalog__main" :inert="!!selected">
      <p class="catalog__kicker">{{ m.catalog.kicker }}</p>
      <h1>{{ m.catalog.title }}</h1>
      <p class="catalog__lead">{{ m.catalog.lead }}</p>

      <div v-if="showOnboarding" class="catalog__onboarding" role="note">
        <p>{{ m.catalog.onboarding }}</p>
        <button type="button" class="catalog__onboarding-dismiss" @click="dismissOnboarding">
          {{ m.catalog.onboardingDismiss }}
        </button>
      </div>

      <section
        v-for="row in CATALOG_ROWS"
        :key="row"
        class="catalog__row"
        :aria-label="m.catalog.rows[row]"
      >
        <h2>{{ m.catalog.rows[row] }}</h2>
        <div class="catalog__scroller">
          <button
            v-for="entry in entries(row)"
            :key="entry.id"
            type="button"
            class="catalog__card"
            :class="{ 'is-on': selectedId === entry.id }"
            aria-haspopup="dialog"
            @click="open(entry, $event)"
          >
            <span class="catalog__stage">
              <CatalogOrb :shape="entry.shape" :colors="entry.colors" />
            </span>
            <span class="catalog__name">{{ text(entry).name }}</span>
            <span class="catalog__blurb">{{ text(entry).blurb }}</span>
          </button>
        </div>
      </section>
    </main>

    <div v-if="selected" class="catalog__sheet" @click.self="close">
      <section
        id="catalog-detail"
        ref="dialogEl"
        class="catalog__detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-detail-title"
        tabindex="-1"
      >
        <div class="catalog__copy">
          <button type="button" class="catalog__x" :aria-label="m.catalog.close" @click="close">
            <span aria-hidden="true">×</span>
          </button>
          <p class="catalog__kicker">{{ m.catalog.rows[selected.row] }}</p>
          <h3 id="catalog-detail-title" ref="titleEl" tabindex="-1">{{ text(selected).name }}</h3>

          <h4>{{ m.catalog.far }}</h4>
          <p>{{ text(selected).far }}</p>

          <div class="catalog__block-head">
            <h4 id="catalog-identify">{{ m.catalog.identify }}</h4>
            <span class="catalog__progress" aria-live="polite">{{ progress }}</span>
          </div>
          <p class="catalog__hint">{{ m.catalog.identifyHint }}</p>
          <ul class="catalog__checklist" aria-labelledby="catalog-identify">
            <li v-for="(signal, index) in text(selected).identify" :key="`${selected.id}-${index}`">
              <label class="catalog__check">
                <input v-model="checks[selected.id][index]" type="checkbox" />
                <span>{{ signal }}</span>
              </label>
            </li>
          </ul>

          <h4>{{ m.catalog.traps }}</h4>
          <ul class="catalog__traps">
            <li v-for="item in text(selected).traps" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="catalog__compare">
          <h4>{{ m.catalog.compare }}</h4>
          <div class="catalog__toggle" role="group" :aria-label="m.catalog.compareGroup">
            <button type="button" :aria-pressed="compareView === 'model'" @click="compareView = 'model'">
              {{ m.catalog.compareModel }}
            </button>
            <button type="button" :aria-pressed="compareView === 'photo'" @click="compareView = 'photo'">
              {{ m.catalog.comparePhoto }}
            </button>
          </div>
          <div v-if="compareView === 'model'" class="catalog__media">
            <CatalogOrb :key="selected.id" :shape="selected.shape" :colors="selected.colors" />
          </div>
          <figure v-else class="catalog__figure">
            <div class="catalog__media">
              <img :src="selected.reference.src" :alt="text(selected).imageAlt" decoding="async" />
            </div>
            <figcaption class="catalog__credit">
              <span>{{ m.catalog.credit }}: {{ selected.reference.credit }}.</span>
              <span>
                {{ m.catalog.license }}: {{ selected.reference.license }}, {{ m.catalog.imageAdapted }}.
              </span>
              <a :href="selected.reference.page" target="_blank" rel="noopener noreferrer">
                {{ m.catalog.imageSource }}
              </a>
            </figcaption>
          </figure>
        </div>

        <div class="catalog__actions">
          <template v-if="cta">
            <h4>{{ m.catalog.search }}</h4>
            <p class="catalog__example">{{ m.catalog.example }}: {{ text(selected).example.name }}</p>
            <button type="button" class="catalog__cta" @click="openInMission(selected)">
              {{ cta.label }} <span aria-hidden="true">→</span>
            </button>
            <p v-if="cta.note" class="catalog__note">{{ cta.note }}</p>
          </template>
          <button type="button" class="catalog__close" @click="close">{{ m.catalog.close }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.catalog {
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 50% -10%, rgba(232, 196, 120, 0.14), transparent 55%),
    #03050a;
  color: #fbfcfe;
  font-family: var(--font-outfit), system-ui, sans-serif;
}

.catalog :focus-visible {
  outline: 2px solid #ffe9b8;
  outline-offset: 2px;
}

.catalog__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  padding: 1.25rem 1rem 0.5rem;
}

.catalog__brand,
.catalog__back,
.catalog__mark {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.catalog__bar-actions {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.catalog__mark {
  display: none;
}

.catalog__main {
  padding: 1.5rem 0 4rem;
}

.catalog__kicker {
  margin: 0;
  padding: 0 1rem;
  color: #ffe9b8;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.catalog__main h1 {
  margin: 0.4rem 0 0;
  padding: 0 1rem;
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 500;
  letter-spacing: -0.03em;
}

.catalog__lead {
  max-width: 40rem;
  margin: 0.7rem 0 0;
  padding: 0 1rem 1.4rem;
  color: rgba(251, 252, 254, 0.8);
  line-height: 1.5;
}

.catalog__onboarding {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  max-width: 40rem;
  margin: 0 1rem 1.4rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(232, 196, 120, 0.55);
  border-radius: 0.6rem;
  background: rgba(232, 196, 120, 0.1);
}

.catalog__onboarding p {
  flex: 1 1 14rem;
  margin: 0;
  color: #fff8e8;
  line-height: 1.45;
}

.catalog__onboarding-dismiss {
  border: 1px solid rgba(232, 196, 120, 0.75);
  border-radius: 0.4rem;
  background: transparent;
  color: #ffe9b8;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.5rem 0.8rem;
  cursor: pointer;
}

.catalog__row h2 {
  margin: 0 0 0.7rem;
  padding: 0 1rem;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.catalog__scroller {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.2rem 1rem 1.6rem;
  scroll-padding-inline: 1rem;
  scroll-snap-type: x mandatory;
}

.catalog__card {
  flex: 0 0 min(15rem, 72vw);
  scroll-snap-align: start;
  display: grid;
  grid-template-rows: 12.5rem auto auto;
  gap: 0.35rem;
  padding: 0.55rem;
  border: 1px solid rgba(232, 196, 120, 0.28);
  border-radius: 0.85rem;
  background:
    linear-gradient(180deg, rgba(232, 196, 120, 0.08), transparent 40%),
    rgba(5, 7, 12, 0.88);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.catalog__card.is-on,
.catalog__card:hover {
  border-color: rgba(232, 196, 120, 0.75);
}

.catalog__row:first-of-type .catalog__card:first-child {
  flex-basis: min(24rem, 82vw);
  grid-template-rows: 16rem auto auto;
}

.catalog__row:first-of-type .catalog__card:first-child .catalog__stage {
  height: 16rem;
}

.catalog__stage {
  display: grid;
  place-items: center;
  height: 12.5rem;
  border-radius: 0.6rem;
  overflow: hidden;
  background: radial-gradient(circle at 50% 45%, rgba(232, 196, 120, 0.08), #03050a 70%);
}

.catalog__name {
  font-size: 0.95rem;
}

.catalog__blurb {
  color: rgba(251, 252, 254, 0.72);
  font-size: 0.78rem;
  line-height: 1.35;
}

.catalog__sheet {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.72);
}

.catalog__detail {
  display: grid;
  grid-template-columns: minmax(16rem, 0.9fr) 1.2fr;
  grid-template-rows: auto 1fr;
  column-gap: 1.25rem;
  width: min(64rem, 100%);
  max-height: min(90vh, 48rem);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 1rem;
  border: 1px solid rgba(232, 196, 120, 0.45);
  border-radius: 1rem;
  background: rgba(5, 7, 12, 0.97);
}

.catalog__detail:focus {
  outline: none;
}

.catalog__detail .catalog__kicker {
  padding: 0;
}

.catalog__copy {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.catalog__copy > .catalog__kicker,
.catalog__copy > h3 {
  padding-right: 2.75rem;
}

.catalog__x {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(232, 196, 120, 0.6);
  border-radius: 50%;
  background: rgba(5, 7, 12, 0.9);
  color: #ffe9b8;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.catalog__compare {
  grid-column: 1;
  grid-row: 1 / span 2;
  align-self: start;
  position: sticky;
  top: 0;
  min-width: 0;
}

.catalog__actions {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
}

.catalog__copy h3 {
  margin: 0.25rem 0 0.8rem;
  font-size: 1.8rem;
  font-weight: 500;
}

.catalog__copy h3:focus {
  outline: none;
}

.catalog__detail h4 {
  margin: 1rem 0 0.3rem;
  color: #ffe9b8;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.catalog__compare h4 {
  margin-top: 0;
}

.catalog__detail p,
.catalog__traps li {
  margin: 0;
  color: rgba(251, 252, 254, 0.86);
  line-height: 1.5;
}

.catalog__block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.catalog__progress {
  color: #ffe9b8;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.catalog__detail .catalog__hint {
  color: rgba(251, 252, 254, 0.72);
  font-size: 0.82rem;
}

.catalog__checklist {
  display: grid;
  gap: 0.15rem;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}

.catalog__check {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.45rem;
  color: rgba(251, 252, 254, 0.88);
  line-height: 1.45;
  cursor: pointer;
}

.catalog__check:hover {
  background: rgba(232, 196, 120, 0.08);
}

/* Checkbox propio: el reset global le quita la apariencia nativa. */
.catalog__check input {
  appearance: none;
  flex: none;
  display: grid;
  place-content: center;
  width: 1.15rem;
  height: 1.15rem;
  margin: 0.15rem 0 0;
  border: 1.5px solid rgba(232, 196, 120, 0.9);
  border-radius: 0.25rem;
  background: transparent;
  cursor: pointer;
}

.catalog__check input::before {
  content: '';
  width: 0.65rem;
  height: 0.65rem;
  background: #03050a;
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
  transform: scale(0);
  transition: transform 120ms ease-out;
}

.catalog__check input:checked {
  background: #e8c478;
}

.catalog__check input:checked::before {
  transform: scale(1);
}

.catalog__check input:checked + span {
  color: #fff8e8;
}

.catalog__traps {
  display: grid;
  gap: 0.4rem;
  margin: 0.2rem 0 0;
  padding-left: 1.1rem;
}

.catalog__toggle {
  display: inline-flex;
  margin-bottom: 0.6rem;
  border: 1px solid rgba(232, 196, 120, 0.55);
  border-radius: 0.5rem;
  overflow: hidden;
}

.catalog__toggle button {
  border: 0;
  background: transparent;
  color: rgba(251, 252, 254, 0.86);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
}

.catalog__toggle button + button {
  border-left: 1px solid rgba(232, 196, 120, 0.55);
}

.catalog__toggle button[aria-pressed='true'] {
  background: rgba(232, 196, 120, 0.22);
  color: #fff8e8;
}

.catalog__toggle button:focus-visible {
  outline-offset: -3px;
}

.catalog__figure {
  margin: 0;
}

.catalog__media {
  height: clamp(16rem, 44vh, 24rem);
  border-radius: 0.8rem;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(232, 196, 120, 0.12), #03050a 68%);
}

.catalog__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.catalog__credit {
  display: grid;
  gap: 0.15rem;
  margin-top: 0.45rem;
  color: rgba(251, 252, 254, 0.78);
  font-size: 0.72rem;
  line-height: 1.4;
}

.catalog__credit a {
  color: #ffe9b8;
  justify-self: start;
}

.catalog__detail .catalog__example {
  color: rgba(251, 252, 254, 0.78);
  font-size: 0.85rem;
}

.catalog__cta {
  margin-top: 0.6rem;
  border: 1px solid rgba(232, 196, 120, 0.9);
  border-radius: 0.45rem;
  background: rgba(232, 196, 120, 0.24);
  color: #fff8e8;
  font-size: 0.9rem;
  padding: 0.7rem 1rem;
  text-align: left;
  cursor: pointer;
}

.catalog__cta:hover {
  background: rgba(232, 196, 120, 0.34);
}

.catalog__detail .catalog__note {
  margin-top: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-left: 2px solid rgba(232, 196, 120, 0.7);
  background: rgba(232, 196, 120, 0.07);
  color: rgba(251, 252, 254, 0.84);
  font-size: 0.82rem;
}

.catalog__close {
  display: block;
  margin-top: 1.1rem;
  border: 1px solid rgba(232, 196, 120, 0.7);
  background: rgba(232, 196, 120, 0.14);
  color: #ffe9b8;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.72rem;
  padding: 0.55rem 0.8rem;
  border-radius: 0.4rem;
  cursor: pointer;
}

@media (min-width: 800px) {
  .catalog__mark {
    display: inline;
  }

  .catalog__bar {
    padding-inline: 1.25rem;
  }

  .catalog__kicker,
  .catalog__main h1,
  .catalog__lead,
  .catalog__row h2 {
    padding-inline: 1.25rem;
  }

  .catalog__onboarding {
    margin-inline: 1.25rem;
  }

  .catalog__scroller {
    padding-inline: 1.25rem;
    scroll-padding-inline: 1.25rem;
  }
}

@media (max-width: 800px) {
  .catalog__sheet {
    place-items: stretch;
    padding: 0;
  }

  .catalog__detail {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    border-radius: 0;
    background: #05070c;
  }

  .catalog__copy,
  .catalog__compare,
  .catalog__actions {
    grid-column: 1;
    grid-row: auto;
  }

  .catalog__compare {
    position: static;
    margin-top: 1rem;
  }

  .catalog__media {
    height: 16rem;
  }

  .catalog__actions {
    padding-bottom: 1rem;
  }
}
</style>
