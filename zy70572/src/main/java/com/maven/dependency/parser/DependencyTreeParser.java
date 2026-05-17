package com.maven.dependency.parser;

import com.maven.dependency.model.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;

public class DependencyTreeParser {
    private static final Pattern DEP_PATTERN = Pattern.compile(
        "^[\\\\| +-]*([\\w.-]+:[\\w.-]+:[\\w.-]+(?::[\\w.-]+){0,2})(?: *\\(optional\\))?$"
    );

    public AnalysisResult parse(File inputFile) throws IOException {
        AnalysisResult result = new AnalysisResult();
        result.setInputFile(inputFile.getAbsolutePath());

        List<String> lines = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(new FileInputStream(inputFile), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                lines.add(line);
            }
        }

        return parseLines(lines, result);
    }

    public AnalysisResult parseLines(List<String> lines, AnalysisResult result) {
        Deque<DependencyNode> stack = new ArrayDeque<>();
        int lineNum = 0;
        int totalDeps = 0;

        for (String rawLine : lines) {
            lineNum++;
            String line = rawLine.trim();

            if (line.isEmpty()) {
                continue;
            }

            if (line.startsWith("[INFO]") || line.startsWith("[DEBUG]") || line.startsWith("[WARNING]")) {
                line = line.substring(6).trim();
            }

            if (line.contains("--- maven-dependency-plugin") || line.contains("BUILD") ||
                line.contains("Total time") || line.contains("Finished at") ||
                line.contains("Scanning for projects") || line.contains("--------") ||
                line.contains("Building ") || line.contains("maven-dependency-plugin")) {
                continue;
            }

            try {
                int depth = calculateDepth(rawLine);

                Matcher depMatcher = DEP_PATTERN.matcher(line);
                if (depMatcher.find()) {
                    String gavString = depMatcher.group(1);
                    String[] parts = gavString.split(":");

                    DependencyNode node = new DependencyNode();
                    node.setGroupId(parts[0]);
                    node.setArtifactId(parts[1]);

                    if (parts.length == 4) {
                        node.setType(parts[2]);
                        node.setVersion(parts[3]);
                    } else if (parts.length == 5) {
                        node.setType(parts[2]);
                        node.setVersion(parts[3]);
                        node.setScope(parts[4]);
                    } else if (parts.length == 6) {
                        node.setType(parts[2]);
                        node.setClassifier(parts[3]);
                        node.setVersion(parts[4]);
                        node.setScope(parts[5]);
                    }

                    node.setOptional(line.contains("(optional)"));
                    node.setDepth(depth);
                    node.setRawLine(rawLine);
                    node.setLineNumber(lineNum);

                    while (stack.size() > depth) {
                        stack.pop();
                    }

                    if (stack.isEmpty()) {
                        result.setRootNode(node);
                        result.setProjectName(node.getArtifactId());
                    } else {
                        DependencyNode parent = stack.peek();
                        parent.addChild(node);
                    }

                    stack.push(node);
                    totalDeps++;

                    String key = node.getGroupId() + ":" + node.getArtifactId();
                    result.addArtifactOccurrence(key, node);

                } else if (line.contains(":") && line.matches(".*[\\w.-]+:[\\w.-]+.*")) {
                    result.addBadLine(new BadLine(lineNum, rawLine, "Unrecognized dependency format"));
                }

            } catch (Exception e) {
                result.addBadLine(new BadLine(lineNum, rawLine, "Parse error: " + e.getMessage()));
            }
        }

        result.setTotalDependencies(totalDeps);
        result.setUniqueArtifacts(result.getArtifactMap().size());

        return result;
    }

    private int calculateDepth(String rawLine) {
        int depth = 0;
        for (int i = 0; i < rawLine.length(); i++) {
            char c = rawLine.charAt(i);
            if (c == '|' || c == '+' || c == '\\') {
                depth++;
            }
        }
        return depth / 2;
    }
}
