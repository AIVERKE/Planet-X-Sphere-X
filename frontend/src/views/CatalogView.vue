<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CatalogOrb from '@/components/catalog/CatalogOrb.vue'
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { CATALOG_ROWS, SKY_CATALOG, type CatalogEntry, type CatalogRow } from '@/data/skyCatalog'
import { useI18n } from '@/composables/useI18n'
import { useLocaleStore } from '@/stores/useLocaleStore'
import '@/styles/explorer.css'

const router = useRouter()
const { m } = useI18n()
const locale = useLocaleStore()
const selectedId = ref<string | null>(null)

const selected = computed(() => SKY_CATALOG.find((item) => item.id === selectedId.value) ?? null)

function text(entry: CatalogEntry) {
  return entry[locale.locale]
}

function entries(row: CatalogRow) {
  return SKY_CATALOG.filter((item) => item.row === row)
}

function open(entry: CatalogEntry) {
  selectedId.value = selectedId.value === entry.id ? null : entry.id
}

function close() {
  selectedId.value = null
}

function goBack() {
  void router.push({ name: 'explorer' })
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(selectedId, (id) => {
  if (!id) return
  requestAnimationFrame(() => {
    document.getElementById('catalog-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
})

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
    <header class="catalog__bar">
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

    <main class="catalog__main">
      <p class="catalog__kicker">{{ m.catalog.kicker }}</p>
      <h1>{{ m.catalog.title }}</h1>
      <p class="catalog__lead">{{ m.catalog.lead }}</p>

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
            @click="open(entry)"
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
      <section id="catalog-detail" class="catalog__detail" role="dialog" aria-modal="true" :aria-label="text(selected).name">
        <div class="catalog__hero">
          <CatalogOrb :key="selected.id" :shape="selected.shape" :colors="selected.colors" />
        </div>
        <div class="catalog__copy">
          <p class="catalog__kicker">{{ m.catalog.rows[selected.row] }}</p>
          <h3>{{ text(selected).name }}</h3>
          <h4>{{ m.catalog.far }}</h4>
          <p>{{ text(selected).far }}</p>
          <h4>{{ m.catalog.identify }}</h4>
          <p>{{ text(selected).identify }}</p>
          <h4>{{ m.catalog.traps }}</h4>
          <ul>
            <li v-for="trap in text(selected).traps" :key="trap">{{ trap }}</li>
          </ul>
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

.catalog__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.25rem 0.5rem;
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
  padding: 0 1.25rem;
  color: #ffe9b8;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.catalog__main h1 {
  margin: 0.4rem 0 0;
  padding: 0 1.25rem;
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 500;
  letter-spacing: -0.03em;
}

.catalog__lead {
  max-width: 40rem;
  margin: 0.7rem 0 0;
  padding: 0 1.25rem 1.4rem;
  color: rgba(251, 252, 254, 0.78);
  line-height: 1.5;
}

.catalog__row h2 {
  margin: 0 0 0.7rem;
  padding: 0 1.25rem;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.catalog__scroller {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.2rem 1.25rem 1.6rem;
  scroll-snap-type: x mandatory;
}

.catalog__card {
  flex: 0 0 15rem;
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
  flex-basis: 24rem;
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
  color: rgba(251, 252, 254, 0.68);
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
  gap: 1.25rem;
  width: min(64rem, 100%);
  max-height: min(88vh, 44rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid rgba(232, 196, 120, 0.45);
  border-radius: 1rem;
  background: rgba(5, 7, 12, 0.96);
}

.catalog__detail .catalog__kicker {
  padding: 0;
}

.catalog__hero {
  min-height: 22rem;
  border-radius: 0.8rem;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(232, 196, 120, 0.12), #03050a 68%);
}

.catalog__copy h3 {
  margin: 0.25rem 0 0.8rem;
  font-size: 1.8rem;
  font-weight: 500;
}

.catalog__copy h4 {
  margin: 0.9rem 0 0.25rem;
  color: #ffe9b8;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.catalog__copy p,
.catalog__copy li {
  margin: 0;
  color: rgba(251, 252, 254, 0.84);
  line-height: 1.5;
}

.catalog__copy ul {
  margin: 0.2rem 0 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.4rem;
}

.catalog__close {
  margin-top: 1rem;
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
}

@media (max-width: 800px) {
  .catalog__detail {
    grid-template-columns: 1fr;
  }

  .catalog__hero {
    min-height: 16rem;
  }
}
</style>
