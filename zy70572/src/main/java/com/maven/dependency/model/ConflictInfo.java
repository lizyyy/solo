package com.maven.dependency.model;

import java.util.*;

public class ConflictInfo {
    private String groupId;
    private String artifactId;
    private String resolvedVersion;
    private List<String> conflictingVersions = new ArrayList<>();
    private List<DependencyNode> occurrences = new ArrayList<>();
    private List<String> scopes = new ArrayList<>();
    private String mediationReason;
    private List<ExclusionSuggestion> exclusionSuggestions = new ArrayList<>();
    private int conflictDepth;
    private Severity severity;

    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    public    pusion() { return resolvedVersion; }
    public void setResolvedVersion(String resolvedVersion) { this.resolvedVersion = resolvedVersion; }

    public List<String> getConflictingVersions() { return conflictingVersions; }
    public void setConflictingVersions(List<String> conflictingVersions) { this.conflictingVersions = conflictingVersions; }

    public List<DependencyNode> getOccurrences() { return occurrences; }
    public void setOccurrences(List<DependencyNode> occurrences) { this.occurrences = occurrences; }

    public List<String> getScopes() { return scopes; }
    public void setScopes(List<String> scopes) { this.scopes = scopes; }

    public String getMediationReason() { return mediationReason; }
    public void setMediationReason(String mediationReason) { this.mediationReason = mediationReason; }

    public List<ExclusionSuggestion> getExclusionSuggestions() { return exclusionSuggestions; }
    public void setExclusionSuggestions(List<ExclusionSuggestion> exclusionSuggestions) { this.exclusionSuggestions = exclusionSuggestions; }

    public int getConflictDepth() { return conflictDepth; }
    public void setConflictDepth(int conflictDepth) { this.conflictDepth = conflictDepth; }

    public Severity getSeverity() { return severity; }
    public void setSeverity(Severity severity) { this.severity = severity; }

    public String getArtifactKey() {
        return groupId + ":" + artifactId;
    }

    public void addConflictingVersion(String version) {
        if (!conflictingVersions.contains(version)) {
            conflictingVersions.add(version);
        }
    }

    public void addOccurrence(DependencyNode node) {
        occurrences.add(node);
    }

    public void addScope(String scope) {
        if (scope != null && !scopes.contains(scope)) {
            scopes.add(scope);
        }
    }

    public void calculateSeverity() {
        int versionCount = conflictingVersions.size();
        if (versionCount >= 3) {
            severity = Severity.CRITICAL;
        } else if (versionCount == 2) {
            severity = Severity.HIGH;
        } else if (conflictDepth <= 2) {
            severity = Severity.MEDIUM;
        } else {
            severity = Severity.LOW;
        }
    }
}
