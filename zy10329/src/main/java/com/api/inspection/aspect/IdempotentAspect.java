package com.api.inspection.aspect;

import com.api.inspection.annotation.Idempotent;
import com.api.inspection.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Aspect
@Component
public class IdempotentAspect {
    private final Map<String, Long> requestCache = new ConcurrentHashMap<>();

    @Around("@annotation(idempotent)")
    public Object around(ProceedingJoinPoint joinPoint, Idempotent idempotent) throws Throwable {
        String key = generateKey(joinPoint);
        
        if (isRequestExists(key)) {
            throw new BusinessException("请求正在处理中或已处理完成, 请稍后再试");
        }
        
        try {
            addRequest(key, idempotent.expireSeconds());
            return joinPoint.proceed();
        } finally {
            if (idempotent.expireSeconds() <= 0) {
                removeRequest(key);
            }
        }
    }

    private String generateKey(ProceedingJoinPoint joinPoint) {
        StringBuilder sb = new StringBuilder();
        sb.append(joinPoint.getTarget().getClass().getSimpleName());
        sb.append(":");
        sb.append(joinPoint.getSignature().getName());
        sb.append(":");
        
        Object[] args = joinPoint.getArgs();
        for (Object arg : args) {
            if (arg != null) {
                sb.append(arg.hashCode());
                sb.append(":");
            }
        }
        
        return sb.toString();
    }

    private boolean isRequestExists(String key) {
        Long expireTime = requestCache.get(key);
        if (expireTime == null) {
            return false;
        }
        if (System.currentTimeMillis() > expireTime) {
            requestCache.remove(key);
            return false;
        }
        return true;
    }

    private void addRequest(String key, int expireSeconds) {
        long expireTime = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(expireSeconds);
        requestCache.put(key, expireTime);
    }

    private void removeRequest(String key) {
        requestCache.remove(key);
    }
}
