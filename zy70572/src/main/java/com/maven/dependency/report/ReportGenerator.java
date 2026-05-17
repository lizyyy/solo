package com.maven.dependency.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.maven.dependency.model.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

public class ReportGenerator {
    private final ObjectMapper objectMapper;
    private final SimpleDateFormat dateFormat;

    public ReportGenerator() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
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
                sb.append(String.format("  Resolved: %s\n", conflict.getResolvedVersion()));
                sb.append(String.format("  Conflicting: %s\n", 
                    String.join(", ", conflict.getConflictingVersions())));
                sb.append(String.format("  Scopes: %s\n", 
                    String.join(", ", conflict.getScopes())));
                sb.append(String.format("  Mediation: %s\n", conflict.getMediationReason()));
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
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("projectName", result.getProjectName());
        report.put("analysisTime", dateFormat.format(new Date(result.getAnalysisTimestamp())));
        report.put("inputFile", result.getInputFile());
        report.put("totalDependencies", result.getTotalDependencies());
        report.put("uniqueArtifacts", result.getUniqueArtifacts());
        report.put("conflictCount", result.getConflictCount());
        report.put("warnings", result.getWarnings());

        List<Map<String, Object>> conflicts = new ArrayList<>();
        for (ConflictInfo c : result.getConflicts()) {
            Map<String, Object> cm = new LinkedHashMap<>();
            cm.put("severity", c.getSeverity().toString());
            cm.put("groupId", c.getGroupId());
            cm.put("artifactId", c.getArtifactId());
            cm.put("resolvedVersion", c.getResolvedVersion());
            cm.put("conflictingVersions", c.getConflictingVersions());
            cm.put("scopes", c.getScopes());
            cm.put("mediationReason", c.getMediationReason());

            List<Map<String, Object>> suggestions = new ArrayList<>();
            for (ExclusionSuggestion s : c.getExclusionSuggestions()) {
                Map<String, Object> sm = new LinkedHashMap<>();
                sm.put("fromArtifact", s.getFromGroupId() + ":" + s.getFromArtifactId());
                sm.put("excludeArtifact", s.getExcludeGroupId() + ":" + s.getExcludeArtifactId());
                sm.put("reason", s.getReason());
                sm.put("priority", s.getPriority());
                sm.put("mavenXml", s.toMavenXml());
                suggestions.add(sm);
            }
            cm.put("exclusionSuggestions", suggestions);
            conflicts.add(cm);
        }
        report.put("conflicts", conflicts);

        List<Map<String, Object>> badLines = new ArrayList<>();
        for (BadLine b : result.getBadLines()) {
            Map<String, Object> bm = new LinkedHashMap<>();
            bm.put("lineNumber", b.getLineNumber());
            bm.put("content", b.getLineContent());
            bm.put("reason", b.getErrorReason());
            badLines.add(bm);
        }
        report.put("parseErrors", badLines);

        try (OutputStreamWriter writer = new OutputStreamWriter(
                new FileOutputStream(outputFile), StandardCharsets.UTF_8)) {
            objectMapper.writeValue(writer, report);
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
                            writer.write("<!-- " + s.getLocationComment().replace("<!-- ", "").replace(" -->", "") + " -->\n");
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
}
