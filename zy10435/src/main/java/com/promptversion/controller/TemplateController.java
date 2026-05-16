package com.promptversion.controller;

import com.promptversion.dto.ApiResponse;
import com.promptversion.dto.CreateTemplateRequest;
import com.promptversion.entity.PromptTemplate;
import com.promptversion.service.TemplateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    @Autowired
    private TemplateService templateService;

    @PostMapping
    public ApiResponse<PromptTemplate> createTemplate(@Valid @RequestBody CreateTemplateRequest request) {
        return ApiResponse.success(templateService.createTemplate(request));
    }

    @GetMapping
    public ApiResponse<List<PromptTemplate>> getAllTemplates() {
        return ApiResponse.success(templateService.getAllTemplates());
    }

    @GetMapping("/{id}")
    public ApiResponse<PromptTemplate> getTemplateById(@PathVariable Long id) {
        return ApiResponse.success(templateService.getTemplateById(id));
    }

    @GetMapping("/name/{name}")
    public ApiResponse<PromptTemplate> getTemplateByName(@PathVariable String name) {
        return ApiResponse.success(templateService.getTemplateByName(name));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable Long id, @RequestParam String operator) {
        templateService.deleteTemplate(id, operator);
        return ApiResponse.success("删除成功", null);
    }
}