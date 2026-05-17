package com.maven.dependency.parser;

import com.maven.dependency.model.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;

public class DependencyTreeParser {
    private static final Pattern DEP_PATTERN = Pattern.compile(
        "^([\\\\| +-]*)([\\w.-]+):([\\w.-]+):([\\w.-]+)(?::([\\w.-]+))?(?::([\\w.-]+))?(?: *(\\(optional\\)))?$"
    );

    private static final Pattern TREE_PREFIX = Pattern.compile("^([\\\\| +-]+)");

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
                line.contains("Total time") || line.contains("Finished at")) {
                continue;
            }

            try {
                Matcher prefixMatcher = TREE_PREFIX.matcher(rawLine);
                int depth = 0;
                if (prefixMatcher.find()) {
                    depth = calculateDepth(prefixMatcher.group(1));
                }

                Matcher depMatcher = DEP_PATTERN.matcher(line);
                if (depMatcher.find()) {
                    DependencyNode node = new DependencyNode();
                    node.setGroupId(depMatcher.group(2));
                    node.setArtifactId(depMatcher.group(3));
                    node.setVersion(depMatcher.group(4));
                    node.setScope(depMatcher.group(5));
                    node.setClassifier(depMatcher.group(6));
                    node.setOptional(depMatcher.group(7) != null);
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

    private int calculateDepth(String prefix) {
        int depth = 0;
        for (char c : prefix.toCharArray()) {
            if (c == '|' || c == '+' || c == '\\') {
                depth++;
            }
        }
        return depth / 2;
    }
}
