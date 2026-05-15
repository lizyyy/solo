package com.edge.config.ack.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.edge.config.ack.entity.ConfigVersion;
import com.edge.config.ack.entity.EdgeNode;
import com.edge.config.ack.mapper.ConfigVersionMapper;
import com.edge.config.ack.mapper.EdgeNodeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitRunner implements ApplicationRunner {

    private final EdgeNodeMapper nodeMapper;
    private final ConfigVersionMapper versionMapper;

    @Override
    public void run(ApplicationArguments args) {
        log.info("init test data...");

        for (int i = 1; i <= 5; i++) {
            EdgeNode node = nodeMapper.selectOne(
                    new LambdaQueryWrapper<EdgeNode>().eq(EdgeNode::getNodeCode, "NODE" + i)
            );
            if (node == null) {
                node = new EdgeNode();
                node.setNodeCode("NODE" + i);
                node.setNodeName("边缘节点" + i);
                node.setNodeIp("192.168.1." + (100 + i));
                node.setRegion("region-" + (i % 3 + 1));
                node.setStatus(1);
                nodeMapper.insert(node);
            }
        }

        ConfigVersion version = versionMapper.selectOne(
                new LambdaQueryWrapper<ConfigVersion>().eq(ConfigVersion::getVersionNo, "V20240101001")
        );
        if (version == null) {
            version = new ConfigVersion();
            version.setVersionNo("V20240101001");
            version.setConfigType("network");
            version.setConfigContent("{\"timeout\":30,\"retry\":3}");
            version.setPublishTime(LocalDateTime.now());
            version.setPublisher("system");
            version.setStatus(1);
            versionMapper.insert(version);
        }

        log.info("init test data completed!");
    }
}
