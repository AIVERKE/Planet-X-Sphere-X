import { createRouter, createWebHistory } from 'vue-router'
import { getMessages, readStoredLocale } from '@/i18n'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'explorer',
      component: () => import('@/views/ExplorerView.vue'),
      meta: { titleKey: 'explorer' as const },
    },
    {
      path: '/mision',
      // Alias en inglés: las URLs compartidas / embebidas pueden usar /mission?ra=&dec=&fov=
      alias: '/mission',
      name: 'mission',
      component: () => import('@/views/MissionView.vue'),
      meta: { titleKey: 'mission' as const },
    },
    {
      path: '/que-somos',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { titleKey: 'about' as const },
    },
    {
      path: '/panel',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { titleKey: 'home' as const },
        },
      ],
    },
  ],
})

function resolveRouteTitle(titleKey: unknown) {
  const messages = getMessages(readStoredLocale())
  if (
    titleKey === 'explorer' ||
    titleKey === 'mission' ||
    titleKey === 'home' ||
    titleKey === 'about'
  ) {
    return messages.routes[titleKey]
  }
  return messages.brand
}

router.afterEach((to) => {
  const title = resolveRouteTitle(to.meta.titleKey)
  document.title = `${title} · Planet X and SPHEREx`
})

export default router
