import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Project from '../models/Project'
import { storage } from '../utils/storage'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const projectCount = computed(() => projects.value.length)
  const hasProjects = computed(() => projects.value.length > 0)

  // 从本地存储加载项目
  async function loadProjects() {
    isLoading.value = true
    error.value = null
    try {
      const savedProjects = await storage.get('projects')
      if (savedProjects && Array.isArray(savedProjects)) {
        projects.value = savedProjects.map(p => Project.fromJSON(p))
      }
    } catch (e) {
      error.value = e.message
      console.error('Failed to load projects:', e)
    } finally {
      isLoading.value = false
    }
  }

  // 保存项目到本地存储
  async function saveProjects() {
    try {
      const projectsData = projects.value.map(p => p.toJSON())
      await storage.set('projects', projectsData)
    } catch (e) {
      error.value = e.message
      console.error('Failed to save projects:', e)
    }
  }

  // 添加新项目
  function addProject(projectData) {
    const project = new Project(projectData)
    projects.value.push(project)
    saveProjects()
    return project
  }

  // 更新项目
  function updateProject(projectId, data) {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index !== -1) {
      projects.value[index].update(data)
      saveProjects()
      return projects.value[index]
    }
    return null
  }

  // 删除项目
  function removeProject(projectId) {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index !== -1) {
      projects.value.splice(index, 1)
      saveProjects()
      return true
    }
    return false
  }

  // 获取项目
  function getProject(projectId) {
    return projects.value.find(p => p.id === projectId)
  }

  // 初始化
  loadProjects()

  return {
    projects,
    isLoading,
    error,
    projectCount,
    hasProjects,
    loadProjects,
    saveProjects,
    addProject,
    updateProject,
    removeProject,
    getProject
  }
})
