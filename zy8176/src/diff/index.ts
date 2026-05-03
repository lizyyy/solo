import {
  FormSchema,
  SchemaGroup,
  SchemaField,
  SchemaDiff,
  DiffField,
  FieldChange,
  DiffGroup
} from '../types';

export class SchemaDiffer {
  static diff(oldSchema: FormSchema, newSchema: FormSchema): SchemaDiff {
    const addedFields: DiffField[] = [];
    const removedFields: DiffField[] = [];
    const modifiedFields: DiffField[] = [];
    const addedGroups: DiffGroup[] = [];
    const removedGroups: DiffGroup[] = [];

    const oldFields = this.indexFieldsByGroup(oldSchema.groups);
    const newFields = this.indexFieldsByGroup(newSchema.groups);

    const oldGroupIds = new Set(oldSchema.groups.map(g => g.groupId));
    const newGroupIds = new Set(newSchema.groups.map(g => g.groupId));

    for (const group of oldSchema.groups) {
      if (!newGroupIds.has(group.groupId)) {
        removedGroups.push({
          groupId: group.groupId,
          groupName: group.groupName
        });
      }
    }

    for (const group of newSchema.groups) {
      if (!oldGroupIds.has(group.groupId)) {
        addedGroups.push({
          groupId: group.groupId,
          groupName: group.groupName
        });
      }
    }

    for (const [groupId, fields] of oldFields.entries()) {
      for (const [fieldId, field] of fields.entries()) {
        const newField = newFields.get(groupId)?.get(fieldId);
        
        if (!newField) {
          const sharedInNew = this.findFieldAcrossGroups(newFields, fieldId);
          if (sharedInNew) {
            const changes = this.compareFields(field, sharedInNew.field, groupId, sharedInNew.groupId);
            if (changes.length > 0) {
              modifiedFields.push({
                fieldId,
                groupId: sharedInNew.groupId,
                oldValue: { groupId, ...field },
                newValue: { groupId: sharedInNew.groupId, ...sharedInNew.field },
                changes
              });
            }
          } else {
            removedFields.push({
              fieldId,
              groupId,
              oldValue: field
            });
          }
        } else {
          const changes = this.compareFields(field, newField, groupId, groupId);
          if (changes.length > 0) {
            modifiedFields.push({
              fieldId,
              groupId,
              oldValue: field,
              newValue: newField,
              changes
            });
          }
        }
      }
    }

    for (const [groupId, fields] of newFields.entries()) {
      for (const [fieldId, field] of fields.entries()) {
        const oldField = oldFields.get(groupId)?.get(fieldId);
        const sharedInOld = this.findFieldAcrossGroups(oldFields, fieldId);
        
        if (!oldField && !sharedInOld) {
          addedFields.push({
            fieldId,
            groupId,
            newValue: field
          });
        }
      }
    }

    return {
      addedFields,
      removedFields,
      modifiedFields,
      addedGroups,
      removedGroups
    };
  }

  private static indexFieldsByGroup(groups: SchemaGroup[]): Map<string, Map<string, SchemaField>> {
    const result = new Map<string, Map<string, SchemaField>>();
    
    for (const group of groups) {
      const fieldMap = new Map<string, SchemaField>();
      for (const field of group.fields) {
        fieldMap.set(field.fieldId, field);
      }
      result.set(group.groupId, fieldMap);
    }
    
    return result;
  }

  private static findFieldAcrossGroups(
    fieldsByGroup: Map<string, Map<string, SchemaField>>,
    fieldId: string
  ): { groupId: string; field: SchemaField } | null {
    for (const [groupId, fields] of fieldsByGroup.entries()) {
      const field = fields.get(fieldId);
      if (field) {
        return { groupId, field };
      }
    }
    return null;
  }

  private static compareFields(
    oldField: SchemaField,
    newField: SchemaField,
    oldGroupId: string,
    newGroupId: string
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    if (oldGroupId !== newGroupId) {
      changes.push({
        property: 'groupId',
        oldValue: oldGroupId,
        newValue: newGroupId
      });
    }

    if (oldField.fieldName !== newField.fieldName) {
      changes.push({
        property: 'fieldName',
        oldValue: oldField.fieldName,
        newValue: newField.fieldName
      });
    }

    if (oldField.type !== newField.type) {
      changes.push({
        property: 'type',
        oldValue: oldField.type,
        newValue: newField.type
      });
    }

    if (oldField.required !== newField.required) {
      changes.push({
        property: 'required',
        oldValue: oldField.required,
        newValue: newField.required
      });
    }

    if (JSON.stringify(oldField.defaultValue) !== JSON.stringify(newField.defaultValue)) {
      changes.push({
        property: 'defaultValue',
        oldValue: oldField.defaultValue,
        newValue: newField.defaultValue
      });
    }

    if (oldField.type === 'enum' || oldField.type === 'multiselect') {
      const enumChanges = this.compareEnumValues(oldField.enumValues, newField.enumValues);
      if (enumChanges) {
        changes.push(enumChanges);
      }
    }

    if (oldField.isAttachment !== newField.isAttachment) {
      changes.push({
        property: 'isAttachment',
        oldValue: oldField.isAttachment,
        newValue: newField.isAttachment
      });
    }

    return changes;
  }

  private static compareEnumValues(
    oldEnums?: SchemaField['enumValues'],
    newEnums?: SchemaField['enumValues']
  ): FieldChange | null {
    const oldMap = new Map((oldEnums || []).map(e => [e.value, e]));
    const newMap = new Map((newEnums || []).map(e => [e.value, e]));

    const removed: string[] = [];
    const added: string[] = [];
    const deprecated: string[] = [];

    for (const [value, oldEnum] of oldMap.entries()) {
      const newEnum = newMap.get(value);
      if (!newEnum) {
        removed.push(value);
      } else if (newEnum.deprecated && !oldEnum.deprecated) {
        deprecated.push(value);
      }
    }

    for (const value of newMap.keys()) {
      if (!oldMap.has(value)) {
        added.push(value);
      }
    }

    if (removed.length === 0 && added.length === 0 && deprecated.length === 0) {
      return null;
    }

    return {
      property: 'enumValues',
      oldValue: {
        removed,
        deprecated,
        original: oldEnums
      },
      newValue: {
        added,
        original: newEnums
      }
    };
  }

  static printDiff(diff: SchemaDiff): void {
    console.log('\n========================================');
    console.log('          Schema Diff Summary');
    console.log('========================================');

    if (diff.addedGroups.length > 0) {
      console.log('\n✅ Added Groups:');
      for (const group of diff.addedGroups) {
        console.log(`   - ${group.groupName} (${group.groupId})`);
      }
    }

    if (diff.removedGroups.length > 0) {
      console.log('\n❌ Removed Groups:');
      for (const group of diff.removedGroups) {
        console.log(`   - ${group.groupName} (${group.groupId})`);
      }
    }

    if (diff.addedFields.length > 0) {
      console.log('\n➕ Added Fields:');
      for (const field of diff.addedFields) {
        const fieldData = field.newValue as Record<string, unknown>;
        console.log(`   - ${field.fieldId} (${fieldData['fieldName']}) in ${field.groupId}`);
      }
    }

    if (diff.removedFields.length > 0) {
      console.log('\n➖ Removed Fields:');
      for (const field of diff.removedFields) {
        const fieldData = field.oldValue as Record<string, unknown>;
        console.log(`   - ${field.fieldId} (${fieldData['fieldName']}) in ${field.groupId}`);
      }
    }

    if (diff.modifiedFields.length > 0) {
      console.log('\n🔄 Modified Fields:');
      for (const field of diff.modifiedFields) {
        const fieldData = field.oldValue as Record<string, unknown>;
        console.log(`   - ${field.fieldId} (${fieldData['fieldName']})`);
        if (field.changes) {
          for (const change of field.changes) {
            const oldVal = JSON.stringify(change.oldValue);
            const newVal = JSON.stringify(change.newValue);
            console.log(`     * ${change.property}: ${oldVal} → ${newVal}`);
          }
        }
      }
    }

    console.log('\n========================================\n');
  }
}
