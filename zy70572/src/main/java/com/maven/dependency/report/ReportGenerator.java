package com.maven.dependency.report;

import com.maven.dependency.model.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

public class ReportGenerator {
    private final SimpleDateFormat dateFormat;

    public ReportGenerator() {
        this.dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    }

    public String generateConsoleSummary(AnalysisResult result) {
        StringBuilder sb = new StringBuilder();
        String separator = "=".repeat(80) + "\n";

        sb.append("\n").append(separator);
        sb.append("MAVEN DEPENDENCY CONFLICT ANALYSIS REPORT\n");
        sb.append(separator);
        sb.append(String.format("Project: %s\n", result.getProjectName() != null ? result.getProjectName() : "N/A"));
        sb.append(String.format("Analysis Time: %s\n", dateFormat.format(new Date(result.getAnalysisTimestamp()))));
        sb.append(String.format("Input File: %s\n", result.getInputFile()));
        sb.append("\n");
        sb.append(String.format("Total Dependencies: %d\n", result.getTotalDependencies()));
        sb.append(String.format("Unique Artifacts: %d\n", result.getUniqueArtifacts()));
        sb.append(String.format("Conflicts Found: %d\n", result.getConflictCount()));
        sb.append(String.format("Parse Errors: %d\n", result.getBadLines().size()));
        sb.append("\n");

        if (result.getConflictCount() > 0) {
            sb.append(separator);
            sb.append("CONFLICT SUMMARY\n");
            sb.append(separator);

            for (ConflictInfo conflict : result.getConflicts()) {
                sb.append(String.format("\n[%s] %s:%s\n",
                    conflict.getSeverity(),
                    conflict.getGroupId(),
                    conflict.getArtifactId()));
                sb.append(String.format("  Resolved Version: %s\n", conflict.getResolvedVersion()));
                sb.append(String.format("  Conflicting Versions: %s\n",
                    String.join(", ", conflict.getConflictingVersions())));
                sb.append(String.format("  Scopes: %s\n",
                    String.join(", ", conflict.getScopes())));
                sb.append(String.format("  Mediation Reason: %s\n", conflict.getMediationReason()));
            }
        }

        if (!result.getBadLines().isEmpty()) {
            sb.append("\n").append(separator);
            sb.append("PARSE ERRORS\n");
            sb.append(separator);
            for (BadLine bad : result.getBadLines()) {
                sb.append(String.format("\nLine %d: %s\n", bad.getLineNumber(), bad.getErrorReason()));
                sb.append(String.format("  Content: %s\n", bad.getLineContent()));
            }
        }

        sb.append("\n").append(separator);
        return sb.toString();
    }

    public void writeJsonReport(AnalysisResult result, File outputFile) throws IOException {
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append(String.format("  \"projectName\": %s,\n", jsonEscape(result.getProjectName())));
        json.append(String.format("  \"analysisTime\": %s,\n", jsonEscape(dateFormat.format(new Date(result.getAnalysisTimestamp())))));
        json.append(String.format("  \"inputFile\": %s,\n", jsonEscape(result.getInputFile())));
        json.append(String.format("  \"totalDependencies\": %d,\n", result.getTotalDependencies()));
        json.append(String.format("  \"uniqueArtifacts\": %d,\n", result.getUniqueArtifacts()));
        json.append(String.format("  \"conflictCount\": %d,\n", result.getConflictCount()));
        json.append(String.format("  \"warnings\": %s,\n", toJsonArray(result.getWarnings())));

        json.append("  \"conflicts\": [\n");
        for (int i = 0; i < result.getConflicts().size(); i++) {
            ConflictInfo c = result.getConflicts().get(i);
            json.append("    {\n");
            json.append(String.format("      \"severity\": %s,\n", jsonEscape(c.getSeverity().toString())));
            json.append(String.format("      \"groupId\": %s,\n", jsonEscape(c.getGroupId())));
            json.append(String.format("      \"artifactId\": %s,\n", jsonEscape(c.getArtifactId())));
            json.append(String.format("      \"resolvedVersion\": %s,\n", jsonEscape(c.getResolvedVersion())));
            json.append(String.format("      \"conflictingVersions\": %s,\n", toJsonArray(c.getConflictingVersions())));
            json.append(String.format("      \"scopes\": %s,\n", toJsonArray(c.getScopes())));
            json.append(String.format("      \"mediationReason\": %s,\n", jsonEscape(c.getMediationReason())));

            json.append("      \"exclusionSuggestions\": [\n");
            for (int j = 0; j < c.getExclusionSuggestions().size(); j++) {
                ExclusionSuggestion s = c.getExclusionSuggestions().get(j);
                json.append("        {\n");
                json.append(String.format("          \"fromArtifact\": %s,\n",
                    jsonEscape(s.getFromGroupId() + ":" + s.getFromArtifactId())));
                json.append(String.format("          \"excludeArtifact\": %s,\n",
                    jsonEscape(s.getExcludeGroupId() + ":" + s.getExcludeArtifactId())));
                json.append(String.format("          \"reason\": %s,\n", jsonEscape(s.getReason())));
                json.append(String.format("          \"priority\": %d,\n", s.getPriority()));
                json.append(String.format("          \"mavenXml\": %s\n", jsonEscape(s.toMavenXml())));
                json.append("        }").append(j < c.getExclusionSuggestions().size() - 1 ? ",\n" : "\n");
            }
            json.append("      ]\n");
            json.append("    }").append(i < result.getConflicts().size() - 1 ? ",\n" : "\n");
        }
        json.append("  ],\n");

        json.append("  \"parseErrors\": [\n");
        for (int i = 0; i < result.getBadLines().size(); i++) {
            BadLine b = result.getBadLines().get(i);
            json.append("    {\n");
            json.append(String.format("      \"lineNumber\": %d,\n", b.getLineNumber()));
            json.append(String.format("      \"content\": %s,\n", jsonEscape(b.getLineContent())));
            json.append(String.format("      \"reason\": %s\n", jsonEscape(b.getErrorReason())));
            json.append("    }").append(i < result.getBadLines().size() - 1 ? ",\n" : "\n");
        }
        json.append("  ]\n");
        json.append("}\n");

        try (OutputStreamWriter writer = new OutputStreamWriter(
                new FileOutputStream(outputFile), StandardCharsets.UTF_8)) {
            writer.write(json.toString());
        }
    }

    public void writeMarkdownReport(AnalysisResult result, File outputFile) throws IOException {
        try (OutputStreamWriter writer = new OutputStreamWriter(
                new FileOutputStream(outputFile), StandardCharsets.UTF_8)) {

            writer.write("# Maven Dependency Conflict Report\n\n");
            writer.write(String.format("**Project**: %s  \n",
                result.getProjectName() != null ? result.getProjectName() : "N/A"));
            writer.write(String.format("**Generated**: %s  \n",
                dateFormat.format(new Date(result.getAnalysisTimestamp()))));
            writer.write(String.format("**Input**: `%s`\n\n", result.getInputFile()));

            writer.write("## Summary\n\n");
            writer.write("| Metric | Value |\n");
            writer.write("|--------|-------|\n");
            writer.write(String.format("| Total Dependencies | %d |\n", result.getTotalDependencies()));
            writer.write(String.format("| Unique Artifacts | %d |\n", result.getUniqueArtifacts()));
            writer.write(String.format("| Conflicts Found | %d |\n", result.getConflictCount()));
            writer.write(String.format("| Parse Errors | %d |\n\n", result.getBadLines().size()));

            if (result.getConflictCount() > 0) {
                writer.write("## Conflicts\n\n");

                for (ConflictInfo conflict : result.getConflicts()) {
                    writer.write(String.format("### [%s] `%s:%s`\n\n",
                        conflict.getSeverity(),
                        conflict.getGroupId(),
                        conflict.getArtifactId()));

                    writer.write("- **Resolved Version**: `" + conflict.getResolvedVersion() + "`\n");
                    writer.write("- **Conflicting Versions**: `" +
                        String.join("`, `", conflict.getConflictingVersions()) + "`\n");
                    writer.write("- **Scopes**: `" + String.join("`, `", conflict.getScopes()) + "`\n");
                    writer.write("- **Mediation Reason**: " + conflict.getMediationReason() + "\n\n");

                    if (!conflict.getExclusionSuggestions().isEmpty()) {
                        writer.write("#### Exclusion Suggestions\n\n");
                        writer.write("| From Dependency | Exclude | Reason |\n");
                        writer.write("|-----------------|---------|--------|\n");

                        for (ExclusionSuggestion s : conflict.getExclusionSuggestions()) {
                            writer.write(String.format("| `%s:%s` | `%s:%s` | %s |\n",
                                s.getFromGroupId(), s.getFromArtifactId(),
                                s.getExcludeGroupId(), s.getExcludeArtifactId(),
                                s.getReason()));
                        }
                        writer.write("\n");

                        writer.write("#### Maven XML Exclusions\n\n");
                        writer.write("```xml\n");
                        for (ExclusionSuggestion s : conflict.getExclusionSuggestions()) {
                            writer.write("<!-- Add this exclusion to " + s.getFromGroupId() + ":" + s.getFromArtifactId() + " -->\n");
                            writer.write(s.toMavenXml() + "\n\n");
                        }
                        writer.write("```\n\n");
                    }
                }
            }

            if (!result.getBadLines().isEmpty()) {
                writer.write("## Parse Errors\n\n");
                writer.write("The following lines could not be parsed:\n\n");
                writer.write("| Line | Content | Reason |\n");
                writer.write("|------|---------|--------|\n");
                for (BadLine b : result.getBadLines()) {
                    writer.write(String.format("| %d | `%s` | %s |\n",
                        b.getLineNumber(),
                        b.getLineContent().replace("|", "\\|"),
                        b.getErrorReason()));
                }
            }
        }
    }

    private String jsonEscape(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    private String toJsonArray(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            sb.append(jsonEscape(list.get(i)));
            if (i < list.size() - 1) sb.append(", ");
        }
        sb.append("]");
        return sb.toString();
    }
}
