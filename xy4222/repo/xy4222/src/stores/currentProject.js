import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useProjectsStore } from './projects'
import ArtifactImage from '../models/ArtifactImage'

export const useCurrentProjectStore = defineStore('currentProject', () => {
  const projectsStore = useProjectsStore()
  
  const currentProjectId = ref(null)
  const selectedImageId = ref(null)
  const isSaving = ref(false)

  const currentProject = computed(() => {
    if (!currentProjectId.value) return null
    return projectsStore.getProject(currentProjectId.value)
  })

  const selectedImage = computed(() => {
    if (!selectedImageId.value || !currentProject.value) return null
    return currentProject.value.getImage(selectedImageId.value)
  })

  const projectImages = computed(() => {
    if (!currentProject.value) return []
    return currentProject.value.images
  })

  const hasImages = computed(() => {
    return currentProject.value?.hasImages || false
  })

  const imageCount = computed(() => {
    return currentProject.value?.imageCount || 0
  })

  const annotationCount = computed(() => {
    return currentProject.value?.annotationCount || 0
  })

  // 设置当前项目
  function setCurrentProject(projectId) {
    currentProjectId.value = projectId
    selectedImageId.value = null
  }

  // 清除当前项目
  function clearCurrentProject() {
    currentProjectId.value = null
    selectedImageId.value = null
  }

  // 选择图片
  function selectImage(imageId) {
    selectedImageId.value = imageId
  }

  // 清除图片选择
  function clearImageSelection() {
    selectedImageId.value = null
  }

  // 添加图片到当前项目
  function addImage(imageData) {
    if (!currentProject.value) return null
    
    const image = new ArtifactImage(imageData)
    image.projectId = currentProjectId.value
    
    const addedImage = currentProject.value.addImage(image)
    projectsStore.saveProjects()
    return addedImage
  }

  // 批量添加图片
  function addImages(imagesData) {
    if (!currentProject.value) return []
    
    const addedImages = []
    imagesData.forEach(imageData => {
      const image = new ArtifactImage(imageData)
      image.projectId = currentProjectId.value
      const addedImage = currentProject.value.addImage(image)
      addedImages.push(addedImage)
    })
    projectsStore.saveProjects()
    return addedImages
  }

  // 更新图片
  function updateImage(imageId, data) {
    if (!currentProject.value) return null
    
    const updatedImage = currentProject.value.updateImage(imageId, data)
    if (updatedImage) {
      projectsStore.saveProjects()
    }
    return updatedImage
  }

  // 删除图片
  function removeImage(imageId) {
    if (!currentProject.value) return false
    
    const result = currentProject.value.removeImage(imageId)
    if (result) {
      if (selectedImageId.value === imageId) {
        selectedImageId.value = null
      }
      projectsStore.saveProjects()
    }
    return result
  }

  // 按阶段获取图片
  function getImagesByStage(stage) {
    if (!currentProject.value) return []
    return currentProject.value.getImagesByStage(stage)
  }

  // 按部位获取图片
  function getImagesByPart(part) {
    if (!currentProject.value) return []
    return currentProject.value.getImagesByPart(part)
  }

  // 按部位和阶段获取图片
  function getImagesByPartAndStage(part, stage) {
    if (!currentProject.value) return []
    return currentProject.value.getImagesByPartAndStage(part, stage)
  }

  // 获取所有部位
  const uniqueParts = computed(() => {
    if (!currentProject.value) return []
    return currentProject.value.uniqueParts
  })

  // 获取所有器物编号
  const uniqueArtifactCodes = computed(() => {
    if (!currentProject.value) return []
    return currentProject.value.uniqueArtifactCodes
  })

  return {
    currentProjectId,
    selectedImageId,
    isSaving,
    currentProject,
    selectedImage,
    projectImages,
    hasImages,
    imageCount,
    annotationCount,
    uniqueParts,
    uniqueArtifactCodes,
    setCurrentProject,
    clearCurrentProject,
    selectImage,
    clearImageSelection,
    addImage,
    addImages,
    updateImage,
    removeImage,
    getImagesByStage,
    getImagesByPart,
    getImagesByPartAndStage
  }
})
