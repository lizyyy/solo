const { getFormModel } = require('../utils/inMemoryStore');
const { validateFieldDefinition } = require('../utils/validator');
const { v4: uuidv4 } = require('uuid');

class FormService {
  async createForm(formData) {
    const Form = getFormModel();
    
    const form = new Form({
      name: formData.name,
      description: formData.description || ''
    });
    
    await form.save();
    return this._serializeForm(form);
  }

  async getAllForms() {
    const Form = getFormModel();
    const forms = await Form.find().exec();
    return forms.map(f => this._serializeForm(f));
  }

  async getForm(formId) {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }
    return this._serializeForm(form);
  }

  async getFormVersion(formId, versionNumber) {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const version = form.getVersion(versionNumber);
    if (!version) {
      throw new Error(`Version not found: ${versionNumber}`);
    }

    return this._serializeVersion(version);
  }

  async publishVersion(formId, versionNumber) {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const version = form.getVersion(versionNumber);
    if (!version) {
      throw new Error(`Version not found: ${versionNumber}`);
    }

    if (version.status === 'frozen') {
      throw new Error(`Cannot publish frozen version ${versionNumber}`);
    }

    if (version.status === 'published') {
      throw new Error(`Version ${versionNumber} is already published`);
    }

    version.status = 'published';
    version.publishedAt = new Date();
    form.latestPublishedVersion = versionNumber;
    
    await form.save();
    return this._serializeVersion(version);
  }

  async freezeVersion(formId, versionNumber) {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const version = form.getVersion(versionNumber);
    if (!version) {
      throw new Error(`Version not found: ${versionNumber}`);
    }

    if (version.status !== 'published') {
      throw new Error(`Only published versions can be frozen. Current status: ${version.status}`);
    }

    if (version.status === 'frozen') {
      throw new Error(`Version ${versionNumber} is already frozen`);
    }

    version.status = 'frozen';
    version.frozenAt = new Date();
    
    await form.save();
    return this._serializeVersion(version);
  }

  async createNewVersion(formId, changeLog = '') {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const newVersion = form.createNewVersion(changeLog);
    await form.save();
    
    return this._serializeVersion(newVersion);
  }

  async addField(formId, fieldData) {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const currentVersion = form.getVersion(form.currentVersion);
    if (!currentVersion) {
      throw new Error(`Current version not found`);
    }

    if (currentVersion.status !== 'draft') {
      throw new Error(
        `Cannot modify version ${currentVersion.version} (status: ${currentVersion.status}). ` +
        `Published or frozen versions cannot be directly modified. Create a new version first.`
      );
    }

    const { error, value } = validateFieldDefinition(fieldData);
    if (error) {
      throw new Error(`Invalid field definition: ${error.details[0].message}`);
    }

    const existingField = currentVersion.fields.find(f => f.name === value.name);
    if (existingField && !existingField.deleted) {
      throw new Error(`Field with name '${value.name}' already exists`);
    }

    if (existingField && existingField.deleted) {
      Object.assign(existingField, {
        ...value,
        deleted: false,
        fieldId: uuidv4()
      });
    } else {
      currentVersion.fields.push({
        ...value,
        fieldId: uuidv4(),
        deleted: false,
        migrationNote: value.migrationNote || ''
      });
    }

    await form.save();
    return this._serializeVersion(currentVersion);
  }

  async removeField(formId, fieldName, migrationNote = '') {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const currentVersion = form.getVersion(form.currentVersion);
    if (!currentVersion) {
      throw new Error(`Current version not found`);
    }

    if (currentVersion.status !== 'draft') {
      throw new Error(
        `Cannot modify version ${currentVersion.version} (status: ${currentVersion.status}). ` +
        `Published or frozen versions cannot be directly modified. Create a new version first.`
      );
    }

    const field = currentVersion.fields.find(f => f.name === fieldName);
    if (!field) {
      throw new Error(`Field not found: ${fieldName}`);
    }

    if (field.deleted) {
      throw new Error(`Field '${fieldName}' is already deleted`);
    }

    field.deleted = true;
    field.migrationNote = migrationNote || 
      `字段 '${field.label}' (${field.name}) 已删除。历史数据中该字段的值将保留，但在新版本中不再显示。`;

    await form.save();
    return this._serializeVersion(currentVersion);
  }

  async updateField(formId, fieldName, updates) {
    const Form = getFormModel();
    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const currentVersion = form.getVersion(form.currentVersion);
    if (!currentVersion) {
      throw new Error(`Current version not found`);
    }

    if (currentVersion.status !== 'draft') {
      throw new Error(
        `Cannot modify version ${currentVersion.version} (status: ${currentVersion.status}). ` +
        `Published or frozen versions cannot be directly modified. Create a new version first.`
      );
    }

    const field = currentVersion.fields.find(f => f.name === fieldName);
    if (!field || field.deleted) {
      throw new Error(`Field not found or deleted: ${fieldName}`);
    }

    const allowedUpdates = ['label', 'required', 'validation', 'options', 'type'];
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        if (key === 'type' && field.type !== updates[key]) {
          field.migrationNote = `字段类型从 '${field.type}' 变更为 '${updates[key]}'，需要数据迁移。`;
        }
        field[key] = updates[key];
      }
    }

    await form.save();
    return this._serializeVersion(currentVersion);
  }

  _serializeForm(form) {
    return {
      formId: form.formId,
      name: form.name,
      description: form.description,
      currentVersion: form.currentVersion,
      latestPublishedVersion: form.latestPublishedVersion,
      versions: form.versions.map(v => this._serializeVersion(v)),
      createdAt: form.createdAt,
      updatedAt: form.updatedAt
    };
  }

  _serializeVersion(version) {
    return {
      version: version.version,
      status: version.status,
      fields: version.fields.map(f => ({
        fieldId: f.fieldId,
        name: f.name,
        type: f.type,
        label: f.label,
        required: f.required,
        validation: f.validation || {},
        options: f.options || [],
        deleted: f.deleted || false,
        migrationNote: f.migrationNote || ''
      })),
      publishedAt: version.publishedAt,
      frozenAt: version.frozenAt,
      changeLog: version.changeLog,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt
    };
  }
}

module.exports = new FormService();