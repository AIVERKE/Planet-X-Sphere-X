<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

<template>
  <v-app-bar flat color="primary" density="comfortable">
    <v-app-bar-nav-icon
      aria-label="Abrir o cerrar menú"
      @click="app.toggleDrawer()"
    />
    <v-toolbar-title class="font-weight-bold">MOF</v-toolbar-title>
    <v-spacer />
  </v-app-bar>
</template>
