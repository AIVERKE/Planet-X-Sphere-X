import { onMounted, onUnmounted, ref } from 'vue'
import themeUrl from '@/assets/musica/Interstellar Main Theme.mp3?url'

const VOLUME = 0.38

/**
 * Música de fondo del recorrido explorador.
 * No se usa en /mision (atlas): al salir de ExplorerView se detiene sola.
 */
export function useExplorerMusic() {
  const playing = ref(false)
  let audio: HTMLAudioElement | null = null
  let unlocked = false

  function ensureAudio() {
    if (audio) return audio
    audio = new Audio(themeUrl)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = VOLUME
    return audio
  }

  async function play() {
    const el = ensureAudio()
    try {
      await el.play()
      playing.value = true
      unlocked = true
    } catch {
      playing.value = false
    }
  }

  function pause() {
    if (!audio) return
    audio.pause()
    playing.value = false
  }

  function stop() {
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    playing.value = false
  }

  function unlockFromGesture() {
    if (unlocked && playing.value) return
    void play()
  }

  function onVisibility() {
    if (document.hidden) {
      pause()
      return
    }
    if (unlocked) void play()
  }

  onMounted(() => {
    ensureAudio()
    void play()
    window.addEventListener('pointerdown', unlockFromGesture, { passive: true })
    window.addEventListener('keydown', unlockFromGesture)
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    window.removeEventListener('pointerdown', unlockFromGesture)
    window.removeEventListener('keydown', unlockFromGesture)
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
    audio = null
  })

  return { playing, play, pause, stop }
}
