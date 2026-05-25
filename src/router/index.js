import { createRouter, createWebHashHistory } from 'vue-router'
import WelcomeView from '../views/WelcomeView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    children: [
      { path: '', name: 'welcome', component: WelcomeView },
      {
        path: 'project/:id',
        name: 'project',
        component: () => import('../views/ProjectView.vue'),
        children: [
          { path: '', name: 'knowledge', component: () => import('../views/KnowledgeView.vue') },
          { path: 'upload', name: 'upload', component: () => import('../views/UploadView.vue') },
          { path: 'chapters', name: 'chapters', component: () => import('../views/ChaptersView.vue') },
          { path: 'query', name: 'query', component: () => import('../views/QueryView.vue') },
          { path: 'graph', name: 'graph', component: () => import('../views/GraphView.vue') },
          { path: 'continue', name: 'continue', component: () => import('../views/AiContinueView.vue') },
          { path: 'tools', name: 'tools', component: () => import('../views/WritingToolsView.vue') }
        ]
      },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
