import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'explorer',
      component: () => import('@/views/ExplorerView.vue'),
      meta: { title: 'Explorar' },
    },
    {
      path: '/mision',
      name: 'mission',
      component: () => import('@/views/MissionView.vue'),
      meta: { title: 'Misión SPHEREx' },
    },
    {
      path: '/panel',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: 'Panel' },
        },
      ],
    },
  ],
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Planet X and SPHEREx'
  document.title = `${title} · Planet X and SPHEREx`
})

export default router
