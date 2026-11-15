<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocaleStore } from '@/stores/useLocaleStore'

const route = useRoute()
const localeStore = useLocaleStore()

watch(
  [() => localeStore.locale, () => route.meta.titleKey],
  () => {
    const key = route.meta.titleKey
    const title =
      key === 'explorer' || key === 'mission' || key === 'home' || key === 'about' || key === 'catalog'
        ? localeStore.messages.routes[key]
        : localeStore.messages.brand
    document.title = `${title} · Planet X and SPHEREx`
  },
)
</script>

<template>
  <router-view />
</template>
