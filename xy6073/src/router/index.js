import { createRouter, createWebHashHistory } from 'vue-router'
import Index from '@/pages/index/index.vue'
import AddFood from '@/pages/add-food/add-food.vue'
import Recipe from '@/pages/recipe/recipe.vue'
import Manage from '@/pages/manage/manage.vue'

const routes = [
  {
    path: '/',
    redirect: '/index'
  },
  {
    path: '/index',
    name: 'Index',
    component: Index,
    meta: { title: '冰箱小管家' }
  },
  {
    path: '/add-food',
    name: 'AddFood',
    component: AddFood,
    meta: { title: '添加食材' }
  },
  {
    path: '/recipe',
    name: 'Recipe',
    component: Recipe,
    meta: { title: '菜谱推荐' }
  },
  {
    path: '/manage',
    name: 'Manage',
    component: Manage,
    meta: { title: '食材管理' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫 - 设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }
  next()
})

export default router
