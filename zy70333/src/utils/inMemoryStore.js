const { v4: uuidv4 } = require('uuid');

let inMemoryStore = {
  forms: [],
  submissions: []
};

function initializeInMemoryStore() {
  inMemoryStore = {
    forms: [],
    submissions: []
  };
}

class InMemoryForm {
  constructor(data) {
    this.formId = data.formId || uuidv4();
    this.name = data.name;
    this.description = data.description || '';
    this.versions = data.versions || [{
      version: 1,
      status: 'draft',
      fields: [],
      changeLog: 'Initial version'
    }];
    this.currentVersion = data.currentVersion || 1;
    this.latestPublishedVersion = data.latestPublishedVersion || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save() {
    this.updatedAt = new Date();
    const index = inMemoryStore.forms.findIndex(f => f.formId === this.formId);
    if (index === -1) {
      inMemoryStore.forms.push(this);
    } else {
      inMemoryStore.forms[index] = this;
    }
    return this;
  }

  getVersion(versionNumber) {
    return this.versions.find(v => v.version === versionNumber);
  }

  getLatestPublished() {
    if (this.latestPublishedVersion === null) return null;
    return this.getVersion(this.latestPublishedVersion);
  }

  createNewVersion(changeLog = '') {
    const latestVersion = this.versions.length > 0 
      ? this.versions[this.versions.length - 1]
      : null;
    
    const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;
    
    const newVersion = {
      version: newVersionNumber,
      status: 'draft',
      fields: latestVersion 
        ? JSON.parse(JSON.stringify(latestVersion.fields))
        : [],
      changeLog: changeLog,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.versions.push(newVersion);
    this.currentVersion = newVersionNumber;
    
    return newVersion;
  }

  static findOne(query) {
    return {
      async exec() {
        const form = inMemoryStore.forms.find(f => {
          for (const [key, value] of Object.entries(query)) {
            if (f[key] !== value) return false;
          }
          return true;
        });
        return form ? new InMemoryForm(form) : null;
      }
    };
  }

  static find() {
    return {
      async exec() {
        return inMemoryStore.forms.map(f => new InMemoryForm(f));
      }
    };
  }
}

class InMemorySubmission {
  constructor(data) {
    this.submissionId = data.submissionId || uuidv4();
    this.formId = data.formId;
    this.version = data.version;
    this.submissionKey = data.submissionKey;
    this.data = data.data;
    this.validationErrors = data.validationErrors || [];
    this.isValid = data.isValid !== undefined ? data.isValid : true;
    this.submittedAt = data.submittedAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save() {
    this.updatedAt = new Date();
    const index = inMemoryStore.submissions.findIndex(s => s.submissionId === this.submissionId);
    if (index === -1) {
      inMemoryStore.submissions.push(this);
    } else {
      inMemoryStore.submissions[index] = this;
    }
    return this;
  }

  static findOne(query) {
    return {
      async exec() {
        const submission = inMemoryStore.submissions.find(s => {
          for (const [key, value] of Object.entries(query)) {
            if (s[key] !== value) return false;
          }
          return true;
        });
        return submission ? new InMemorySubmission(submission) : null;
      }
    };
  }

  static find(query = {}) {
    return {
      async exec() {
        return inMemoryStore.submissions
          .filter(s => {
            for (const [key, value] of Object.entries(query)) {
              if (s[key] !== value) return false;
            }
            return true;
          })
          .map(s => new InMemorySubmission(s));
      },
      sort(sortObj) {
        return {
          async exec() {
            const submissions = inMemoryStore.submissions
              .filter(s => {
                for (const [key, value] of Object.entries(query)) {
                  if (s[key] !== value) return false;
                }
                return true;
              })
              .sort((a, b) => {
                for (const [field, order] of Object.entries(sortObj)) {
                  if (a[field] < b[field]) return order === 1 ? -1 : 1;
                  if (a[field] > b[field]) return order === 1 ? 1 : -1;
                }
                return 0;
              })
              .map(s => new InMemorySubmission(s));
            return submissions;
          }
        };
      }
    };
  }
}

function getFormModel() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      return require('../models/Form');
    }
  } catch (e) {
    // MongoDB not available
  }
  return InMemoryForm;
}

function getSubmissionModel() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      return require('../models/Submission');
    }
  } catch (e) {
    // MongoDB not available
  }
  return InMemorySubmission;
}

module.exports = {
  initializeInMemoryStore,
  getFormModel,
  getSubmissionModel,
  inMemoryStore
};