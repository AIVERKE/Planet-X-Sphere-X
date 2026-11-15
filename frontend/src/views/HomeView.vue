<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

const { m } = useI18n()
</script>

<template>
  <section>
    <h1 class="text-h4 font-weight-bold mb-2">{{ m.panel.homeTitle }}</h1>
    <p class="text-body-1 text-medium-emphasis">
      {{ m.panel.homeBody }}
    </p>
  </section>
</template>
