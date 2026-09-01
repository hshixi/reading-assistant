import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 模式：生产环境以 file:// 加载静态资源时无历史模式问题。
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'shelf',
      component: () => import('@/views/ShelfView.vue'),
    },
    {
      path: '/reader/:bookId',
      name: 'reader',
      component: () => import('@/views/ReaderView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

export default router
