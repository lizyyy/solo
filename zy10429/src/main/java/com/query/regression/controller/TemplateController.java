package com.query.regression.controller;

import com.query.regression.dto.ApiResponse;
import com.query.regression.entity.QueryTemplate;
import com.query.regression.repository.QueryTemplateRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final QueryTemplateRepository templateRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<QueryTemplate>> createTemplate(
            @Valid @RequestBody QueryTemplate template) {
        log.info("创建查询模板: {}", template.getName());
        QueryTemplate saved = templateRepository.save(template);
        return ResponseEntity.ok(ApiResponse.success("创建成功", saved));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<QueryTemplate>>> getAllTemplates() {
        List<QueryTemplate> templates = templateRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success(templates));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QueryTemplate>> getTemplate(@PathVariable Long id) {
        return templateRepository.findById(id)
                .map(template -> ResponseEntity.ok(ApiResponse.success(template)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<QueryTemplate>> updateTemplate(
            @PathVariable Long id,
            @Valid @RequestBody QueryTemplate template) {
        if (!templateRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        template.setId(id);
        QueryTemplate updated = templateRepository.save(template);
        return ResponseEntity.ok(ApiResponse.success("更新成功", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteTemplate(@PathVariable Long id) {
        if (!templateRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        templateRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("删除成功", null));
    }
}
