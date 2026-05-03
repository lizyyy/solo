const { electronAPI } = window

export const materials = {
  getAll: async () => {
    return await electronAPI.materials.getAll()
  },
  getById: async (id) => {
    return await electronAPI.materials.getById(id)
  },
  create: async (material) => {
    return await electronAPI.materials.create(material)
  },
  update: async (id, material) => {
    return await electronAPI.materials.update(id, material)
  },
  delete: async (id) => {
    return await electronAPI.materials.delete(id)
  },
  import: async (materials) => {
    return await electronAPI.materials.import(materials)
  },
}

export const projects = {
  getAll: async () => {
    return await electronAPI.projects.getAll()
  },
  getById: async (id) => {
    return await electronAPI.projects.getById(id)
  },
  create: async (project) => {
    return await electronAPI.projects.create(project)
  },
  update: async (id, project) => {
    return await electronAPI.projects.update(id, project)
  },
  delete: async (id) => {
    return await electronAPI.projects.delete(id)
  },
}

export const timelines = {
  getByProject: async (projectId) => {
    return await electronAPI.timelines.getByProject(projectId)
  },
  create: async (timeline) => {
    return await electronAPI.timelines.create(timeline)
  },
  update: async (id, timeline) => {
    return await electronAPI.timelines.update(id, timeline)
  },
  delete: async (id) => {
    return await electronAPI.timelines.delete(id)
  },
}

export const exportProject = async (projectId) => {
  return await electronAPI.export.project(projectId)
}

export const importProject = async (data) => {
  return await electronAPI.import.project(data)
}

export const initSampleData = async () => {
  return await electronAPI.sampleData.init()
}

export const dialog = {
  saveFile: async (options) => {
    return await electronAPI.dialog.saveFile(options)
  },
  openFile: async (options) => {
    return await electronAPI.dialog.openFile(options)
  },
}
