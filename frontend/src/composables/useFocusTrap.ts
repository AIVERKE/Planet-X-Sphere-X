import type { Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Trampa de foco para diálogos modales hechos a mano.
 *
 * - `activate(initial, opener)`: recuerda quién abrió y enfoca `initial` (p. ej. el título).
 * - `onKeydown`: pásale los `keydown`; cicla Tab / Shift+Tab dentro del contenedor.
 * - `deactivate()`: devuelve el foco a quien abrió, si sigue en el documento.
 */
export function useFocusTrap(container: Ref<HTMLElement | null>) {
  let origin: HTMLElement | null = null

  function focusables(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0,
    )
  }

  function activate(initial?: HTMLElement | null, opener?: HTMLElement | null) {
    const active = document.activeElement
    origin = opener ?? (active instanceof HTMLElement ? active : null)
    const target = initial ?? focusables()[0] ?? container.value
    target?.focus({ preventScroll: true })
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return
    const root = container.value
    if (!root) return
    const items = focusables()
    if (!items.length) {
      event.preventDefault()
      root.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const index = items.indexOf(document.activeElement as HTMLElement)
    // Fuera de la lista (título con tabindex=-1, el propio contenedor o fuera del diálogo).
    if (index === -1) {
      event.preventDefault()
      ;(event.shiftKey ? last : first)?.focus()
    } else if (event.shiftKey && index === 0) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && index === items.length - 1) {
      event.preventDefault()
      first?.focus()
    }
  }

  function deactivate() {
    const target = origin
    origin = null
    if (target?.isConnected) target.focus({ preventScroll: true })
  }

  return { activate, deactivate, onKeydown }
}
