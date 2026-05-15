package com.portinspector;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.portinspector.model.PortInspectionRule;
import com.portinspector.model.RiskLevel;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

public class RuleManager {
    private final Path rulesDir;
    private final ObjectMapper objectMapper;

    public RuleManager(String dataDir) {
        this.rulesDir = Paths.get(dataDir, "rules");
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        initDefaultRules();
    }

    private void initDefaultRules() {
        try {
            Files.createDirectories(rulesDir);

            Path rule1 = rulesDir.resolve("rules_v1.0.0.json");
            if (!Files.exists(rule1)) {
                PortInspectionRule v1 = new PortInspectionRule();
                v1.setVersion("v1.0.0");
                Map<String, RiskLevel> ranges1 = new LinkedHashMap<>();
                ranges1.put("0-1023", RiskLevel.CRITICAL);
                ranges1.put("1024-49151", RiskLevel.MEDIUM);
                ranges1.put("49152-65535", RiskLevel.LOW);
                v1.setPortRanges(ranges1);
                v1.setReservedPorts(Arrays.asList(22, 80, 443, 3306, 5432, 6379, 27017));
                v1.setThresholdConnections(100);
                v1.setDescription("初始版本规则：系统端口CRITICAL，注册端口MEDIUM，动态端口LOW");
                objectMapper.writeValue(rule1.toFile(), v1);
            }

            Path rule2 = rulesDir.resolve("rules_v2.0.0.json");
            if (!Files.exists(rule2)) {
                PortInspectionRule v2 = new PortInspectionRule();
                v2.setVersion("v2.0.0");
                Map<String, RiskLevel> ranges2 = new LinkedHashMap<>();
                ranges2.put("0-1023", RiskLevel.HIGH);
                ranges2.put("1024-49151", RiskLevel.LOW);
                ranges2.put("49152-65535", RiskLevel.SAFE);
                v2.setPortRanges(ranges2);
                v2.setReservedPorts(Arrays.asList(22, 80, 443, 3306, 5432, 6379, 27017, 8080, 8443));
                v2.setThresholdConnections(50);
                v2.setDescription("v2.0版本：降低系统端口等级为HIGH，注册端口为LOW，新增常用端口");
                objectMapper.writeValue(rule2.toFile(), v2);
            }
        } catch (IOException e) {
            throw new RuntimeException("初始化规则文件失败", e);
        }
    }

    public PortInspectionRule getRule(String version) {
        try {
            Path ruleFile = rulesDir.resolve("rules_" + version + ".json");
            return objectMapper.readValue(ruleFile.toFile(), PortInspectionRule.class);
        } catch (IOException e) {
            throw new RuntimeException("规则版本不存在: " + version, e);
        }
    }

    public PortInspectionRule getLatestRule() {
        try {
            List<Path> ruleFiles = Files.list(rulesDir)
                    .filter(p -> p.getFileName().toString().startsWith("rules_"))
                    .sorted()
                    .collect(Collectors.toList());
            if (ruleFiles.isEmpty()) {
                throw new RuntimeException("没有找到任何规则文件");
            }
            return objectMapper.readValue(ruleFiles.get(ruleFiles.size() - 1).toFile(), PortInspectionRule.class);
        } catch (IOException e) {
            throw new RuntimeException("获取最新规则失败", e);
        }
    }

    public List<String> listRuleVersions() {
        try {
            return Files.list(rulesDir)
                    .filter(p -> p.getFileName().toString().startsWith("rules_"))
                    .map(p -> p.getFileName().toString().replace("rules_", "").replace(".json", ""))
                    .sorted()
                    .collect(Collectors.toList());
        } catch (IOException e) {
            return Collections.emptyList();
        }
    }

    public RiskLevel getPortRiskLevel(int port, String ruleVersion) {
        PortInspectionRule rule = getRule(ruleVersion);
        if (rule.getReservedPorts().contains(port)) {
            return RiskLevel.CRITICAL;
        }
        for (Map.Entry<String, RiskLevel> entry : rule.getPortRanges().entrySet()) {
            String[] parts = entry.getKey().split("-");
            int start = Integer.parseInt(parts[0]);
            int end = Integer.parseInt(parts[1]);
            if (port >= start && port <= end) {
                return entry.getValue();
            }
        }
        return RiskLevel.LOW;
    }

    public boolean isHighConnections(int connectionCount, String ruleVersion) {
        return connectionCount >= getRule(ruleVersion).getThresholdConnections();
    }
}
