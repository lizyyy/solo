package com.performancereview.parser;

import com.performancereview.entity.GcPause;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GcLogParserTest {

    private final GcLogParser parser = new GcLogParser();

    @Test
    void testCanParse() {
        assertTrue(parser.canParse("gc.log"));
        assertTrue(parser.canParse("gc.log.1"));
        assertTrue(parser.canParse("GC.LOG"));
        assertTrue(parser.canParse("app-gc.log"));
        assertFalse(parser.canParse("incident.json"));
        assertFalse(parser.canParse("thread-dump.txt"));
    }

    @Test
    void testParseYoungGc() {
        String logLine = """
                2024-01-15T14:30:05.123+0800: [GC pause (G1 Evacuation Pause) (young), 0.234 secs]
                   [Eden: 1024.0M(1024.0M)->0.0B(1024.0M) Survivors: 128.0M->128.0M Heap: 2048.0M(4096.0M)->1024.0M(4096.0M)]
                 [Times: user=1.60 sys=0.05, real=0.23 secs]
                """;

        List<GcPause> pauses = parser.parseGcPauses(logLine.getBytes(StandardCharsets.UTF_8));

        assertFalse(pauses.isEmpty());
        GcPause pause = pauses.get(0);
        assertEquals("G1 Evacuation Pause (young)", pause.getGcType());
        assertEquals(234, pause.getPauseTimeMs());
        assertEquals(2048, pause.getHeapBeforeMb());
        assertEquals(1024, pause.getHeapAfterMb());
        assertEquals(-1024, pause.getHeapDeltaMb());
    }

    @Test
    void testParseMixedGc() {
        String logLine = """
                2024-01-15T14:32:05.789+0800: [GC pause (G1 Evacuation Pause) (mixed), 1.234 secs]
                   [Eden: 1024.0M(1024.0M)->0.0B(1024.0M) Survivors: 128.0M->128.0M Heap: 3800.0M(4096.0M)->2048.0M(4096.0M)]
                 [Times: user=9.50 sys=0.10, real=1.23 secs]
                """;

        List<GcPause> pauses = parser.parseGcPauses(logLine.getBytes(StandardCharsets.UTF_8));

        assertFalse(pauses.isEmpty());
        GcPause pause = pauses.get(0);
        assertEquals("G1 Evacuation Pause (mixed)", pause.getGcType());
        assertEquals(1234, pause.getPauseTimeMs());
    }

    @Test
    void testParseHumongousGc() {
        String logLine = """
                2024-01-15T14:33:20.123+0800: [GC pause (G1 Humongous Allocation), 2.567 secs]
                   [Eden: 1024.0M(1024.0M)->0.0B(1024.0M) Survivors: 128.0M->128.0M Heap: 4096.0M(4096.0M)->1536.0M(4096.0M)]
                 [Times: user=18.50 sys=0.20, real=2.57 secs]
                """;

        List<GcPause> pauses = parser.parseGcPauses(logLine.getBytes(StandardCharsets.UTF_8));

        assertFalse(pauses.isEmpty());
        GcPause pause = pauses.get(0);
        assertEquals("G1 Humongous Allocation", pause.getGcType());
        assertEquals(2567, pause.getPauseTimeMs());
        assertTrue(pause.getHumongousAllocation());
    }

    @Test
    void testGetSupportedFileType() {
        assertEquals("GC_LOG", parser.getSupportedFileType());
    }
}
