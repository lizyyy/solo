package com.maven.dependency.model;

import java.util.*;

public class AnalysisResult {
    private String projectName;
    private String inputFile;
    private long analysisTimestamp;
    private int totalDependencies;
    private int uniqueArtifacts;
    private int conflictCount;
    private List<ConflictInfo> conflicts = new ArrayList<>();
    private List<BadLine> badLines = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private DependencyNode rootNode;
    private Map<String, List<DependencyNode>> artifactMap = new HashMap<>();

    public AnalysisResult() {
        this.analysisTimestamp = System.currentTimeMillis();
    }

    public String getProjectName() { return projectName; }
    public     public     public     public     public     public     public     public     public     public     public     public     public     public     public     public     public     public     public inputFile; }

    public long getAnalysisTimestamp() { return analysisTimestamp; }
    public void setAnalysisTimestamp(long analysisTimestamp) { this.analysisTimestamp = analysisTimestamp; }

    public int getTotalDependencies() { return totalDependencies; }
    public void setTotalDependencies(int totalDependencies) { this.totalDependencies = totalDependencies; }

    public int getUniqueArtifacts() { return uniqueArtifacts; }
    public void setUniqueArtifacts(int uniqueArtifacts) { this.uniqueArtifacts = uniqueArtifacts; }

    public int getConflictCount() { return conflictCount; }
    public void setConflictCount(int conflictCount) { this.conflictCount = conflictCount; }

    public List<ConflictInfo> getConflicts() { return conflicts; }
    public void setConflicts(List<ConflictInfo> conflicts) { this.conflicts = conflicts; }

    public List<BadLine> getBadLines() { return badLines; }
    public void setBadLines(List<BadLine> badLines) { this.badLines = badLines; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }

    public DependencyNode getRootNode() { return rootNode; }
    public void setRootNode(DependencyNode rootNode) { this.rootNode = rootNode; }

    public Map<String, List<DependencyNode>> getArtifactMap() { return artifactMap; }
    public void setArtifactMap(Map<String, List<DependencyNode>> artifactMap) { this.artifactMap = artifactMap; }

    public void addBadLine(BadLine badLine) {
        badLines.add(badLine);
    }

    public void addWarning(String warning) {
        warnings.add(warning);
    }

    public void addArtifactOccurrence(String key, DependencyNode node) {
        artifactMap.computeIfAbsent(key, k -> new ArrayList<>()).add(node);
    }
}
