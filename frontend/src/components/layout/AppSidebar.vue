<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import type { NavItem } from '@/types'

const app = useAppStore()

const items: NavItem[] = [
  { title: 'Inicio', to: '/', icon: 'mdi-home-outline' },
]
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
