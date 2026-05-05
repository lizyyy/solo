package com.performancereview.controller;

import com.performancereview.dto.ApiResponse;
import com.performancereview.dto.FileUploadResult;
import com.performancereview.entity.UploadedFile;
import com.performancereview.enums.FileUploadStatus;
import com.performancereview.service.FileUploadService;
import com.performancereview.service.FileParserManager;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/files")
@Tag(name = "文件上传", description = "文件上传和解析相关接口")
@Slf4j
public class FileUploadController {

    private final FileUploadService fileUploadService;
    private final FileParserManager fileParserManager;

    public FileUploadController(FileUploadService fileUploadService, FileParserManager fileParserManager) {
        this.fileUploadService = fileUploadService;
        this.fileParserManager = fileParserManager;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传单个文件", description = "上传单个性能数据文件并自动解析")
    public ResponseEntity<ApiResponse<FileUploadResult>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "incidentId", required = false) Long incidentId) {
        
        log.info("收到文件上传请求: {}, incidentId: {}", file.getOriginalFilename(), incidentId);

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("文件不能为空", "EMPTY_FILE"));
        }

        try {
            FileUploadResult result = fileUploadService.uploadFile(file, incidentId);
            
            if (result.getStatus() == FileUploadStatus.PARSED) {
                return ResponseEntity.ok(ApiResponse.success("文件上传并解析成功", result));
            } else if (result.getStatus() == FileUploadStatus.FAILED) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("文件解析失败: " + result.getParseError(), "PARSE_ERROR"));
            } else {
                return ResponseEntity.ok(ApiResponse.success("文件上传成功", result));
            }
        } catch (IOException e) {
            log.error("文件上传失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("文件上传失败: " + e.getMessage(), "UPLOAD_ERROR"));
        } catch (IllegalArgumentException e) {
            log.warn("文件参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage(), "INVALID_ARGUMENT"));
        }
    }

    @PostMapping(value = "/upload/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "批量上传文件", description = "批量上传多个性能数据文件并自动解析")
    public ResponseEntity<ApiResponse<List<FileUploadResult>>> uploadMultipleFiles(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "incidentId", required = false) Long incidentId) {
        
        log.info("收到批量文件上传请求, 文件数量: {}, incidentId: {}", files.size(), incidentId);

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("文件列表不能为空", "EMPTY_FILES"));
        }

        try {
            List<FileUploadResult> results = fileUploadService.uploadMultipleFiles(files, incidentId);
            
            long successCount = results.stream()
                    .filter(r -> r.getStatus() == FileUploadStatus.PARSED)
                    .count();
            long failedCount = results.stream()
                    .filter(r -> r.getStatus() == FileUploadStatus.FAILED)
                    .count();

            String message = String.format("成功上传并解析 %d 个文件", successCount);
            if (failedCount > 0) {
                message += String.format(", %d 个文件解析失败", failedCount);
            }

            return ResponseEntity.ok(ApiResponse.success(message, results));
        } catch (IOException e) {
            log.error("批量文件上传失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("批量文件上传失败: " + e.getMessage(), "UPLOAD_ERROR"));
        }
    }

    @GetMapping("/incident/{incidentId}")
    @Operation(summary = "获取事故的文件列表", description = "获取指定事故的所有上传文件列表")
    public ResponseEntity<ApiResponse<List<UploadedFile>>> getFilesByIncidentId(
            @Parameter(description = "事故ID") @PathVariable Long incidentId) {
        
        log.info("获取事故文件列表: incidentId={}", incidentId);

        try {
            List<UploadedFile> files = fileUploadService.getFilesByIncidentId(incidentId);
            return ResponseEntity.ok(ApiResponse.success(files));
        } catch (Exception e) {
            log.error("获取事故文件列表失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取文件列表失败: " + e.getMessage(), "QUERY_ERROR"));
        }
    }

    @GetMapping("/supported-types")
    @Operation(summary = "获取支持的文件类型", description = "获取系统支持的所有文件类型")
    public ResponseEntity<ApiResponse<List<String>>> getSupportedFileTypes() {
        List<String> types = fileParserManager.getAllParsers().stream()
                .map(parser -> parser.getSupportedFileType())
                .toList();
        return ResponseEntity.ok(ApiResponse.success(types));
    }
}
