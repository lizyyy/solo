package com.maven.dependency.analyzer;

import com.maven.dependency.model.*;
import java.util.*;
import java.util.stream.Collectors;

public class ConflictAnalyzer {
    private static final List<String> SCOPE_PRIORITY = Arrays.asList("compile", "runtime", "provided", "test", "system");

    public AnalysisResult analyze(AnalysisResult result) {
        List<ConflictInfo> conflicts = new ArrayList<>();

        for (Map.Entry<String, List<DependencyNode>> entry : result.getArtifactMap().entrySet()) {
            String key = entry.getKey();
            List<DependencyNode> nodes = entry.getValue();

            Set<String> versions = nodes.stream()
                .map(DependencyNode::getVersion)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

            if (versions.size() > 1) {
                ConflictInfo conflict = createConflictInfo(key, nodes, versions);
                conflicts.add(conflict);
            }
        }

        conflicts.sort((a, b) -> {
            int severityCompare = b.getSeverity().compareTo(a.getSeverity());
            if (severityCompare != 0) return severityCompare;
            return Integer.compare(b.getConflictingVersions().size(), a.getConflictingVersions().size());
        });

        result.setConflicts(conflicts);
        result.setConflictCount(conflicts.size());

        generateExclusionSuggestions(result);

        return result;
    }

    private ConflictInfo createConflictInfo(String key, List<DependencyNode> nodes, Set<String> versions) {
        ConflictInfo conflict = new ConflictInfo();
        String[] parts = key.split(":");
        conflict.setGroupId(parts[0]);
        conflict.setArtifactId(parts[1]);

        DependencyNode resolved = findResolvedVersion(nodes);
        if (resolved != null) {
            conflict.setResolvedVersion(resolved.getVersion());
            conflict.setMediationReason(determineMediationReason(resolved, nodes));
        }

        for (DependencyNode node : nodes) {
            conflict.addOccurrence(node);
            conflict.addScope(node.getScope());
            if (!node.getVersion().equals(conflict.getResolvedVersion())) {
                conflict.addConflictingVersion(node.getVersion());
            }
        }

        int minDepth = nodes.stream().mapToInt(DependencyNode::getDepth).min().orElse(0);
        conflict.setConflictDepth(minDepth);
        conflict.calculateSeverity();

        return conflict;
    }

    private DependencyNode findResolvedVersion(List<DependencyNode> nodes) {
        return nodes.stream()
            .min(Comparator.comparingInt(DependencyNode::getDepth)
                .thenComparing(n -> n.getParent() == null ? 0 : 1))
            .orElse(nodes.isEmpty() ? null : nodes.get(0));
    }

    private String determineMediationReason(DependencyNode resolved, List<DependencyNode> allNodes) {
        long sameDepthCount = allNodes.stream()
            .filter(n -> n.getDepth() == resolved.getDepth())
            .count();

        if (resolved.getDepth() == 0) {
            return "Direct dependency declaration";
        }

        if (sameDepthCount == 1) {
            return "Nearest wins mediation (depth: " + resolved.getDepth() + ")";
        }

        return "First declaration wins (depth: " + resolved.getDepth() + ")";
    }

    private void generateExclusionSuggestions(AnalysisResult result) {
        for (ConflictInfo conflict : result.getConflicts()) {
            List<ExclusionSuggestion> suggestions = new ArrayList<>();

            for (DependencyNode node : conflict.getOccurrences()) {
                if (!node.getVersion().equals(conflict.getResolvedVersion()) && node.getParent() != null) {
                    DependencyNode parent = node.getParent();
                    ExclusionSuggestion suggestion = new ExclusionSuggestion();
                    suggestion.setFromGroupId(parent.getGroupId());
                    suggestion.setFromArtifactId(parent.getArtifactId());
                    suggestion.setExcludeGroupId(node.getGroupId());
                    suggestion.setExcludeArtifactId(node.getArtifactId());
                    suggestion.setReason("Conflicts with resolved version " + conflict.getResolvedVersion());
                    suggestion.setPriority(calculatePriority(node, conflict));
                    suggestion.setDependencyPath(buildPath(node));
                    suggestions.add(suggestion);
                }
            }

            suggestions.sort(Comparator.comparingInt(ExclusionSuggestion::getPriority));
            conflict.setExclusionSuggestions(suggestions);
        }
    }

    private int calculatePriority(DependencyNode node, ConflictInfo conflict) {
        return node.getDepth() * 100 + 
               (conflict.getSeverity() == ConflictInfo.Severity.CRITICAL ? 0 : 
                conflict.getSeverity() == ConflictInfo.Severity.HIGH ? 1000 : 2000);
    }

    private String buildPath(DependencyNode node) {
        List<String> path = new ArrayList<>();
        DependencyNode current = node;
        while (current != null) {
            path.add(0, current.getArtifactId() + ":" + current.getVersion());
            current = current.getParent();
        }
        return String.join(" → ", path);
    }

    public Set<String> mergeScopes(Set<String> scopes) {
        if (scopes == null || scopes.isEmpty()) {
            return new HashSet<>(Collections.singletonList("compile"));
        }

        Set<String> effectiveScopes = new HashSet<>();
        for (String scope : SCOPE_PRIORITY) {
            if (scopes.contains(scope)) {
                effectiveScopes.add(scope);
                break;
            }
        }
        return effectiveScopes;
    }
}
