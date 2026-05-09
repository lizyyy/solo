package com.example.config;

import com.example.config.domain.ConfigItem;
import com.example.config.domain.ConfigRelease;
import com.example.config.repository.ConfigItemRepository;
import com.example.config.repository.ConfigReleaseRepository;
import com.example.config.service.CacheService;
import com.example.config.service.ConfigService;
import com.example.config.service.EventLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
class ConfigServiceTest {

    @Autowired
    private ConfigService configService;

    @Autowired
    private ConfigItemRepository configItemRepository;

    @Autowired
    private ConfigReleaseRepository configReleaseRepository;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private CacheService cacheService;

    @Autowired
    private EventLogService eventLogService;

    @BeforeEach
    void setUp() {
        configItemRepository.deleteAll();
        configReleaseRepository.deleteAll();
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
    }

    @Test
    @DisplayName("创建配置项 - 成功")
    void testCreateConfig_Success() {
        ConfigItem config = configService.createConfig(
                "test-namespace",
                "test.key",
                "test-value",
                "测试配置",
                "test-user"
        );

        assertNotNull(config);
        assertEquals("test-namespace", config.getNamespace());
        assertEquals("test.key", config.getConfigKey());
        assertEquals("test-value", config.getConfigValue());
        assertEquals(1L, config.getVersion());
        assertTrue(config.getEnabled());
        assertEquals("test-user", config.getCreatedBy());
    }

    @Test
    @DisplayName("创建配置项 - 重复创建应失败")
    void testCreateConfig_Duplicate() {
        configService.createConfig(
                "test-namespace",
                "test.key",
                "value1",
                "测试",
                "user1"
        );

        assertThrows(IllegalArgumentException.class, () -> {
            configService.createConfig(
                    "test-namespace",
                    "test.key",
                    "value2",
                    "测试2",
                    "user2"
            );
        });
    }

    @Test
    @DisplayName("更新配置项 - 版本递增")
    void testUpdateConfig_VersionIncrement() {
        ConfigItem created = configService.createConfig(
                "test-namespace",
                "test.key",
                "value-v1",
                "测试",
                "user1"
        );
        assertEquals(1L, created.getVersion());

        ConfigItem updated = configService.updateConfig(
                "test-namespace",
                "test.key",
                "value-v2",
                "更新描述",
                "user2"
        );

        assertEquals(2L, updated.getVersion());
        assertEquals("value-v2", updated.getConfigValue());
        assertEquals("user2", updated.getUpdatedBy());
    }

    @Test
    @DisplayName("更新不存在的配置 - 应失败")
    void testUpdateConfig_NotFound() {
        assertThrows(IllegalArgumentException.class, () -> {
            configService.updateConfig(
                    "non-exist",
                    "non-exist",
                    "value",
                    null,
                    "user"
            );
        });
    }

    @Test
    @DisplayName("查询配置 - 成功")
    void testGetConfig_Success() {
        configService.createConfig(
                "test-ns",
                "my.key",
                "my-value",
                "测试",
                "user"
        );

        Optional<ConfigItem> found = configService.getConfig("test-ns", "my.key");

        assertTrue(found.isPresent());
        assertEquals("my-value", found.get().getConfigValue());
    }

    @Test
    @DisplayName("查询不存在的配置 - 返回空")
    void testGetConfig_NotFound() {
        Optional<ConfigItem> found = configService.getConfig("non-exist", "non-exist");
        assertFalse(found.isPresent());
    }

    @Test
    @DisplayName("发布配置 - 创建发布记录")
    void testPublishConfig_CreateRelease() {
        configService.createConfig(
                "publish-ns",
                "publish.key",
                "value",
                "发布测试",
                "publisher"
        );

        ConfigRelease release = configService.publishConfig(
                "publish-ns",
                "publish.key",
                "publisher"
        );

        assertNotNull(release);
        assertNotNull(release.getReleaseId());
        assertEquals("publish-ns", release.getNamespace());
        assertEquals("publish.key", release.getConfigKey());
        assertEquals(ConfigRelease.ReleaseStatus.PENDING, release.getStatus());
    }

    @Test
    @DisplayName("发布不存在的配置 - 应失败")
    void testPublishConfig_NotFound() {
        assertThrows(IllegalArgumentException.class, () -> {
            configService.publishConfig("non-exist", "non-exist", "user");
        });
    }
}
