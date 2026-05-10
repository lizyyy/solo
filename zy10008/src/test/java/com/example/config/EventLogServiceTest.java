package com.example.config;

import com.example.config.domain.ConfigEventLog;
import com.example.config.repository.ConfigEventLogRepository;
import com.example.config.service.EventLogService;
import com.example.config.util.CollectionUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class EventLogServiceTest {

    @Autowired
    private EventLogService eventLogService;

    @Autowired
    private ConfigEventLogRepository eventLogRepository;

    @BeforeEach
    void setUp() {
        eventLogRepository.deleteAll();
        EventLogService.clearTraceId();
    }

    @Test
    @DisplayName("日志记录 - 基本功能")
    void testLogEvent_Basic() {
        String traceId = EventLogService.getCurrentTraceId();
        assertNotNull(traceId);

        Map<String, Object> details = new java.util.HashMap<>();
        details.put("key", "value");
        eventLogService.logEvent(
                ConfigEventLog.EventType.CONFIG_CREATE,
                ConfigEventLog.EventLevel.INFO,
                "test-ns:test-key",
                "ConfigItem",
                "测试消息",
                details,
                null
        );

        List<ConfigEventLog> logs = eventLogRepository.findAll();
        assertEquals(1, logs.size());

        ConfigEventLog log = logs.get(0);
        assertEquals(traceId, log.getTraceId());
        assertEquals(ConfigEventLog.EventType.CONFIG_CREATE, log.getEventType());
        assertEquals(ConfigEventLog.EventLevel.INFO, log.getLevel());
        assertEquals("test-ns:test-key", log.getEntityId());
        assertEquals("ConfigItem", log.getEntityType());
        assertEquals("测试消息", log.getMessage());
    }

    @Test
    @DisplayName("日志记录 - 异常堆栈")
    void testLogEvent_WithException() {
        RuntimeException ex = new RuntimeException("测试异常");

        eventLogService.logEvent(
                ConfigEventLog.EventType.SYSTEM_ERROR,
                ConfigEventLog.EventLevel.ERROR,
                null,
                "System",
                "系统错误",
                null,
                ex
        );

        List<ConfigEventLog> logs = eventLogRepository.findAll();
        assertEquals(1, logs.size());

        ConfigEventLog log = logs.get(0);
        assertNotNull(log.getStackTrace());
        assertTrue(log.getStackTrace().contains("RuntimeException"));
        assertTrue(log.getStackTrace().contains("测试异常"));
    }

    @Test
    @DisplayName("按TraceId查询日志")
    void testGetEventsByTraceId() {
        String traceId1 = "trace-001";
        String traceId2 = "trace-002";

        EventLogService.setCurrentTraceId(traceId1);
        eventLogService.logConfigCreate("ns1", "key1", "user1");
        eventLogService.logConfigPublish("release-1", "ns1", "key1", "user1");

        EventLogService.setCurrentTraceId(traceId2);
        eventLogService.logConfigCreate("ns2", "key2", "user2");

        List<ConfigEventLog> trace1Logs = eventLogService.getEventsByTraceId(traceId1);
        List<ConfigEventLog> trace2Logs = eventLogService.getEventsByTraceId(traceId2);

        assertEquals(2, trace1Logs.size());
        assertEquals(1, trace2Logs.size());
    }

    @Test
    @DisplayName("TraceId隔离 - 不同请求不相互干扰")
    void testTraceIdIsolation() {
        EventLogService.setCurrentTraceId("trace-A");
        String traceA = EventLogService.getCurrentTraceId();

        EventLogService.clearTraceId();
        EventLogService.setCurrentTraceId("trace-B");
        String traceB = EventLogService.getCurrentTraceId();

        assertEquals("trace-A", traceA);
        assertEquals("trace-B", traceB);
        assertNotEquals(traceA, traceB);
    }

    @Test
    @DisplayName("便捷日志方法 - 配置创建")
    void testLogConfigCreate() {
        eventLogService.logConfigCreate("ns", "key", "operator");

        List<ConfigEventLog> logs = eventLogRepository.findAll();
        assertEquals(1, logs.size());
        assertEquals(ConfigEventLog.EventType.CONFIG_CREATE, logs.get(0).getEventType());
        assertTrue(logs.get(0).getMessage().contains("ns"));
        assertTrue(logs.get(0).getMessage().contains("key"));
    }

    @Test
    @DisplayName("便捷日志方法 - 配置更新")
    void testLogConfigUpdate() {
        eventLogService.logConfigUpdate("ns", "key", 1L, 2L, "operator");

        List<ConfigEventLog> logs = eventLogRepository.findAll();
        assertEquals(1, logs.size());
        assertEquals(ConfigEventLog.EventType.CONFIG_UPDATE, logs.get(0).getEventType());
        assertTrue(logs.get(0).getMessage().contains("v1"));
        assertTrue(logs.get(0).getMessage().contains("v2"));
    }

    @Test
    @DisplayName("便捷日志方法 - 推送成功")
    void testLogPushSuccess() {
        eventLogService.logPushSuccess("release-1", "instance-1", 150);

        List<ConfigEventLog> logs = eventLogRepository.findAll();
        assertEquals(1, logs.size());
        assertEquals(ConfigEventLog.EventType.PUSH_SUCCESS, logs.get(0).getEventType());
        assertTrue(logs.get(0).getMessage().contains("150ms"));
    }

    @Test
    @DisplayName("便捷日志方法 - 推送失败")
    void testLogPushFailed() {
        RuntimeException ex = new RuntimeException("网络错误");
        eventLogService.logPushFailed("release-1", "instance-1", "连接超时", ex);

        List<ConfigEventLog> logs = eventLogRepository.findAll();
        assertEquals(1, logs.size());
        assertEquals(ConfigEventLog.EventType.PUSH_FAILED, logs.get(0).getEventType());
        assertNotNull(logs.get(0).getStackTrace());
    }

    @Test
    @DisplayName("查询最近错误")
    void testGetRecentErrors() {
        eventLogService.logSystemError("错误1", new RuntimeException("err1"));
        eventLogService.logSystemError("错误2", new RuntimeException("err2"));
        eventLogService.logConfigCreate("ns", "key", "user");

        List<ConfigEventLog> errors = eventLogService.getRecentErrors(5);
        assertEquals(2, errors.size());
        for (ConfigEventLog error : errors) {
            assertTrue(
                    error.getLevel() == ConfigEventLog.EventLevel.ERROR ||
                    error.getLevel() == ConfigEventLog.EventLevel.FATAL
            );
        }
    }
}
