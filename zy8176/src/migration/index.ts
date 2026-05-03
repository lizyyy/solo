import {
  FormSchema,
  SchemaField,
  DraftRecord,
  EnumMapping,
  MigrationRule,
  MigrationResult,
  MigrationPlan,
  MigrationStep,
  Issue,
  Severity,
  MigrationStatistics,
  SchemaDiff,
  DiffField
} from '../types';

export class MigrationSimulator {
  private issueCounter = 0;
  private stepCounter = 0;

  simulate(
    oldSchema: FormSchema,
    newSchema: FormSchema,
    drafts: DraftRecord[],
    enumMappings: EnumMapping[],
    migrationRules: MigrationRule[],
    schemaDiff: SchemaDiff
  ): MigrationResult {
    const issues: Issue[] = [];
    const steps: MigrationStep[] = [];

    const allOldFields = this.getAllFields(oldSchema);
    const allNewFields = this.getAllFields(newSchema);

    this.checkVersionLag(drafts, newSchema.schemaVersion, issues);

    this.checkMissingFields(drafts, allOldFields, allNewFields, schemaDiff.removedFields, issues, steps);

    this.checkEnumMappings(drafts, allOldFields, allNewFields, enumMappings, issues, steps);

    this.checkNewRequiredFields(drafts, allNewFields, schemaDiff.addedFields, issues, steps);

    this.checkAttachmentReferences(drafts, allOldFields, allNewFields, schemaDiff, issues, steps);

    this.checkFieldTypeMismatches(drafts, allOldFields, allNewFields, schemaDiff.modifiedFields, issues, steps);

    this.applyMigrationRules(drafts, migrationRules, steps);

    const statistics = this.calculateStatistics(drafts, issues, schemaDiff);
    const plan = this.createMigrationPlan(newSchema.schemaVersion, oldSchema.schemaVersion, steps);

    return {
      plan,
      issues,
      statistics
    };
  }

  private getAllFields(schema: FormSchema): Map<string, SchemaField & { groupId: string }> {
    const fields = new Map<string, SchemaField & { groupId: string }>();
    
    for (const group of schema.groups) {
      for (const field of group.fields) {
        const existing = fields.get(field.fieldId);
        if (!existing) {
          fields.set(field.fieldId, { ...field, groupId: group.groupId });
        }
      }
    }
    
    return fields;
  }

  private checkVersionLag(
    drafts: DraftRecord[],
    targetVersion: string,
    issues: Issue[]
  ): void {
    const versionGroups = new Map<string, string[]>();
    
    for (const draft of drafts) {
      const draftIds = versionGroups.get(draft.schemaVersion) || [];
      draftIds.push(draft.draftId);
      versionGroups.set(draft.schemaVersion, draftIds);
    }

    for (const [version, draftIds] of versionGroups.entries()) {
      if (this.compareVersions(version, targetVersion) < 0) {
        issues.push({
          issueId: `issue-${++this.issueCounter}`,
          type: 'schema_version_lag',
          severity: this.determineVersionLagSeverity(version, targetVersion),
          fieldId: '_schema_version',
          draftIds,
          description: `${draftIds.length} draft(s) are using schema version ${version}, which is older than target version ${targetVersion}`,
          suggestion: 'These drafts may be missing data required by the new schema. Consider updating or validating them before migration.',
          affectedValues: [version]
        });
      }
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) return p1 - p2;
    }
    return 0;
  }

  private determineVersionLagSeverity(oldVersion: string, newVersion: string): Severity {
    const parts1 = oldVersion.split('.').map(Number);
    const parts2 = newVersion.split('.').map(Number);
    
    if (parts1[0] !== parts2[0]) return 'critical';
    if (parts1[1] !== parts2[1]) return 'high';
    return 'medium';
  }

  private checkMissingFields(
    drafts: DraftRecord[],
    oldFields: Map<string, SchemaField & { groupId: string }>,
    newFields: Map<string, SchemaField & { groupId: string }>,
    removedFields: DiffField[],
    issues: Issue[],
    _steps: MigrationStep[]
  ): void {
    for (const removedField of removedFields) {
      const fieldId = removedField.fieldId;
      const inNew = newFields.get(fieldId);
      
      if (inNew) continue;

      const affectedDrafts: string[] = [];
      const affectedValues: unknown[] = [];

      for (const draft of drafts) {
        if (draft.data[fieldId] !== undefined) {
          affectedDrafts.push(draft.draftId);
          affectedValues.push(draft.data[fieldId]);
        }
      }

      if (affectedDrafts.length > 0) {
        const oldField = oldFields.get(fieldId);
        issues.push({
          issueId: `issue-${++this.issueCounter}`,
          type: 'missing_field',
          severity: 'high',
          fieldId,
          draftIds: affectedDrafts,
          description: `Field "${oldField?.fieldName || fieldId}" exists in ${affectedDrafts.length} draft(s) but was removed from the new schema`,
          suggestion: `Create a migration rule to either: 1) map to a new field, 2) transform the data, or 3) accept data loss`,
          affectedValues: Array.from(new Set(affectedValues.map(v => JSON.stringify(v)))).map(v => JSON.parse(v))
        });
      }
    }
  }

  private checkEnumMappings(
    drafts: DraftRecord[],
    _oldFields: Map<string, SchemaField & { groupId: string }>,
    newFields: Map<string, SchemaField & { groupId: string }>,
    enumMappings: EnumMapping[],
    issues: Issue[],
    _steps: MigrationStep[]
  ): void {
    const mappingsByField = new Map<string, Map<string, string>>();
    for (const mapping of enumMappings) {
      if (!mappingsByField.has(mapping.fieldId)) {
        mappingsByField.set(mapping.fieldId, new Map());
      }
      mappingsByField.get(mapping.fieldId)!.set(mapping.oldValue, mapping.newValue);
    }

    for (const [fieldId, newField] of newFields.entries()) {
      if (newField.type !== 'enum' && newField.type !== 'multiselect') continue;

      const validValues = new Set((newField.enumValues || []).map(e => e.value));
      const fieldMappings = mappingsByField.get(fieldId);

      const affectedDrafts: string[] = [];
      const unmappedValues: Set<string> = new Set();

      for (const draft of drafts) {
        const value = draft.data[fieldId];
        
        if (value === undefined || value === null) continue;

        const valuesToCheck = newField.type === 'multiselect' 
          ? (Array.isArray(value) ? value : [value])
          : [value];

        let hasIssue = false;
        for (const v of valuesToCheck) {
          const stringValue = String(v);
          
          if (validValues.has(stringValue)) continue;
          
          if (fieldMappings && fieldMappings.has(stringValue)) continue;

          unmappedValues.add(stringValue);
          hasIssue = true;
        }

        if (hasIssue) {
          affectedDrafts.push(draft.draftId);
        }
      }

      if (affectedDrafts.length > 0) {
        issues.push({
          issueId: `issue-${++this.issueCounter}`,
          type: 'enum_value_mismatch',
          severity: 'critical',
          fieldId,
          draftIds: affectedDrafts,
          description: `${affectedDrafts.length} draft(s) have enum values for field "${newField.fieldName}" that cannot be mapped to the new schema`,
          suggestion: `Add enum mappings for values: ${Array.from(unmappedValues).join(', ')}`,
          affectedValues: Array.from(unmappedValues)
        });
      }
    }
  }

  private checkNewRequiredFields(
    drafts: DraftRecord[],
    newFields: Map<string, SchemaField & { groupId: string }>,
    addedFields: DiffField[],
    issues: Issue[],
    _steps: MigrationStep[]
  ): void {
    for (const addedField of addedFields) {
      const fieldId = addedField.fieldId;
      const fieldData = addedField.newValue as Record<string, unknown> | undefined;
      const newField = newFields.get(fieldId);
      
      if (!newField || !newField.required) continue;

      const hasDefault = fieldData && fieldData['defaultValue'] !== undefined;
      const affectedDrafts: string[] = [];

      for (const draft of drafts) {
        if (draft.data[fieldId] === undefined) {
          affectedDrafts.push(draft.draftId);
        }
      }

      if (affectedDrafts.length > 0) {
        const severity: Severity = hasDefault ? 'medium' : 'critical';
        const defaultVal = fieldData?.['defaultValue'];
        const suggestion = hasDefault
          ? `Field has default value "${defaultVal}", but verify it's appropriate for all ${affectedDrafts.length} drafts`
          : `Add a default value for field "${newField.fieldName}" or ensure all drafts have this field filled before migration`;

        issues.push({
          issueId: `issue-${++this.issueCounter}`,
          type: 'required_field_no_default',
          severity,
          fieldId,
          draftIds: affectedDrafts,
          description: `New required field "${newField.fieldName}" is missing from ${affectedDrafts.length} draft(s)${hasDefault ? ' (has default value)' : ' and has NO default value'}`,
          suggestion,
          affectedValues: []
        });
      }
    }
  }

  private checkAttachmentReferences(
    drafts: DraftRecord[],
    _oldFields: Map<string, SchemaField & { groupId: string }>,
    newFields: Map<string, SchemaField & { groupId: string }>,
    schemaDiff: SchemaDiff,
    issues: Issue[],
    _steps: MigrationStep[]
  ): void {
    const removedAttachmentFields = new Set<string>();
    
    for (const removed of schemaDiff.removedFields) {
      const fieldData = removed.oldValue as Record<string, unknown>;
      if (fieldData['isAttachment'] || 
          fieldData['type'] === 'attachment' || 
          fieldData['type'] === 'image') {
        removedAttachmentFields.add(removed.fieldId);
      }
    }

    const reportedRemovedFields = new Set<string>();
    const reportedSizeIssues = new Set<string>();
    const reportedTypeIssues = new Set<string>();

    for (const draft of drafts) {
      if (!draft.attachments || draft.attachments.length === 0) continue;

      for (const attachment of draft.attachments) {
        const fieldId = attachment.fieldId;
        const newField = newFields.get(fieldId);

        if (removedAttachmentFields.has(fieldId)) {
          if (!reportedRemovedFields.has(fieldId)) {
            const affectedDrafts = this.findDraftsWithAttachmentField(drafts, fieldId);
            issues.push({
              issueId: `issue-${++this.issueCounter}`,
              type: 'attachment_reference_lost',
              severity: 'critical',
              fieldId,
              draftIds: affectedDrafts,
              description: `Attachment field "${fieldId}" was removed, but ${affectedDrafts.length} draft(s) have attachments referencing it`,
              suggestion: 'Map these attachments to a new field or decide to remove them during migration',
              affectedValues: [{
                fieldId,
                attachmentCount: affectedDrafts.length
              }]
            });
            reportedRemovedFields.add(fieldId);
          }
          continue;
        }

        if (newField) {
          const config = newField.attachmentConfig;
          if (config) {
            const sizeIssueKey = `${draft.draftId}-${fieldId}-size`;
            if (attachment.fileSize > config.maxSize && !reportedSizeIssues.has(sizeIssueKey)) {
              issues.push({
                issueId: `issue-${++this.issueCounter}`,
                type: 'validation_failed',
                severity: 'high',
                fieldId,
                draftIds: [draft.draftId],
                description: `Attachment "${attachment.fileName}" exceeds new maximum size limit`,
                suggestion: `Current max: ${config.maxSize} bytes, attachment size: ${attachment.fileSize} bytes`,
                affectedValues: [attachment.fileSize]
              });
              reportedSizeIssues.add(sizeIssueKey);
            }

            if (config.allowedTypes && config.allowedTypes.length > 0) {
              const allowed = config.allowedTypes.some(type => 
                attachment.mimeType.startsWith(type.replace('*', ''))
              );
              const typeIssueKey = `${draft.draftId}-${fieldId}-type`;
              if (!allowed && !reportedTypeIssues.has(typeIssueKey)) {
                issues.push({
                  issueId: `issue-${++this.issueCounter}`,
                  type: 'validation_failed',
                  severity: 'medium',
                  fieldId,
                  draftIds: [draft.draftId],
                  description: `Attachment type "${attachment.mimeType}" is not allowed in new schema`,
                  suggestion: `Allowed types: ${config.allowedTypes.join(', ')}`,
                  affectedValues: [attachment.mimeType]
                });
                reportedTypeIssues.add(typeIssueKey);
              }
            }
          }
        }
      }
    }
  }

  private findDraftsWithAttachmentField(drafts: DraftRecord[], fieldId: string): string[] {
    return drafts
      .filter(d => d.attachments?.some(a => a.fieldId === fieldId))
      .map(d => d.draftId);
  }

  private checkFieldTypeMismatches(
    drafts: DraftRecord[],
    _oldFields: Map<string, SchemaField & { groupId: string }>,
    newFields: Map<string, SchemaField & { groupId: string }>,
    modifiedFields: DiffField[],
    issues: Issue[],
    _steps: MigrationStep[]
  ): void {
    for (const modified of modifiedFields) {
      const typeChange = modified.changes?.find(c => c.property === 'type');
      if (!typeChange) continue;

      const fieldId = modified.fieldId;
      const newField = newFields.get(fieldId);
      if (!newField) continue;

      const oldType = typeChange.oldValue as string;
      const newType = typeChange.newValue as string;

      const affectedDrafts: string[] = [];
      const incompatibleValues: unknown[] = [];

      for (const draft of drafts) {
        const value = draft.data[fieldId];
        if (value === undefined || value === null) continue;

        if (!this.isTypeCompatible(value, oldType, newType)) {
          affectedDrafts.push(draft.draftId);
          incompatibleValues.push(value);
        }
      }

      if (affectedDrafts.length > 0) {
        issues.push({
          issueId: `issue-${++this.issueCounter}`,
          type: 'field_type_mismatch',
          severity: 'high',
          fieldId,
          draftIds: affectedDrafts,
          description: `Field "${newField.fieldName}" type changed from ${oldType} to ${newType}, and ${affectedDrafts.length} draft(s) have incompatible values`,
          suggestion: 'Create a migration rule with transform logic to handle the type conversion',
          affectedValues: Array.from(new Set(incompatibleValues.slice(0, 10).map(v => JSON.stringify(v)))).map(v => JSON.parse(v))
        });
      }
    }
  }

  private isTypeCompatible(value: unknown, _oldType: string, newType: string): boolean {
    if (value === null || value === undefined) return true;

    switch (newType) {
      case 'string':
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      case 'number':
        return typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)));
      case 'boolean':
        return typeof value === 'boolean' || value === 0 || value === 1 || value === 'true' || value === 'false';
      case 'date':
      case 'datetime':
        return typeof value === 'string' || value instanceof Date;
      case 'enum':
      case 'multiselect':
        return typeof value === 'string' || Array.isArray(value);
      default:
        return true;
    }
  }

  private applyMigrationRules(
    _drafts: DraftRecord[],
    rules: MigrationRule[],
    steps: MigrationStep[]
  ): void {
    const stepsByType = new Map<string, MigrationStep>();

    for (const rule of rules) {
      let step = stepsByType.get(rule.type);
      if (!step) {
        step = {
          stepId: `step-${++this.stepCounter}`,
          type: this.ruleTypeToStepType(rule.type),
          description: rule.description || `Apply ${rule.type} migrations`,
          affectedDrafts: [],
          rulesApplied: []
        };
        stepsByType.set(rule.type, step);
      }
      step.rulesApplied.push(rule.ruleId);
    }

    steps.push(...stepsByType.values());
  }

  private ruleTypeToStepType(ruleType: string): MigrationStep['type'] {
    const mapping: Record<string, MigrationStep['type']> = {
      'rename': 'field_rename',
      'transform': 'field_transform',
      'copy': 'field_transform',
      'delete': 'data_cleanup',
      'default_value': 'default_value',
      'merge': 'field_transform',
      'split': 'field_transform'
    };
    return mapping[ruleType] || 'data_cleanup';
  }

  private calculateStatistics(
    drafts: DraftRecord[],
    issues: Issue[],
    schemaDiff: SchemaDiff
  ): MigrationStatistics {
    const issuesBySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    const issuesByType: Record<string, number> = {};

    const affectedDraftIds = new Set<string>();

    for (const issue of issues) {
      issuesBySeverity[issue.severity]++;
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
      
      for (const draftId of issue.draftIds) {
        affectedDraftIds.add(draftId);
      }
    }

    let attachmentCount = 0;
    for (const draft of drafts) {
      attachmentCount += draft.attachments?.length || 0;
    }

    const attachmentIssues = issues.filter(i => 
      i.type === 'attachment_reference_lost'
    ).length;

    return {
      totalDrafts: drafts.length,
      affectedDrafts: affectedDraftIds.size,
      issuesBySeverity,
      issuesByType,
      fieldsAdded: schemaDiff.addedFields.length,
      fieldsRemoved: schemaDiff.removedFields.length,
      fieldsModified: schemaDiff.modifiedFields.length,
      attachmentCount,
      attachmentIssues
    };
  }

  private createMigrationPlan(
    targetVersion: string,
    sourceVersion: string,
    steps: MigrationStep[]
  ): MigrationPlan {
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      sourceSchemaVersion: sourceVersion,
      targetSchemaVersion: targetVersion,
      steps
    };
  }

  static printResult(result: MigrationResult): void {
    console.log('\n========================================');
    console.log('       Migration Simulation Result');
    console.log('========================================');

    console.log('\n📊 Statistics:');
    console.log(`   Total drafts: ${result.statistics.totalDrafts}`);
    console.log(`   Affected drafts: ${result.statistics.affectedDrafts}`);
    console.log(`   Fields added: ${result.statistics.fieldsAdded}`);
    console.log(`   Fields removed: ${result.statistics.fieldsRemoved}`);
    console.log(`   Fields modified: ${result.statistics.fieldsModified}`);
    console.log(`   Attachments: ${result.statistics.attachmentCount}`);

    console.log('\n⚠️  Issues by Severity:');
    for (const [severity, count] of Object.entries(result.statistics.issuesBySeverity)) {
      if (count > 0) {
        const icon = severity === 'critical' ? '🔴' : 
                     severity === 'high' ? '🟠' : 
                     severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${icon} ${severity}: ${count}`);
      }
    }

    if (result.issues.length > 0) {
      console.log('\n📋 Issues Details:');
      for (const issue of result.issues.slice(0, 10)) {
        const icon = issue.severity === 'critical' ? '🔴' : 
                     issue.severity === 'high' ? '🟠' : 
                     issue.severity === 'medium' ? '🟡' : '🟢';
        console.log(`\n   ${icon} [${issue.type.toUpperCase()}] ${issue.description}`);
        console.log(`      Affected drafts: ${issue.draftIds.length}`);
        if (issue.suggestion) {
          console.log(`      Suggestion: ${issue.suggestion}`);
        }
      }
      
      if (result.issues.length > 10) {
        console.log(`\n   ... and ${result.issues.length - 10} more issues`);
      }
    }

    if (result.plan.steps.length > 0) {
      console.log('\n📝 Migration Plan Steps:');
      for (const step of result.plan.steps) {
        console.log(`   - ${step.description}`);
        console.log(`     Rules: ${step.rulesApplied.join(', ')}`);
      }
    }

    console.log('\n========================================\n');
  }
}
