<script setup lang="ts">
export type GuideSection = {
  id: string
  title: string
  body: string
}

export type GuideTerm = {
  term: string
  meaning: string
}

defineProps<{
  open: boolean
  title: string
  lead: string
  sections: GuideSection[]
  glossaryTitle: string
  terms: GuideTerm[]
  restartLabel: string
  closeLabel: string
}>()

const emit = defineEmits<{
  close: []
  restart: []
}>()
</script>

<template>
  <aside
    v-if="open"
    class="guide"
    role="complementary"
    :aria-label="title"
  >
    <header class="guide__head">
      <div>
        <p class="guide__kicker">SPHEREx</p>
        <h2>{{ title }}</h2>
      </div>
      <button type="button" class="guide__x" :aria-label="closeLabel" @click="emit('close')">
        ×
      </button>
    </header>

    <div class="guide__body">
      <p class="guide__lead">{{ lead }}</p>

      <ol class="guide__steps">
        <li v-for="section in sections" :key="section.id">
          <strong>{{ section.title }}</strong>
          <span>{{ section.body }}</span>
        </li>
      </ol>

      <h3 class="guide__glossary-title">{{ glossaryTitle }}</h3>
      <dl class="guide__glossary">
        <div v-for="item in terms" :key="item.term" class="guide__term">
          <dt>{{ item.term }}</dt>
          <dd>{{ item.meaning }}</dd>
        </div>
      </dl>
    </div>

    <footer class="guide__foot">
      <button type="button" class="guide__btn" @click="emit('restart')">
        {{ restartLabel }}
      </button>
      <button type="button" class="guide__btn guide__btn--gold" @click="emit('close')">
        {{ closeLabel }}
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.guide {
  position: absolute;
  top: 4.6rem;
  right: 1rem;
  bottom: 4.4rem;
  z-index: 12;
  width: min(22rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(232, 196, 120, 0.4);
  background: linear-gradient(165deg, rgba(10, 18, 24, 0.96), rgba(6, 12, 16, 0.94));
  color: #f7f5f1;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
  font-family: 'Urbanist', system-ui, sans-serif;
  pointer-events: auto;
}

.guide__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.guide__kicker {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.7);
}

.guide__head h2 {
  margin: 0.2rem 0 0;
  font-size: 1.15rem;
  font-weight: 650;
}

.guide__x {
  border: 0;
  background: transparent;
  color: rgba(247, 245, 241, 0.75);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
}

.guide__body {
  flex: 1;
  overflow: auto;
  padding: 0.85rem 1rem 1rem;
}

.guide__lead {
  margin: 0 0 0.9rem;
  font-size: 0.92rem;
  line-height: 1.45;
  color: rgba(247, 245, 241, 0.88);
}

.guide__steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.75rem;
}

.guide__steps li {
  display: grid;
  gap: 0.2rem;
  padding: 0.65rem 0.7rem;
  border-left: 2px solid rgba(232, 196, 120, 0.55);
  background: rgba(255, 255, 255, 0.04);
}

.guide__steps strong {
  font-size: 0.88rem;
}

.guide__steps span {
  font-size: 0.86rem;
  line-height: 1.4;
  color: rgba(247, 245, 241, 0.8);
}

.guide__glossary-title {
  margin: 1.15rem 0 0.55rem;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 233, 184, 0.75);
  font-weight: 600;
}

.guide__glossary {
  margin: 0;
  display: grid;
  gap: 0.55rem;
}

.guide__term {
  display: grid;
  gap: 0.15rem;
}

.guide__term dt {
  font-size: 0.88rem;
  font-weight: 650;
  color: #ffe9b8;
}

.guide__term dd {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.4;
  color: rgba(247, 245, 241, 0.8);
}

.guide__foot {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.guide__btn {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  padding: 0.55rem 0.8rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.guide__btn--gold {
  border-color: rgba(232, 196, 120, 0.75);
  color: #ffe9b8;
  background: rgba(232, 196, 120, 0.16);
}
</style>
