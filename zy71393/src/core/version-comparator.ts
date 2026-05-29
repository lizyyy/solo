import { TrackingManifest, EventDefinition, VersionComparison, ParameterSchema } from '../types';
import * as Diff from 'diff';

export class VersionComparator {
  compare(baseManifest: TrackingManifest, targetManifest: TrackingManifest): VersionComparison {
    const baseEvents = new Map(baseManifest.events.map(e => [e.id, e]));
    const targetEvents = new Map(targetManifest.events.map(e => [e.id, e]));

    const newEvents: string[] = [];
    const removedEvents: string[] = [];
    const renamedEvents: { from: string; to: string }[] = [];
    const modifiedEvents: string[] = [];
    const parameterChanges: VersionComparison['parameterChanges'] = [];

    for (const [eventId, targetEvent] of targetEvents) {
      const baseEvent = baseEvents.get(eventId);
      
      if (!baseEvent) {
        const renamedFrom = this.findRenamedFrom(targetEvent, baseManifest.events);
        if (renamedFrom) {
          renamedEvents.push({ from: renamedFrom, to: eventId });
        } else {
          newEvents.push(eventId);
        }
        continue;
      }

      if (this.isEventModified(baseEvent, targetEvent)) {
        modifiedEvents.push(eventId);
        
        const paramDiffs = this.compareParameters(baseEvent.parameters, targetEvent.parameters, eventId);
        parameterChanges.push(...paramDiffs);
      }
    }

    for (const [eventId, baseEvent] of baseEvents) {
      if (!targetEvents.has(eventId)) {
        const renamedTo = targetManifest.events.find(e => e.renamedFrom === eventId || e.renamedFrom === baseEvent.name);
        if (!renamedTo) {
          removedEvents.push(eventId);
        }
      }
    }

    return {
      baseVersion: baseManifest.releaseVersion,
      targetVersion: targetManifest.releaseVersion,
      newEvents,
      removedEvents,
      renamedEvents,
      modifiedEvents,
      parameterChanges
    };
  }

  private findRenamedFrom(targetEvent: EventDefinition, baseEvents: EventDefinition[]): string | null {
    if (targetEvent.renamedFrom) {
      const baseEvent = baseEvents.find(e => e.id === targetEvent.renamedFrom || e.name === targetEvent.renamedFrom);
      return baseEvent?.id || null;
    }
    return null;
  }

  private isEventModified(base: EventDefinition, target: EventDefinition): boolean {
    if (base.name !== target.name) return true;
    if (base.pagePath !== target.pagePath) return true;
    if (base.status !== target.status) return true;
    if (base.parameters.length !== target.parameters.length) return true;
    
    const baseParams = new Map(base.parameters.map(p => [p.name, p]));
    for (const targetParam of target.parameters) {
      const baseParam = baseParams.get(targetParam.name);
      if (!baseParam) return true;
      if (baseParam.type !== targetParam.type) return true;
      if (baseParam.required !== targetParam.required) return true;
    }
    
    return false;
  }

  private compareParameters(
    baseParams: ParameterSchema[],
    targetParams: ParameterSchema[],
    eventId: string
  ): VersionComparison['parameterChanges'] {
    const changes: VersionComparison['parameterChanges'] = [];
    const baseParamMap = new Map(baseParams.map(p => [p.name, p]));
    const targetParamMap = new Map(targetParams.map(p => [p.name, p]));

    for (const [name, targetParam] of targetParamMap) {
      const baseParam = baseParamMap.get(name);
      
      if (!baseParam) {
        changes.push({
          eventId,
          parameterName: name,
          changeType: 'added',
          newValue: {
            type: targetParam.type,
            required: targetParam.required
          }
        });
        continue;
      }

      if (baseParam.type !== targetParam.type) {
        changes.push({
          eventId,
          parameterName: name,
          changeType: 'type_changed',
          oldValue: baseParam.type,
          newValue: targetParam.type
        });
      }

      if (baseParam.required !== targetParam.required) {
        changes.push({
          eventId,
          parameterName: name,
          changeType: 'required_changed',
          oldValue: baseParam.required,
          newValue: targetParam.required
        });
      }
    }

    for (const [name, baseParam] of baseParamMap) {
      if (!targetParamMap.has(name)) {
        changes.push({
          eventId,
          parameterName: name,
          changeType: 'removed',
          oldValue: {
            type: baseParam.type,
            required: baseParam.required
          }
        });
      }
    }

    return changes;
  }

  generateDiffReport(baseManifest: TrackingManifest, targetManifest: TrackingManifest): string {
    const baseStr = JSON.stringify(baseManifest, null, 2);
    const targetStr = JSON.stringify(targetManifest, null, 2);
    const diff = Diff.diffJson(baseStr, targetStr);
    
    let result = '';
    for (const part of diff) {
      const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
      result += prefix + part.value;
    }
    return result;
  }
}
