const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const FieldSchema = new mongoose.Schema({
  _id: false,
  fieldId: { type: String, default: () => uuidv4() },
  name: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['text', 'number', 'email', 'date', 'select', 'checkbox', 'textarea']
  },
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  validation: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  options: [{ type: String }],
  deleted: { type: Boolean, default: false },
  migrationNote: { type: String, default: '' }
}, { timestamps: true });

const FormVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'frozen'], 
    default: 'draft' 
  },
  fields: [FieldSchema],
  publishedAt: { type: Date },
  frozenAt: { type: Date },
  changeLog: { type: String, default: '' }
}, { timestamps: true });

const FormSchema = new mongoose.Schema({
  formId: { type: String, unique: true, default: () => uuidv4() },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  versions: [FormVersionSchema],
  currentVersion: { type: Number, default: 1 },
  latestPublishedVersion: { type: Number, default: null }
}, { timestamps: true });

FormSchema.methods.getVersion = function(versionNumber) {
  return this.versions.find(v => v.version === versionNumber);
};

FormSchema.methods.getLatestPublished = function() {
  if (this.latestPublishedVersion === null) return null;
  return this.getVersion(this.latestPublishedVersion);
};

FormSchema.methods.createNewVersion = function(changeLog = '') {
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
    changeLog: changeLog
  };
  
  this.versions.push(newVersion);
  this.currentVersion = newVersionNumber;
  
  return newVersion;
};

const Form = mongoose.model('Form', FormSchema);

module.exports = Form;