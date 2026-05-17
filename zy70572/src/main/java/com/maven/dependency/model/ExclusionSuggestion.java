package com.maven.dependency.model;

public class ExclusionSuggestion {
    private String fromGroupId;
    private String fromArtifactId;
    private String excludeGroupId;
    private String excludeArtifactId;
    private String reason;
    private int priority;
    private String dependencyPath;

    public ExclusionSuggestion() {
    }

    public ExclusionSuggestion(String fromGroupId, String fromArtifactId,
                               String excludeGroupId, String excludeArtifactId,
                               String reason, int priority) {
        this.fromGroupId = fromGroupId;
        this.fromArtifactId = fromArtifactId;
        this.excludeGroupId = excludeGroupId;
        this.excludeArtifactId = excludeArtifactId;
        this.reason = reason;
        this.priority = priority;
    }

    public String getFromGroupId() {
        return fromGroupId;
    }

    public void setFromGroupId(String fromGroupId) {
        this.fromGroupId = fromGroupId;
    }

    public String getFromArtifactId() {
        return fromArtifactId;
    }

    public void setFromArtifactId(String fromArtifactId) {
        this.fromArtifactId = fromArtifactId;
    }

    public String getExcludeGroupId() {
        return excludeGroupId;
    }

    public void setExcludeGroupId(String excludeGroupId) {
        this.excludeGroupId = excludeGroupId;
    }

    public String getExcludeArtifactId() {
        return excludeArtifactId;
    }

    public void setExcludeArtifactId(String excludeArtifactId) {
        this.excludeArtifactId = excludeArtifactId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public int getPriority() {
        return priority;
    }

    public void setPriority(int priority) {
        this.priority = priority;
    }

    public String getDependencyPath() {
        return dependencyPath;
    }

    public void setDependencyPath(String dependencyPath) {
        this.dependencyPath = dependencyPath;
    }

    public String toMavenXml() {
        return String.format(
            "<exclusion>\n" +
            "  <groupId>%s</groupId>\n" +
            "  <artifactId>%s</artifactId>\n" +
            "</exclusion>",
            excludeGroupId, excludeArtifactId
        );
    }

    public String getLocationComment() {
        return String.format("<!-- Add this exclusion to %s:%s dependency -->",
                           fromGroupId, fromArtifactId);
    }
}
