package com.api.inspection.controller;

import com.alibaba.fastjson.JSON;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/mock")
public class MockApiController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("status", "ok");
        result.put("timestamp", System.currentTimeMillis());
        return result;
    }

    @GetMapping("/captcha")
    public Map<String, Object> getCaptcha() {
        Map<String, Object> data = new HashMap<>();
        data.put("captchaId", UUID.randomUUID().toString());
        data.put("expire", 300);

        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("message", "success");
        result.put("data", data);
        return result;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        log.info("登录请求: {}", JSON.toJSONString(body));
        
        Map<String, Object> data = new HashMap<>();
        data.put("token", "mock-token-" + System.currentTimeMillis());
        data.put("userId", "U10001");
        data.put("username", body.get("username"));

        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("message", "登录成功");
        result.put("data", data);
        return result;
    }

    @GetMapping("/user/info")
    public Map<String, Object> getUserInfo(@RequestHeader("Authorization") String token) {
        log.info("获取用户信息, Token: {}", token);
        
        Map<String, Object> data = new HashMap<>();
        data.put("userId", "U10001");
        data.put("username", "demo");
        data.put("email", "demo@example.com");
        data.put("role", "admin");

        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("message", "success");
        result.put("data", data);
        return result;
    }

    @GetMapping("/delay/{ms}")
    public Map<String, Object> delay(@PathVariable Long ms) throws InterruptedException {
        Thread.sleep(ms);
        
        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("delay", ms);
        result.put("message", "延迟响应成功");
        return result;
    }

    @GetMapping("/error/{code}")
    public Map<String, Object> error(@PathVariable Integer code) {
        Map<String, Object> result = new HashMap<>();
        result.put("code", code);
        result.put("message", "模拟错误响应");
        return result;
    }
}
