export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'any';
export type EventStatus = 'active' | 'deprecated' | 'removed' | 'renamed';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueType = 'event_missing' | 'event_renamed' | 'event_deprecated' | 'parameter_missing' | 'parameter_type_changed' | 'parameter_value_invalid' | 'sampling_delay' | 'page_path_changed' | 'schema_mismatch' | 'version_mismatch';
export interface ParameterSchema {
    name: string;
    type: ParameterType;
    required: boolean;
    description?: string;
    enum?: string[] | number[];
    pattern?: string;
    minimum?: number;
    maximum?: number;
    items?: ParameterSchema;
    properties?: Record<string, ParameterSchema>;
}
export interface EventDefinition {
    id: string;
    name: string;
    description?: string;
    pagePath: string;
    parameters: ParameterSchema[];
    status: EventStatus;
    version: string;
    renamedFrom?: string;
    deprecatedSince?: string;
    categories?: string[];
    owner?: string;
    tags?: string[];
    attachments?: string[];
    notes?: string;
}
export interface TrackingManifest {
    version: string;
    releaseVersion: string;
    generatedAt: string;
    generatedBy?: string;
    events: EventDefinition[];
    notes?: string;
    attachments?: string[];
}
export interface EventParameter {
    [key: string]: any;
}
export interface EventLogEntry {
    eventId: string;
    eventName: string;
    timestamp: number;
    pagePath: string;
    parameters: EventParameter;
    sessionId?: string;
    userId?: string;
    version?: string;
    samplingRate?: number;
    rawPayload?: string;
}
export interface EventLog {
    version: string;
    collectedAt: string;
    collectionDuration?: number;
    entries: EventLogEntry[];
    source?: string;
    notes?: string;
    attachments?: string[];
}
export interface Issue {
    id: string;
    type: IssueType;
    severity: IssueSeverity;
    eventId?: string;
    eventName?: string;
    message: string;
    reason: string;
    impactScope: string[];
    nextActions: string[];
    expected?: any;
    actual?: any;
    diff?: string;
    pagePath?: string;
    parameterName?: string;
    attachments?: string[];
    notes?: string;
}
export interface EventValidationResult {
    eventId: string;
    eventName: string;
    status: 'pass' | 'fail' | 'warning' | 'missing';
    issues: Issue[];
    parameterValidations: {
        parameterName: string;
        status: 'pass' | 'fail' | 'warning' | 'missing';
        message?: string;
        expectedType?: ParameterType;
        actualType?: string;
    }[];
    pagePathMatch: boolean;
    expectedPagePath?: string;
    actualPagePath?: string;
    sampleCount: number;
    firstSeen?: number;
    lastSeen?: number;
    samplingDelayMs?: number;
}
export interface VersionComparison {
    baseVersion: string;
    targetVersion: string;
    newEvents: string[];
    removedEvents: string[];
    renamedEvents: {
        from: string;
        to: string;
    }[];
    modifiedEvents: string[];
    parameterChanges: {
        eventId: string;
        parameterName: string;
        changeType: 'added' | 'removed' | 'type_changed' | 'required_changed';
        oldValue?: any;
        newValue?: any;
    }[];
}
export interface RegressionReport {
    id: string;
    title: string;
    generatedAt: string;
    generatedBy?: string;
    manifestVersion: string;
    releaseVersion: string;
    totalEvents: number;
    passedEvents: number;
    failedEvents: number;
    warningEvents: number;
    missingEvents: number;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
    results: EventValidationResult[];
    issues: Issue[];
    versionComparison?: VersionComparison;
    notes?: string;
    attachments?: string[];
    manualCorrections?: {
        eventId: string;
        correctionType: string;
        reason: string;
        correctedBy: string;
        correctedAt: string;
    }[];
}
export interface CliOptions {
    manifest: string;
    log: string;
    baseline?: string;
    output?: string;
    format: 'json' | 'markdown' | 'html' | 'excel' | 'all';
    severity?: IssueSeverity;
    pagePath?: string;
    category?: string;
    strict: boolean;
    includeNotes: boolean;
    includeAttachments: boolean;
}
export interface ValidationConfig {
    samplingDelayThresholdMs: number;
    allowDeprecatedEvents: boolean;
    allowOptionalParameters: boolean;
    strictTypeChecking: boolean;
    pagePathMatching: 'exact' | 'prefix' | 'regex';
}
