<script setup>
import { onMounted, ref } from 'vue'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const status = ref('checking...')
const error = ref(null)

async function checkHealth() {
  error.value = null
  status.value = 'checking...'
  try {
    const response = await fetch(`${apiUrl}/health`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    status.value = data.status
  } catch (err) {
    status.value = 'unreachable'
    error.value = err.message
  }
}

onMounted(checkHealth)
</script>

<template>
  <main class="app">
    <h1>Planet-X Sphere-X</h1>
    <p>
      Backend (<code>{{ apiUrl }}</code>):
      <strong :class="status === 'ok' ? 'ok' : 'ko'">{{ status }}</strong>
    </p>
    <p v-if="error" class="ko">{{ error }}</p>
    <button type="button" @click="checkHealth">Retry</button>
  </main>
</template>

<style scoped>
.app {
  font-family: system-ui, sans-serif;
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1rem;
  text-align: center;
}
.ok {
  color: #16a34a;
}
.ko {
  color: #dc2626;
}
</style>
