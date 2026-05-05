package com.performancereview;

import com.performancereview.parser.IncidentJsonParser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PerformanceReviewPlatformApplicationTests {

    @Autowired
    private IncidentJsonParser incidentJsonParser;

    @Test
    void contextLoads() {
        assertNotNull(incidentJsonParser);
    }

    @Test
    void testFileParserCapabilities() {
        assertTrue(incidentJsonParser.canParse("incident.json"));
        assertTrue(incidentJsonParser.canParse("INCIDENT.JSON"));
        assertTrue(incidentJsonParser.canParse("test_incident.json"));
        assertFalse(incidentJsonParser.canParse("gc.log"));
    }
}
