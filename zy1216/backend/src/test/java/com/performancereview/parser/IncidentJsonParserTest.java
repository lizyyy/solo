package com.performancereview.parser;

import com.performancereview.entity.Incident;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class IncidentJsonParserTest {

    private final IncidentJsonParser parser = new IncidentJsonParser();

    @Test
    void testCanParse() {
        assertTrue(parser.canParse("incident.json"));
        assertTrue(parser.canParse("my_incident.json"));
        assertTrue(parser.canParse("INCIDENT.JSON"));
        assertFalse(parser.canParse("gc.log"));
        assertFalse(parser.canParse("thread-dump.txt"));
    }

    @Test
    void testParseValidJson() {
        String jsonContent = """
                {
                    "title": "测试事故",
                    "description": "这是一个测试描述",
                    "incidentTime": "2024-01-15T14:30:00",
                    "severity": "CRITICAL",
                    "environment": "PRODUCTION"
                }
                """;

        Incident incident = parser.parseToIncident(jsonContent.getBytes(StandardCharsets.UTF_8));

        assertNotNull(incident);
        assertEquals("测试事故", incident.getTitle());
        assertEquals("这是一个测试描述", incident.getDescription());
        assertNotNull(incident.getIncidentTime());
        assertEquals("CRITICAL", incident.getSeverity());
        assertEquals("PRODUCTION", incident.getEnvironment());
    }

    @Test
    void testParsePartialJson() {
        String jsonContent = """
                {
                    "title": "只有标题的事故"
                }
                """;

        Incident incident = parser.parseToIncident(jsonContent.getBytes(StandardCharsets.UTF_8));

        assertNotNull(incident);
        assertEquals("只有标题的事故", incident.getTitle());
        assertNull(incident.getDescription());
        assertNull(incident.getSeverity());
    }

    @Test
    void testParseInvalidJson() {
        String invalidJson = "{ title: 坏格式 }";

        assertThrows(Exception.class, () -> {
            parser.parseToIncident(invalidJson.getBytes(StandardCharsets.UTF_8));
        });
    }

    @Test
    void testGetSupportedFileType() {
        assertEquals("INCIDENT_JSON", parser.getSupportedFileType());
    }
}
