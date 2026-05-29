"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionComparator = void 0;
const Diff = __importStar(require("diff"));
class VersionComparator {
    compare(baseManifest, targetManifest) {
        const baseEvents = new Map(baseManifest.events.map(e => [e.id, e]));
        const targetEvents = new Map(targetManifest.events.map(e => [e.id, e]));
        const newEvents = [];
        const removedEvents = [];
        const renamedEvents = [];
        const modifiedEvents = [];
        const parameterChanges = [];
        for (const [eventId, targetEvent] of targetEvents) {
            const baseEvent = baseEvents.get(eventId);
            if (!baseEvent) {
                const renamedFrom = this.findRenamedFrom(targetEvent, baseManifest.events);
                if (renamedFrom) {
                    renamedEvents.push({ from: renamedFrom, to: eventId });
                }
                else {
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
    findRenamedFrom(targetEvent, baseEvents) {
        if (targetEvent.renamedFrom) {
            const baseEvent = baseEvents.find(e => e.id === targetEvent.renamedFrom || e.name === targetEvent.renamedFrom);
            return baseEvent?.id || null;
        }
        return null;
    }
    isEventModified(base, target) {
        if (base.name !== target.name)
            return true;
        if (base.pagePath !== target.pagePath)
            return true;
        if (base.status !== target.status)
            return true;
        if (base.parameters.length !== target.parameters.length)
            return true;
        const baseParams = new Map(base.parameters.map(p => [p.name, p]));
        for (const targetParam of target.parameters) {
            const baseParam = baseParams.get(targetParam.name);
            if (!baseParam)
                return true;
            if (baseParam.type !== targetParam.type)
                return true;
            if (baseParam.required !== targetParam.required)
                return true;
        }
        return false;
    }
    compareParameters(baseParams, targetParams, eventId) {
        const changes = [];
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
    generateDiffReport(baseManifest, targetManifest) {
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
exports.VersionComparator = VersionComparator;
//# sourceMappingURL=version-comparator.js.map