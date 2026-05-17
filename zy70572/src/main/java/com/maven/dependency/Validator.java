package com.maven.dependency;

import com.maven.dependency.analyzer.ConflictAnalyzer;
import com.maven.dependency.model.*;
import com.maven.dependency.parser.DependencyTreeParser;

import java.io.File;
import java.util.List;
import java.util.Map;

public class Validator {
    public static void main(String[] args) {
        System.out.println("========================================");
        System.out.println("  Maven Dependency Conflict CLI - 验证器");
        System.out.println("========================================");

        String inputFile = args.length > 0 ? args[0] : "sample-dependency-tree.txt";
        System.out.println("\n[1] 解析依赖树: " + inputFile);

        try {
            DependencyTreeParser parser = new DependencyTreeParser();
            ConflictAnalyzer analyzer = new ConflictAnalyzer();

            AnalysisResult result = parser.parse(new File(inputFile));
            System.out.println("    - 总依赖数: " + result.getTotalDependencies());
            System.out.println("    - 唯一 Artifact 数: " + result.getUniqueArtifacts());

            System.out.println("\n[2] 解析验证 - 前 10 个依赖:");
        int count = 0;
        for (Map.Entry<String, List<DependencyNode>> entry : result.getArtifactMap().entrySet()) {
            if (count++ >= 10) break;
            List<DependencyNode> nodes = entry.getValue();
            DependencyNode node = nodes.get(0);
            System.out.printf("    - %s:%s:%s (scope:%s, occurrences:%d)%n",
                node.getGroupId(),
                node.getArtifactId(),
                node.getVersion(),
                node.getScope(),
                nodes.size());
            for (int i = 1; i < nodes.size(); i++) {
                DependencyNode n = nodes.get(i);
                System.out.printf("        -> %s:%s:%s (%s)%n",
                    n.getGroupId(), n.getArtifactId(), n.getVersion(), n.getScope());
            }
        }

            System.out.println("\n[3] 冲突分析中...");
            result = analyzer.analyze(result);

            System.out.println("    - 发现冲突: " + result.getConflictCount() + " 个");

            if (result.getConflictCount() > 0) {
                System.out.println("\n[4] 冲突详情:");
                for (ConflictInfo conflict : result.getConflicts()) {
                    System.out.printf("    [%s] %s:%s%n",
                        conflict.getSeverity(),
                        conflict.getGroupId(),
                        conflict.getArtifactId());
                    System.out.printf("      - 裁决版本: %s (理由: %s)%n",
                        conflict.getResolvedVersion(),
                        conflict.getMediationReason());
                    System.out.printf("      - 冲突版本: %s%n", conflict.getConflictingVersions());
                    System.out.printf("      - 作用域: %s%n", conflict.getScopes());
                    System.out.printf("      - 出现次数: %d%n", conflict.getOccurrences().size());

                    if (!conflict.getExclusionSuggestions().isEmpty()) {
                        System.out.println("      - 排除建议:");
                        for (ExclusionSuggestion suggestion : conflict.getExclusionSuggestions()) {
                            System.out.printf("        * 在 %s:%s 中排除 %s:%s%n",
                                suggestion.getFromGroupId(),
                                suggestion.getFromArtifactId(),
                                suggestion.getExcludeGroupId(),
                                suggestion.getExcludeArtifactId());
                        }
                    }
                    System.out.println();
                }
            }

            if (!result.getBadLines().isEmpty()) {
                System.out.println("\n[5] 解析错误 (坏行保留):");
                for (BadLine bad : result.getBadLines()) {
                    System.out.printf("    第 %d 行: %s%n", bad.getLineNumber(), bad.getErrorReason());
                    System.out.printf("      内容: %s%n", bad.getLineContent());
                }
            }

            System.out.println("\n========================================");
            System.out.println("  验证完成!");
            System.out.println("========================================");

            if (result.getConflictCount() > 0) {
                boolean hasSpringCore = result.getConflicts().stream()
                    .anyMatch(c -> "spring-core".equals(c.getArtifactId()));
                boolean hasHttpCore = result.getConflicts().stream()
                    .anyMatch(c -> "httpcore".equals(c.getArtifactId()));
                boolean hasCommonsLogging = result.getConflicts().stream()
                    .anyMatch(c -> "commons-logging".equals(c.getArtifactId()));

                System.out.println("\n目标冲突检测验证:");
                System.out.println("  - spring-core 冲突: " + (hasSpringCore ? "✓ 检测到" : "✗ 未检测到"));
                System.out.println("  - httpcore 冲突: " + (hasHttpCore ? "✓ 检测到" : "✗ 未检测到"));
                System.out.println("  - commons-logging 冲突: " + (hasCommonsLogging ? "✓ 检测到" : "✗ 未检测到"));
            }

        } catch (Exception e) {
            System.err.println("\n错误: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
