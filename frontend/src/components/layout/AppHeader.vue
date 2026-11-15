<script setup lang="ts">
import LanguageToggle from '@/components/common/LanguageToggle.vue'
import { useI18n } from '@/composables/useI18n'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const { m } = useI18n()
</script>

<template>
  <v-app-bar flat color="primary" density="comfortable">
    <v-app-bar-nav-icon
      :aria-label="m.panel.openMenu"
      @click="app.toggleDrawer()"
    />
    <v-toolbar-title class="font-weight-bold">MOF</v-toolbar-title>
    <v-spacer />
    <LanguageToggle class="mr-4" />
  </v-app-bar>
</template>
