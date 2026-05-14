import { createRouter, createWebHistory } from 'vue-router'
import ProjectList from '../views/ProjectList.vue'
import ProjectDetail from '../views/ProjectDetail.vue'
import WeeklyReportDetail from '../views/WeeklyReportDetail.vue'

const routes = [
    {
        path: '/',
        name: 'ProjectList',
        component: ProjectList
    },
    {
        path: '/project/:id',
        name: 'ProjectDetail',
        component: ProjectDetail
    },
    {
        path: '/report/:id',
        name: 'WeeklyReportDetail',
        component: WeeklyReportDetail
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
