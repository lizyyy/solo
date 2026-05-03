import api from './index'

export const importExportApi = {
  importCSV(file) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import-export/import/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  importJSON(file) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import-export/import/json', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  exportArtworksCSV(params = {}) {
    return api.get('/import-export/export/artworks/csv', {
      params,
      responseType: 'blob'
    })
  },

  exportArtworksJSON(params = {}) {
    return api.get('/import-export/export/artworks/json', {
      params,
      responseType: 'blob'
    })
  },

  downloadTemplateCSV() {
    return api.get('/import-export/templates/csv', {
      responseType: 'blob'
    })
  },

  downloadTemplateJSON() {
    return api.get('/import-export/templates/json', {
      responseType: 'blob'
    })
  }
}
