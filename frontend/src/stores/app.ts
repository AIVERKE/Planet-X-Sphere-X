import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const drawerOpen = ref(true)

  function toggleDrawer() {
    drawerOpen.value = !drawerOpen.value
  }

  return { drawerOpen, toggleDrawer }
})
