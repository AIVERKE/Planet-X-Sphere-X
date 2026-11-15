<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useAppStore } from '@/stores/app'
import type { NavItem } from '@/types'

const app = useAppStore()
const { m } = useI18n()

const items = computed<NavItem[]>(() => [
  { title: m.value.panel.navHome, to: '/', icon: 'mdi-home-outline' },
])
</script>

<template>
  <v-navigation-drawer
    v-model="app.drawerOpen"
    color="surface"
    width="260"
  >
    <v-list nav density="comfortable">
      <v-list-item
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.title"
        rounded="lg"
        color="secondary"
      />
    </v-list>
  </v-navigation-drawer>
</template>
