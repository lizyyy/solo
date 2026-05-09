package com.resiliencehub.ratelimit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    
    String key() default "";
    
    int limit() default 100;
    
    int window() default 1;
    
    LimitStrategy strategy() default LimitStrategy.TOKEN_BUCKET;
    
    String blockHandler() default "";
    
    enum LimitStrategy {
        TOKEN_BUCKET,
        LEAKY_BUCKET,
        FIXED_WINDOW,
        SLIDING_WINDOW
    }
}
