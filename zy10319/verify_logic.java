import java.time.LocalDateTime;
import java.util.*;

enum EventStatus {
    PENDING, WAITING, PROCESSING, SUCCESS, FAILED, TIMEOUT, SKIPPED
}

enum OutOfOrderReason {
    GAP, DUPLICATE, RETROACTIVE, TIMEOUT, NONE
}

class EventContext {
    String eventId;
    String topic;
    String businessKey;
    Long sequenceNumber;
    EventStatus status;
    OutOfOrderReason outOfOrderReason;
    String processResult;
    String errorMessage;
    LocalDateTime receivedAt;
    LocalDateTime processedAt;
    LocalDateTime waitingSince;
    Long expectedNextSequence;
}

class SequenceState {
    String topic;
    String businessKey;
    Long currentSequence;
    Long expectedNextSequence;
    Long lastProcessedSequence;
    TreeMap<Long, EventContext> waitingQueue = new TreeMap<>();
    LocalDateTime lastGapDetectedAt;
    boolean hasGap;
    Long gapStartSequence;
    
    public void init() {
        this.currentSequence = 0L;
        this.expectedNextSequence = 1L;
    }
}

public class verify_logic {
    
    static int gapTimeoutSeconds = 30;
    
    public static void main(String[] args) {
        System.out.println("=== Webhook 顺序保证 - 超时逻辑验证 ===");
        System.out.println();
        
        testScenario1_2_4();
        testScenario1_3_4_5();
        testScenarioNormalProcess();
        
        System.out.println();
        System.out.println("=== 所有测试场景验证完成 ===");
    }
    
    static void testScenario1_2_4() {
        System.out.println("【场景1】顺序 1->2->4，跳过3，验证超时处理");
        System.out.println("------------------------------------------------");
        
        SequenceState state = new SequenceState();
        state.init();
        state.topic = "order";
        state.businessKey = "order-123";
        
        processInOrder(state, 1L);
        processInOrder(state, 2L);
        processOutOfOrder(state, 4L);
        
        System.out.println("  提交事件4后状态:");
        System.out.println("    - 期望下一个序列号: " + state.expectedNextSequence);
        System.out.println("    - 是否有缺口: " + state.hasGap);
        System.out.println("    - 缺口起始序列号: " + state.gapStartSequence);
        System.out.println("    - 等待队列: " + state.waitingQueue.keySet());
        
        processTimeout(state);
        
        System.out.println("  超时处理后状态:");
        System.out.println("    - 最后处理序列号: " + state.lastProcessedSequence);
        System.out.println("    - 期望下一个序列号: " + state.expectedNextSequence);
        System.out.println("    - 等待队列是否为空: " + state.waitingQueue.isEmpty());
        System.out.println("    - 是否还有缺口: " + state.hasGap);
        
        boolean testPassed = (state.lastProcessedSequence == 4L && 
                               state.expectedNextSequence == 5L && 
                               state.waitingQueue.isEmpty());
        System.out.println("  测试结果: " + (testPassed ? "✅ 通过" : "❌ 失败"));
        System.out.println();
    }
    
    static void testScenario1_3_4_5() {
        System.out.println("【场景2】顺序 1->3->4->5，跳过2，验证超时批量处理");
        System.out.println("------------------------------------------------");
        
        SequenceState state = new SequenceState();
        state.init();
        state.topic = "order";
        state.businessKey = "order-456";
        
        processInOrder(state, 1L);
        processOutOfOrder(state, 3L);
        processOutOfOrder(state, 4L);
        processOutOfOrder(state, 5L);
        
        System.out.println("  提交事件后状态:");
        System.out.println("    - 期望下一个序列号: " + state.expectedNextSequence);
        System.out.println("    - 缺口起始序列号: " + state.gapStartSequence);
        System.out.println("    - 等待队列: " + state.waitingQueue.keySet());
        
        processTimeout(state);
        
        System.out.println("  超时处理后状态:");
        System.out.println("    - 最后处理序列号: " + state.lastProcessedSequence);
        System.out.println("    - 期望下一个序列号: " + state.expectedNextSequence);
        System.out.println("    - 等待队列是否为空: " + state.waitingQueue.isEmpty());
        
        boolean testPassed = (state.lastProcessedSequence == 5L && 
                               state.expectedNextSequence == 6L && 
                               state.waitingQueue.isEmpty());
        System.out.println("  测试结果: " + (testPassed ? "✅ 通过" : "❌ 失败"));
        System.out.println();
    }
    
    static void testScenarioNormalProcess() {
        System.out.println("【场景3】验证正常补充缺口后自动推进");
        System.out.println("------------------------------------------------");
        
        SequenceState state = new SequenceState();
        state.init();
        state.topic = "order";
        state.businessKey = "order-789";
        
        processInOrder(state, 1L);
        processInOrder(state, 2L);
        processOutOfOrder(state, 4L);
        
        System.out.println("  提交事件4后状态:");
        System.out.println("    - 期望下一个序列号: " + state.expectedNextSequence);
        System.out.println("    - 等待队列: " + state.waitingQueue.keySet());
        
        processInOrder(state, 3L);
        
        System.out.println("  补充缺口事件3后状态:");
        System.out.println("    - 最后处理序列号: " + state.lastProcessedSequence);
        System.out.println("    - 期望下一个序列号: " + state.expectedNextSequence);
        System.out.println("    - 等待队列是否为空: " + state.waitingQueue.isEmpty());
        
        boolean testPassed = (state.lastProcessedSequence == 4L && 
                               state.expectedNextSequence == 5L && 
                               state.waitingQueue.isEmpty());
        System.out.println("  测试结果: " + (testPassed ? "✅ 通过" : "❌ 失败"));
        System.out.println();
    }
    
    static void processInOrder(SequenceState state, long seq) {
        state.currentSequence = seq;
        state.lastProcessedSequence = seq;
        state.expectedNextSequence = seq + 1;
        
        processWaitingQueue(state);
    }
    
    static void processOutOfOrder(SequenceState state, long seq) {
        EventContext event = new EventContext();
        event.sequenceNumber = seq;
        event.status = EventStatus.WAITING;
        event.outOfOrderReason = OutOfOrderReason.GAP;
        state.waitingQueue.put(seq, event);
        
        if (!state.hasGap) {
            state.hasGap = true;
            state.gapStartSequence = state.expectedNextSequence;
            state.lastGapDetectedAt = LocalDateTime.now();
        }
    }
    
    static void processWaitingQueue(SequenceState state) {
        List<Long> processedSeqs = new ArrayList<>();
        
        for (Map.Entry<Long, EventContext> entry : state.waitingQueue.entrySet()) {
            long seq = entry.getKey();
            if (seq == state.expectedNextSequence) {
                state.currentSequence = seq;
                state.lastProcessedSequence = seq;
                state.expectedNextSequence = seq + 1;
                processedSeqs.add(seq);
            } else {
                break;
            }
        }
        
        processedSeqs.forEach(seq -> state.waitingQueue.remove(seq));
        
        if (state.waitingQueue.isEmpty()) {
            state.hasGap = false;
            state.gapStartSequence = null;
            state.lastGapDetectedAt = null;
        }
    }
    
    static void processTimeout(SequenceState state) {
        System.out.println("  [超时处理] gapStart=" + state.gapStartSequence + 
                          ", 等待队列=" + state.waitingQueue.keySet());
        
        long maxProcessedSeq = state.gapStartSequence - 1;
        
        for (Map.Entry<Long, EventContext> entry : state.waitingQueue.entrySet()) {
            EventContext waitingEvent = entry.getValue();
            
            if (waitingEvent.sequenceNumber >= state.gapStartSequence) {
                waitingEvent.status = EventStatus.SUCCESS;
                waitingEvent.processResult = "超时强制处理";
                waitingEvent.processedAt = LocalDateTime.now();
                waitingEvent.outOfOrderReason = OutOfOrderReason.TIMEOUT;
                waitingEvent.errorMessage = null;
                
                if (waitingEvent.sequenceNumber > maxProcessedSeq) {
                    maxProcessedSeq = waitingEvent.sequenceNumber;
                }
                state.lastProcessedSequence = waitingEvent.sequenceNumber;
                System.out.println("    -> 处理序列号: " + waitingEvent.sequenceNumber);
            }
        }
        
        state.waitingQueue.clear();
        state.hasGap = false;
        state.gapStartSequence = null;
        state.lastGapDetectedAt = null;
        state.expectedNextSequence = maxProcessedSeq + 1;
    }
}
