package com.apigate.voting.config;

import com.apigate.voting.model.Caller;
import com.apigate.voting.repository.CallerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final CallerRepository callerRepository;

    @Override
    public void run(String... args) {
        if (callerRepository.count() == 0) {
            createCaller("U001", "张三", "技术部", "zhangsan@example.com");
            createCaller("U002", "李四", "产品部", "lisi@example.com");
            createCaller("U003", "王五", "架构组", "wangwu@example.com");
            createCaller("U004", "赵六", "测试部", "zhaoliu@example.com");
            log.info("初始化测试用户数据完成");
        }
    }

    private void createCaller(String callerId, String name, String department, String email) {
        Caller caller = new Caller();
        caller.setCallerId(callerId);
        caller.setName(name);
        caller.setDepartment(department);
        caller.setEmail(email);
        caller.setIsActive(true);
        caller.setCreatedAt(LocalDateTime.now());
        caller.setUpdatedAt(LocalDateTime.now());
        callerRepository.save(caller);
    }
}
