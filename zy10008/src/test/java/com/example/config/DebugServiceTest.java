package com.example.config;

import com.example.config.domain.ConfigRelease;
import com.example.config.repository.*;
import com.example.config.service.ConfigService;
import com.example.config.service.DebugService;
import com.example.config.service.EventLogService;
import com.example.config.service.PushService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
class DebugServiceTest {

    @Autowired
    private DebugService debugService;

    @Autowired
    private ConfigService configService;

    @Autowired
    private EventLogService eventLogService;

    @Autowired
    private ConfigItemRepository configItemRepository;

    @Autowired
    private ConfigReleaseRepository configReleaseRepository;

    @Autowired
    private ConfigEventLogRepository eventLogRepository;

    @Autowired
    private ClientPushStatusRepository pushStatusRepository;

    @Autowired
    private ClientRegistryRepository clientRegistryRepository;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private PushService pushService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        eventLogRepository.deleteAll();
        pushStatusRepository.deleteAll();
        configReleaseRepository.deleteAll();
        configItemRepository.deleteAll();
        clientRegistryRepository.deleteAll();
        EventLogService.clearTraceId();

        when(redisTemplate.hasKey(anyString())).thenReturn(false);
    }

    @Test
    @DisplayName("Markdown报告生成 - 基本格式")
    void testGenerateMarkdownReport_BasicFormat() {
        configService.createConfig("report-ns", "report.key", "value1", "报告测试", "user");
        ConfigRelease release = configService.publishConfig("report-ns", "report.key", "publisher");

        String report = debugService.generateMarkdownReport(release.getReleaseId());

        assertNotNull(report);
        assertTrue(report.startsWith("# 配置发布报告"));
        assertTrue(report.contains(release.getReleaseId()));
        assertTrue(report.contains("report-ns"));
        assertTrue(report.contains("report.key"));
        assertTrue(report.contains("## 基本信息"));
        assertTrue(report.contains("## 推送统计"));
        assertTrue(report.contains("## 时间线"));
    }

    @Test
    @DisplayName("Markdown报告 - 表格格式验证")
    void testGenerateMarkdownReport_TableFormat() {
        configService.createConfig("table-ns", "table.key", "value", "测试", "user");
        ConfigRelease release = configService.publishConfig("table-ns", "table.key", "publisher");

        String report = debugService.generateMarkdownReport(release.getReleaseId());

        assertTrue(report.contains("| 项目 | 内容 |"));
        assertTrue(report.contains("|------|------|"));
        assertTrue(report.contains("| 状态 | 数量 | 占比 |"));
    }

    @Test
    @DisplayName("事件回放 - 返回正确的事件列表")
    void testReplayEvent_WithEvents() {
        String traceId = "test-trace-12345";
        EventLogService.setCurrentTraceId(traceId);

        eventLogService.logConfigCreate("replay-ns", "replay.key", "user1");
        eventLogService.logConfigUpdate("replay-ns", "replay.key", 1L, 2L, "user2");

        Map<String, Object> replay = debugService.replayEvent(traceId);

        assertTrue((Boolean) replay.get("found"));
        assertEquals(traceId, replay.get("traceId"));
        assertEquals(2, replay.get("eventCount"));
    }

    @Test
    @DisplayName("事件回放 - 不存在的TraceId")
    void testReplayEvent_NotFound() {
        Map<String, Object> replay = debugService.replayEvent("non-exist-trace");

        assertFalse((Boolean) replay.get("found"));
        assertEquals("non-exist-trace", replay.get("traceId"));
    }

    @Test
    @DisplayName("发布时间线 - 基本信息完整")
    void testGetReleaseTimeline_BasicInfo() {
        configService.createConfig("timeline-ns", "timeline.key", "value", "测试", "user");
        ConfigRelease release = configService.publishConfig("timeline-ns", "timeline.key", "publisher");

        Map<String, Object> timeline = debugService.getReleaseTimeline(release.getReleaseId());

        assertEquals(release.getReleaseId(), timeline.get("releaseId"));
        assertEquals("timeline-ns", timeline.get("namespace"));
        assertEquals("timeline.key", timeline.get("configKey"));
        assertEquals(ConfigRelease.ReleaseStatus.PENDING, timeline.get("status"));
        assertNotNull(timeline.get("pushSummary"));
        assertNotNull(timeline.get("timeline"));
    }

    @Test
    @DisplayName("发布时间线 - 不存在的ReleaseId")
    void testGetReleaseTimeline_NotFound() {
        Map<String, Object> timeline = debugService.getReleaseTimeline("non-exist-release");

        assertFalse((Boolean) timeline.get("found"));
    }

    @Test
    @DisplayName("最近错误统计 - 按类型聚合")
    void testGetRecentErrors_ByType() {
        eventLogService.logSystemError("错误1", new RuntimeException("err1"));
        eventLogService.logSystemError("错误2", new RuntimeException("err2"));

        Map<String, Object> errors = debugService.getRecentErrors(5);

        assertTrue((Integer) errors.get("totalErrors") >= 2);
        assertNotNull(errors.get("errorByType"));
    }
}
