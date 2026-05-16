package com.ci.cache.controller;

import com.ci.cache.dto.ApiResponse;
import com.ci.cache.model.ProcessingException;
import com.ci.cache.service.ExceptionLoggingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exceptions")
public class ExceptionController {

    @Autowired
    private ExceptionLoggingService exceptionService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProcessingException>>> getAllExceptions() {
        return ResponseEntity.ok(ApiResponse.success(exceptionService.getAllExceptions()));
    }

    @GetMapping("/operation/{operationType}")
    public ResponseEntity<ApiResponse<List<ProcessingException>>> getExceptionsByOperation(@PathVariable String operationType) {
        return ResponseEntity.ok(ApiResponse.success(exceptionService.getExceptionsByOperation(operationType)));
    }

    @GetMapping("/application/{applicationId}")
    public ResponseEntity<ApiResponse<List<ProcessingException>>> getExceptionsByApplicationId(@PathVariable String applicationId) {
        return ResponseEntity.ok(ApiResponse.success(exceptionService.getExceptionsByApplicationId(applicationId)));
    }

    @GetMapping("/cachekey/{cacheKey}")
    public ResponseEntity<ApiResponse<List<ProcessingException>>> getExceptionsByCacheKey(@PathVariable String cacheKey) {
        return ResponseEntity.ok(ApiResponse.success(exceptionService.getExceptionsByCacheKey(cacheKey)));
    }
}
