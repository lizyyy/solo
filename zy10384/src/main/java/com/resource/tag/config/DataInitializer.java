package com.resource.tag.config;

import com.resource.tag.model.*;
import com.resource.tag.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final ResourceNodeRepository nodeRepository;
    private final OverrideRuleRepository ruleRepository;

    @Override
    public void run(String... args) {
        log.info("Initializing sample data...");
        initResourceNodes();
        initOverrideRules();
        log.info("Sample data initialization completed.");
    }

    private void initResourceNodes() {
        if (nodeRepository.count() > 0) return;

        ResourceNode org = createNode("ORG_001", "Root Organization", null, "ORGANIZATION");
        ResourceNode dept = createNode("DEPT_001", "Engineering Department", "ORG_001", "DEPARTMENT");
        ResourceNode team = createNode("TEAM_001", "Backend Team", "DEPT_001", "TEAM");
        ResourceNode project = createNode("PROJ_001", "Tag Inheritance Project", "TEAM_001", "PROJECT");

        addTag(org, "environment", "production", 100);
        addTag(org, "security_level", "high", 100);
        addTag(org, "cost_center", "CC-100", 100);

        addTag(dept, "security_level", "critical", 200);
        addTag(dept, "backup_enabled", "true", 200);

        addTag(team, "environment", "staging", 300);
        addTag(team, "monitoring", "enabled", 300);

        addTag(project, "backup_enabled", "false", 500);

        nodeRepository.saveAll(Arrays.asList(org, dept, team, project));
    }

    private void initOverrideRules() {
        if (ruleRepository.count() > 0) return;

        OverrideRule rule1 = new OverrideRule();
        rule1.setRuleId("RULE_001");
        rule1.setTagKey("environment");
        rule1.setTargetNodeId("PROJ_001");
        rule1.setOverrideValue("production");
        rule1.setPriority(1000);
        rule1.setDescription("Force production environment for this project");
        rule1.setEnabled(true);

        OverrideRule rule2 = new OverrideRule();
        rule2.setRuleId("RULE_002");
        rule2.setTagKey("security_level");
        rule2.setTargetNodeId("PROJ_001");
        rule2.setOverrideValue("top_secret");
        rule2.setPriority(1000);
        rule2.setDescription("Highest security level");
        rule2.setEnabled(true);

        ruleRepository.saveAll(Arrays.asList(rule1, rule2));
    }

    private ResourceNode createNode(String nodeId, String name, String parentId, String type) {
        ResourceNode node = new ResourceNode();
        node.setNodeId(nodeId);
        node.setName(name);
        node.setParentNodeId(parentId);
        node.setResourceType(type);
        return node;
    }

    private void addTag(ResourceNode node, String key, String value, int priority) {
        Tag tag = new Tag();
        tag.setKey(key);
        tag.setValue(value);
        tag.setPriority(priority);
        tag.setResourceNode(node);
        node.getTags().add(tag);
    }
}
