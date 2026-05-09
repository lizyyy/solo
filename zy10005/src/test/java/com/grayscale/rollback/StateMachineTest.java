package com.grayscale.rollback;

import com.grayscale.rollback.enums.ReleaseEvent;
import com.grayscale.rollback.enums.ReleaseStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.statemachine.StateMachine;
import org.springframework.statemachine.config.StateMachineFactory;
import org.springframework.statemachine.test.StateMachineTestPlan;
import org.springframework.statemachine.test.StateMachineTestPlanBuilder;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class StateMachineTest {
    
    @Autowired
    private StateMachineFactory<ReleaseStatus, ReleaseEvent> stateMachineFactory;
    
    @Test
    void testNormalFlow() throws Exception {
        String machineId = UUID.randomUUID().toString();
        StateMachine<ReleaseStatus, ReleaseEvent> sm = stateMachineFactory.getStateMachine(machineId);
        
        StateMachineTestPlan<ReleaseStatus, ReleaseEvent> plan =
            StateMachineTestPlanBuilder.<ReleaseStatus, ReleaseEvent>builder()
                .defaultAwaitTime(2)
                .stateMachine(sm)
                .step()
                    .expectStates(ReleaseStatus.PENDING)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.START_PREPARING)
                    .expectStateChanged(1)
                    .expectStates(ReleaseStatus.PREPARING)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_10)
                    .expectStateChanged(1)
                    .expectStates(ReleaseStatus.CANARY_10)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_30)
                    .expectStateChanged(1)
                    .expectStates(ReleaseStatus.CANARY_30)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_50)
                    .expectStateChanged(1)
                    .expectStates(ReleaseStatus.CANARY_50)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_100)
                    .expectStateChanged(1)
                    .expectStates(ReleaseStatus.CANARY_100)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.COMPLETE)
                    .expectStateChanged(1)
                    .expectStates(ReleaseStatus.COMPLETED)
                    .and()
                .build();
        
        plan.test();
    }
    
    @Test
    void testRollbackFromCanary30() throws Exception {
        String machineId = UUID.randomUUID().toString();
        StateMachine<ReleaseStatus, ReleaseEvent> sm = stateMachineFactory.getStateMachine(machineId);
        
        StateMachineTestPlan<ReleaseStatus, ReleaseEvent> plan =
            StateMachineTestPlanBuilder.<ReleaseStatus, ReleaseEvent>builder()
                .defaultAwaitTime(2)
                .stateMachine(sm)
                .step()
                    .sendEvent(ReleaseEvent.START_PREPARING)
                    .expectStates(ReleaseStatus.PREPARING)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_10)
                    .expectStates(ReleaseStatus.CANARY_10)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_30)
                    .expectStates(ReleaseStatus.CANARY_30)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.TRIGGER_ROLLBACK)
                    .expectStates(ReleaseStatus.ROLLBACKING)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ROLLBACK_COMPLETE)
                    .expectStates(ReleaseStatus.ROLLED_BACK)
                    .and()
                .build();
        
        plan.test();
    }
    
    @Test
    void testInvalidTransition() {
        String machineId = UUID.randomUUID().toString();
        StateMachine<ReleaseStatus, ReleaseEvent> sm = stateMachineFactory.getStateMachine(machineId);
        
        assertEquals(ReleaseStatus.PENDING, sm.getState().getId());
        
        boolean sent = sm.sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_10).block();
        assertFalse(sent);
        assertEquals(ReleaseStatus.PENDING, sm.getState().getId());
    }
    
    @Test
    void testFailFromAnyCanaryState() throws Exception {
        String machineId = UUID.randomUUID().toString();
        StateMachine<ReleaseStatus, ReleaseEvent> sm = stateMachineFactory.getStateMachine(machineId);
        
        StateMachineTestPlan<ReleaseStatus, ReleaseEvent> plan =
            StateMachineTestPlanBuilder.<ReleaseStatus, ReleaseEvent>builder()
                .defaultAwaitTime(2)
                .stateMachine(sm)
                .step()
                    .sendEvent(ReleaseEvent.START_PREPARING)
                    .expectStates(ReleaseStatus.PREPARING)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.ADVANCE_TO_CANARY_10)
                    .expectStates(ReleaseStatus.CANARY_10)
                    .and()
                .step()
                    .sendEvent(ReleaseEvent.FAIL)
                    .expectStates(ReleaseStatus.FAILED)
                    .and()
                .build();
        
        plan.test();
    }
}
