package com.maven.dependency.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.*;

public class DependencyNode {
    private String groupId;
    private String artifactId;
    private String version;
    private String scope;
    private String type;
    private String classifier;
    private boolean optional;
    private int depth;
    private String rawLine;
    private int lineNumber;
    
    private List<DependencyNode> children = new ArrayList<>();
    
    @JsonIgnore
    private DependencyNode parent;

    public DependencyNode() {}

    public DependencyNode(String groupId, String artifactId, String version, String scope) {
        this.groupId = groupId;
        this.artifactId = artifactId;
        this.version = version;
        this.scope = scope;
    }

    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }

    public String getArtifactId() { return artifactId; }
    public void setArtifactId(String artifactId) { this.artifactId = artifactId; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getClassifier() { return classifier; }
    public void setClassifier(String classifier) { this.classifier = classifier; }

    public boolean isOptional() { return optional; }
    public void setOptional(boolean optional) { this.optional = optional; }

    public int getDepth() { return depth; }
    public void setDepth(int depth) { this.depth = depth; }

    public String getRawLine() { return rawLine; }
    public void setRawLine(String rawLine) { this.rawLine = rawLine; }

    public int getLineNumber() { return lineNumber; }
    public void setLineNumber(int lineNumber) { this.lineNumber = lineNumber; }

    public List<DependencyNode> getChildren() { return children; }
    public void setChildren(List<DependencyNode> children) { this.children = children; }

    public DependencyNode getParent() { return parent; }
    public void setParent(DependencyNode parent) { this.parent = parent; }

    @JsonProperty("fullName")
    public String getFullName() {
        return groupId + ":" + artifactId;
    }

    @JsonProperty("gav")
    public String getGAV() {
        return groupId + ":" + artifactId + ":" + version;
    }

    public void addChild(DependencyNode child) {
        child.setParent(this);
        children.add(child);
    }

    public List<DependencyNode> getAllDescendants() {
        List<DependencyNode> result = new ArrayList<>();
        collectDescendants(this, result);
        return result;
    }

    private void collectDescendants(DependencyNode node, List<DependencyNode> result) {
        for (DependencyNode child : node.getChildren()) {
            result.add(child);
            collectDescendants(child, result);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        DependencyNode that = (DependencyNode) o;
        return Objects.equals(groupId, that.groupId) &&
               Objects.equals(artifactId, that.artifactId) &&
               Objects.equals(version, that.version);
    }

    @Override
    public int hashCode() {
        return Objects.hash(groupId, artifactId, version);
    }

    @Override
    public String toString() {
        return getGAV() + (scope != null ? ":" + scope : "");
    }
}
