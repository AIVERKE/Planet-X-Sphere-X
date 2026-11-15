import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: 'explorer' | 'mission' | 'home' | 'about' | 'catalog'
  }
}
