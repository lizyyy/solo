package com.resiliencehub.config;

import com.resiliencehub.interceptor.TraceInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    
    private final TraceInterceptor traceInterceptor;
    
    public WebConfig(TraceInterceptor traceInterceptor) {
        this.traceInterceptor = traceInterceptor;
    }
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(traceInterceptor)
            .addPathPatterns("/**")
            .excludePathPatterns("/error", "/swagger-ui/**", "/api-docs/**", "/actuator/**");
    }
    
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
            .allowedHeaders("*")
            .exposedHeaders("X-Trace-Id", "X-Span-Id", "X-Request-Id")
            .maxAge(3600);
    }
}
