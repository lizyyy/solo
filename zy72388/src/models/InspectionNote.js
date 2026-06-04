export class InspectionNote {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.recordId = data.recordId || null
    this.noteContent = data.noteContent || ''
    this.author = data.author || ''
    this.createTime = data.createTime || new Date().toISOString()
    this.isHandwritten = data.isHandwritten || false
    this.confirmed = data.confirmed || false
    this.confirmedBy = data.confirmedBy || ''
    this.confirmedTime = data.confirmedTime || null
  }

  generateId() {
    return 'NOTE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  toJSON() {
    return {
      id: this.id,
      recordId: this.recordId,
      noteContent: this.noteContent,
      author: this.author,
      createTime: this.createTime,
      isHandwritten: this.isHandwritten,
      confirmed: this.confirmed,
      confirmedBy: this.confirmedBy,
      confirmedTime: this.confirmedTime
    }
  }
}
