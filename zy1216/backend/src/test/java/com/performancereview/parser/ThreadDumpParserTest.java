package com.performancereview.parser;

import com.performancereview.entity.LockWaitChain;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ThreadDumpParserTest {

    private final ThreadDumpParser parser = new ThreadDumpParser();

    @Test
    void testCanParse() {
        assertTrue(parser.canParse("thread-dump.txt"));
        assertTrue(parser.canParse("threaddump.log"));
        assertTrue(parser.canParse("jstack.txt"));
        assertTrue(parser.canParse("THREAD-DUMP.TXT"));
        assertFalse(parser.canParse("gc.log"));
        assertFalse(parser.canParse("incident.json"));
    }

    @Test
    void testParseThreadState() {
        String threadDump = """
                2024-01-15 14:32:05
                Full thread dump Java HotSpot(TM) 64-Bit Server VM (17.0.5+8-LTS-237 mixed mode, sharing):
                
                "http-nio-8080-exec-1" #25 daemon prio=5 os_prio=31 cpu=5678.90ms elapsed=1234.56s tid=0x00007fb3a8008200 nid=0x6703 waiting on condition  [0x0000700009a95000]
                   java.lang.Thread.State: RUNNABLE
                	at com.example.order.service.OrderService.processOrder(OrderService.java:125)
                	...
                
                "http-nio-8080-exec-2" #26 daemon prio=5 os_prio=31 cpu=1234.56ms elapsed=2345.67s tid=0x00007fb3a8009800 nid=0x6903 waiting for monitor entry  [0x0000700009b98000]
                   java.lang.Thread.State: BLOCKED (on object monitor)
                	at com.example.payment.service.PaymentService.charge(PaymentService.java:89)
                	- waiting to lock <0x000000070b456789> (a java.lang.Object)
                	...
                """;

        List<LockWaitChain> chains = parser.parseLockWaits(threadDump.getBytes(StandardCharsets.UTF_8));

        assertFalse(chains.isEmpty());
        
        LockWaitChain blockedThread = chains.stream()
                .filter(c -> "http-nio-8080-exec-2".equals(c.getWaitingThreads().get(0)))
                .findFirst()
                .orElse(null);
        
        assertNotNull(blockedThread);
        assertEquals("BLOCKED", blockedThread.getLockType());
        assertEquals("0x000000070b456789", blockedThread.getLockName());
    }

    @Test
    void testParseDeadlock() {
        String threadDump = """
                Found one Java-level deadlock:
                =============================
                "http-nio-8080-exec-10":
                  waiting to lock monitor 0x00007fb3a0012340 (object 0x000000070d012345, a java.lang.Object),
                  which is held by "http-nio-8080-exec-11"
                "http-nio-8080-exec-11":
                  waiting to lock monitor 0x00007fb3a0012348 (object 0x000000070d012346, a java.lang.Object),
                  which is held by "http-nio-8080-exec-10"
                
                Found 1 deadlock.
                """;

        List<LockWaitChain> chains = parser.parseLockWaits(threadDump.getBytes(StandardCharsets.UTF_8));

        assertTrue(chains.stream().anyMatch(LockWaitChain::getDeadlockDetected));
        
        LockWaitChain deadlock = chains.stream()
                .filter(LockWaitChain::getDeadlockDetected)
                .findFirst()
                .orElse(null);
        
        assertNotNull(deadlock);
        assertTrue(deadlock.getDeadlockDetected());
    }

    @Test
    void testGetSupportedFileType() {
        assertEquals("THREAD_DUMP", parser.getSupportedFileType());
    }
}
