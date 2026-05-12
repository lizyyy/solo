const { getFormModel, getSubmissionModel } = require('../utils/inMemoryStore');
const { validateSubmissionData } = require('../utils/validator');
const { v4: uuidv4 } = require('uuid');

class SubmissionService {
  async submitData(formId, submissionData) {
    const Form = getFormModel();
    const Submission = getSubmissionModel();

    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    const targetVersion = submissionData.version || form.latestPublishedVersion;
    if (targetVersion === null) {
      throw new Error('No published version available for this form');
    }

    const version = form.getVersion(targetVersion);
    if (!version) {
      throw new Error(`Version not found: ${targetVersion}`);
    }

    if (version.status !== 'published' && version.status !== 'frozen') {
      throw new Error(`Version ${targetVersion} is not published. Only published versions can accept submissions.`);
    }

    const submissionKey = submissionData.submissionKey || uuidv4();

    const validationResult = validateSubmissionData(
      submissionData.data,
      version.fields
    );

    let existingSubmission = await Submission.findOne({ 
      formId, 
      submissionKey 
    }).exec();

    if (existingSubmission) {
      if (existingSubmission.version !== targetVersion) {
        throw new Error(
          `Submission with key '${submissionKey}' already exists but was submitted with version ${existingSubmission.version}. ` +
          `Cannot update with different version ${targetVersion}.`
        );
      }

      existingSubmission.data = submissionData.data;
      existingSubmission.validationErrors = validationResult.errors;
      existingSubmission.isValid = validationResult.valid;
      existingSubmission.updatedAt = new Date();
      await existingSubmission.save();

      return {
        ...this._serializeSubmission(existingSubmission),
        isNew: false,
        validationErrors: validationResult.errors,
        formVersion: targetVersion
      };
    }

    const newSubmission = new Submission({
      formId,
      version: targetVersion,
      submissionKey,
      data: submissionData.data,
      validationErrors: validationResult.errors,
      isValid: validationResult.valid
    });
    await newSubmission.save();

    return {
      ...this._serializeSubmission(newSubmission),
      isNew: true,
      validationErrors: validationResult.errors,
      formVersion: targetVersion
    };
  }

  async getSubmission(submissionId) {
    const Submission = getSubmissionModel();
    const submission = await Submission.findOne({ submissionId }).exec();
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }
    return this._serializeSubmission(submission);
  }

  async getSubmissionWithVersionContext(submissionId) {
    const Form = getFormModel();
    const Submission = getSubmissionModel();

    const submission = await Submission.findOne({ submissionId }).exec();
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const form = await Form.findOne({ formId: submission.formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${submission.formId}`);
    }

    const submitVersion = form.getVersion(submission.version);
    const latestVersion = form.getLatestPublished();

    const fieldDifferences = this._calculateFieldDifferences(
      submitVersion ? submitVersion.fields : [],
      latestVersion ? latestVersion.fields : []
    );

    return {
      submission: this._serializeSubmission(submission),
      formInfo: {
        formId: form.formId,
        name: form.name
      },
      validationContext: {
        submittedVersion: submission.version,
        submittedVersionStatus: submitVersion ? submitVersion.status : 'unknown',
        latestPublishedVersion: form.latestPublishedVersion,
        latestVersionStatus: latestVersion ? latestVersion.status : 'none'
      },
      fieldDifferences,
      dataByOriginalVersion: this._getDataByVersion(
        submission.data,
        submitVersion ? submitVersion.fields : []
      ),
      dataByLatestVersion: latestVersion ? this._getDataByVersion(
        submission.data,
        latestVersion.fields
      ) : null
    };
  }

  async getFormSubmissions(formId, options = {}) {
    const Form = getFormModel();
    const Submission = getSubmissionModel();

    const form = await Form.findOne({ formId }).exec();
    if (!form) {
      throw new Error(`Form not found: ${formId}`);
    }

    let query = { formId };
    if (options.version) {
      query.version = parseInt(options.version);
    }

    let submissionsQuery = Submission.find(query);
    if (options.sortBy) {
      const sortDir = options.sortDir === 'desc' ? -1 : 1;
      submissionsQuery = submissionsQuery.sort({ [options.sortBy]: sortDir });
    }

    const submissions = await submissionsQuery.exec();
    
    return submissions.map(s => this._serializeSubmission(s));
  }

  _calculateFieldDifferences(originalFields, latestFields) {
    const differences = {
      addedInLatest: [],
      removedInLatest: [],
      modified: []
    };

    const originalFieldMap = new Map(
      originalFields.filter(f => !f.deleted).map(f => [f.name, f])
    );
    const latestFieldMap = new Map(
      latestFields.filter(f => !f.deleted).map(f => [f.name, f])
    );

    for (const [name, latestField] of latestFieldMap) {
      if (!originalFieldMap.has(name)) {
        differences.addedInLatest.push({
          field: name,
          label: latestField.label,
          requiredInLatest: latestField.required,
          note: `此字段在提交时不存在（v${latestFields.version}新增），历史数据中不会有值`
        });
      } else {
        const originalField = originalFieldMap.get(name);
        if (JSON.stringify(originalField) !== JSON.stringify(latestField)) {
          const changes = [];
          if (originalField.type !== latestField.type) {
            changes.push(`类型: ${originalField.type} → ${latestField.type}`);
          }
          if (originalField.required !== latestField.required) {
            changes.push(`必填: ${originalField.required ? '是' : '否'} → ${latestField.required ? '是' : '否'}`);
          }
          if (JSON.stringify(originalField.validation) !== JSON.stringify(latestField.validation)) {
            changes.push(`校验规则变更`);
          }
          differences.modified.push({
            field: name,
            label: latestField.label,
            changes,
            note: latestField.migrationNote || `字段属性已变更`
          });
        }
      }
    }

    for (const [name, originalField] of originalFieldMap) {
      if (!latestFieldMap.has(name)) {
        differences.removedInLatest.push({
          field: name,
          label: originalField.label,
          note: originalField.migrationNote || `此字段在最新版本中已删除，但历史数据中保留原值`
        });
      }
    }

    return differences;
  }

  _getDataByVersion(data, versionFields) {
    const activeFields = versionFields.filter(f => !f.deleted);
    const result = {};

    for (const field of activeFields) {
      if (data.hasOwnProperty(field.name)) {
        result[field.name] = data[field.name];
      }
    }

    return result;
  }

  _serializeSubmission(submission) {
    return {
      submissionId: submission.submissionId,
      formId: submission.formId,
      version: submission.version,
      submissionKey: submission.submissionKey,
      data: submission.data,
      validationErrors: submission.validationErrors || [],
      isValid: submission.isValid,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt
    };
  }
}

module.exports = new SubmissionService();