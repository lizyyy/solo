package com.grayscale.rollback.config;

import com.grayscale.rollback.enums.ReleaseEvent;
import com.grayscale.rollback.enums.ReleaseStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.statemachine.action.Action;
import org.springframework.statemachine.config.EnableStateMachineFactory;
import org.springframework.statemachine.config.EnumStateMachineConfigurerAdapter;
import org.springframework.statemachine.config.builders.StateMachineConfigurationConfigurer;
import org.springframework.statemachine.config.builders.StateMachineStateConfigurer;
import org.springframework.statemachine.config.builders.StateMachineTransitionConfigurer;
import org.springframework.statemachine.guard.Guard;

import java.util.EnumSet;

@Configuration
@EnableStateMachineFactory
@Slf4j
public class StateMachineConfig extends EnumStateMachineConfigurerAdapter<ReleaseStatus, ReleaseEvent> {
    
    @Override
    public void configure(StateMachineConfigurationConfigurer<ReleaseStatus, ReleaseEvent> config) throws Exception {
        config
            .withConfiguration()
            .autoStartup(true)
            .listener(new org.springframework.statemachine.listener.StateMachineListenerAdapter<>() {
                @Override
                public void stateChanged(org.springframework.statemachine.state.State<ReleaseStatus, ReleaseEvent> from,
                                         org.springframework.statemachine.state.State<ReleaseStatus, ReleaseEvent> to) {
                    if (from != null) {
                        log.info("State transition: {} -> {}", from.getId(), to.getId());
                    }
                }
            });
    }
    
    @Override
    public void configure(StateMachineStateConfigurer<ReleaseStatus, ReleaseEvent> states) throws Exception {
        states
            .withStates()
                .initial(ReleaseStatus.PENDING)
                .states(EnumSet.allOf(ReleaseStatus.class))
                .end(ReleaseStatus.COMPLETED)
                .end(ReleaseStatus.ROLLED_BACK)
                .end(ReleaseStatus.FAILED);
    }
    
    @Override
    public void configure(StateMachineTransitionConfigurer<ReleaseStatus, ReleaseEvent> transitions) throws Exception {
        transitions
            .withExternal()
                .source(ReleaseStatus.PENDING)
                .target(ReleaseStatus.PREPARING)
                .event(ReleaseEvent.START_PREPARING)
                .action(preparingAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.PREPARING)
                .target(ReleaseStatus.CANARY_10)
                .event(ReleaseEvent.ADVANCE_TO_CANARY_10)
                .action(canaryAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_10)
                .target(ReleaseStatus.CANARY_30)
                .event(ReleaseEvent.ADVANCE_TO_CANARY_30)
                .action(canaryAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_30)
                .target(ReleaseStatus.CANARY_50)
                .event(ReleaseEvent.ADVANCE_TO_CANARY_50)
                .action(canaryAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_50)
                .target(ReleaseStatus.CANARY_100)
                .event(ReleaseEvent.ADVANCE_TO_CANARY_100)
                .action(canaryAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_100)
                .target(ReleaseStatus.COMPLETED)
                .event(ReleaseEvent.COMPLETE)
                .action(completeAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.PREPARING)
                .target(ReleaseStatus.ROLLBACKING)
                .event(ReleaseEvent.TRIGGER_ROLLBACK)
                .action(rollbackAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_10)
                .target(ReleaseStatus.ROLLBACKING)
                .event(ReleaseEvent.TRIGGER_ROLLBACK)
                .action(rollbackAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_30)
                .target(ReleaseStatus.ROLLBACKING)
                .event(ReleaseEvent.TRIGGER_ROLLBACK)
                .action(rollbackAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_50)
                .target(ReleaseStatus.ROLLBACKING)
                .event(ReleaseEvent.TRIGGER_ROLLBACK)
                .action(rollbackAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_100)
                .target(ReleaseStatus.ROLLBACKING)
                .event(ReleaseEvent.TRIGGER_ROLLBACK)
                .action(rollbackAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.ROLLBACKING)
                .target(ReleaseStatus.ROLLED_BACK)
                .event(ReleaseEvent.ROLLBACK_COMPLETE)
                .action(rollbackCompleteAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.PREPARING)
                .target(ReleaseStatus.FAILED)
                .event(ReleaseEvent.FAIL)
                .action(failAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_10)
                .target(ReleaseStatus.FAILED)
                .event(ReleaseEvent.FAIL)
                .action(failAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_30)
                .target(ReleaseStatus.FAILED)
                .event(ReleaseEvent.FAIL)
                .action(failAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_50)
                .target(ReleaseStatus.FAILED)
                .event(ReleaseEvent.FAIL)
                .action(failAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.CANARY_100)
                .target(ReleaseStatus.FAILED)
                .event(ReleaseEvent.FAIL)
                .action(failAction())
                .and()
            
            .withExternal()
                .source(ReleaseStatus.ROLLBACKING)
                .target(ReleaseStatus.FAILED)
                .event(ReleaseEvent.FAIL)
                .action(failAction());
    }
    
    @Bean
    public Action<ReleaseStatus, ReleaseEvent> preparingAction() {
        return context -> log.info("Executing PREPARING action");
    }
    
    @Bean
    public Action<ReleaseStatus, ReleaseEvent> canaryAction() {
        return context -> log.info("Executing CANARY action");
    }
    
    @Bean
    public Action<ReleaseStatus, ReleaseEvent> completeAction() {
        return context -> log.info("Executing COMPLETE action");
    }
    
    @Bean
    public Action<ReleaseStatus, ReleaseEvent> rollbackAction() {
        return context -> log.info("Executing ROLLBACK action");
    }
    
    @Bean
    public Action<ReleaseStatus, ReleaseEvent> rollbackCompleteAction() {
        return context -> log.info("Executing ROLLBACK_COMPLETE action");
    }
    
    @Bean
    public Action<ReleaseStatus, ReleaseEvent> failAction() {
        return context -> log.info("Executing FAIL action");
    }
}
