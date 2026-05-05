package com.performancereview.service;

import com.performancereview.dto.FileUploadResult;
import com.performancereview.entity.Incident;
import com.performancereview.entity.UploadedFile;
import com.performancereview.enums.FileUploadStatus;
import com.performancereview.repository.IncidentRepository;
import com.performancereview.repository.UploadedFileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
public class FileUploadService {

    private final IncidentRepository incidentRepository;
    private final UploadedFileRepository uploadedFileRepository;
    private final FileParserManager fileParserManager;
    private final DataAnalysisService dataAnalysisService;

    private static final String UPLOAD_DIR = "./uploads";

    public FileUploadService(IncidentRepository incidentRepository,
                             UploadedFileRepository uploadedFileRepository,
                             FileParserManager fileParserManager,
                             DataAnalysisService dataAnalysisService) {
        this.incidentRepository = incidentRepository;
        this.uploadedFileRepository = uploadedFileRepository;
        this.fileParserManager = fileParserManager;
        this.dataAnalysisService = dataAnalysisService;

        // 确保上传目录存在
        createUploadDirectory();
    }

    private void createUploadDirectory() {
        try {
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
                log.info("创建上传目录: {}", uploadPath.toAbsolutePath());
            }
        } catch (IOException e) {
            log.error("创建上传目录失败: {}", e.getMessage());
        }
    }

    @Transactional
    public FileUploadResult uploadFile(MultipartFile file, Long incidentId) throws IOException {
        log.info("开始上传文件: {}, incidentId: {}", file.getOriginalFilename(), incidentId);

        // 获取或创建事故
        Incident incident = getOrCreateIncident(incidentId);

        // 保存文件
        String originalFileName = file.getOriginalFilename();
        String uniqueFileName = generateUniqueFileName(originalFileName);
        Path filePath = Paths.get(UPLOAD_DIR, uniqueFileName);

        Files.copy(file.getInputStream(), filePath);

        // 创建上传文件记录
        UploadedFile uploadedFile = new UploadedFile();
        uploadedFile.setFileName(originalFileName);
        uploadedFile.setFilePath(filePath.toString());
        uploadedFile.setFileSize(file.getSize());
        uploadedFile.setFileType(determineFileType(originalFileName));
        uploadedFile.setStatus(FileUploadStatus.UPLOADED);
        uploadedFile.setUploadedAt(LocalDateTime.now());
        uploadedFile.setIncident(incident);

        uploadedFile = uploadedFileRepository.save(uploadedFile);

        // 解析文件
        try {
            uploadedFile.setStatus(FileUploadStatus.PARSING);
            uploadedFile = uploadedFileRepository.save(uploadedFile);

            fileParserManager.parseFile(filePath.toFile(), originalFileName, incident);

            // 保存解析后的数据
            incident = incidentRepository.save(incident);

            // 执行数据分析
            dataAnalysisService.analyzeIncident(incident);

            uploadedFile.setStatus(FileUploadStatus.PARSED);
            log.info("文件解析成功: {}", originalFileName);
        } catch (IllegalArgumentException e) {
            log.warn("文件解析失败: {} - {}", originalFileName, e.getMessage());
            uploadedFile.setStatus(FileUploadStatus.FAILED);
            uploadedFile.setParseError(e.getMessage());
        } catch (Exception e) {
            log.error("文件解析时发生意外错误: {} - {}", originalFileName, e.getMessage(), e);
            uploadedFile.setStatus(FileUploadStatus.FAILED);
            uploadedFile.setParseError("解析时发生意外错误: " + e.getMessage());
        }

        uploadedFile = uploadedFileRepository.save(uploadedFile);

        return convertToDto(uploadedFile);
    }

    @Transactional
    public List<FileUploadResult> uploadMultipleFiles(List<MultipartFile> files, Long incidentId) throws IOException {
        log.info("开始批量上传文件, 文件数量: {}, incidentId: {}", files.size(), incidentId);

        List<FileUploadResult> results = new ArrayList<>();
        Incident incident = getOrCreateIncident(incidentId);

        for (MultipartFile file : files) {
            try {
                FileUploadResult result = uploadFile(file, incident.getId());
                results.add(result);
            } catch (Exception e) {
                log.error("上传文件 {} 时出错: {}", file.getOriginalFilename(), e.getMessage());
                // 继续处理其他文件
            }
        }

        return results;
    }

    private Incident getOrCreateIncident(Long incidentId) {
        if (incidentId != null) {
            Optional<Incident> existing = incidentRepository.findById(incidentId);
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        // 创建新的事故
        Incident newIncident = new Incident();
        newIncident.setTitle("事故 - " + LocalDateTime.now());
        newIncident.setStatus("OPEN");
        newIncident.setSeverity("MEDIUM");

        return incidentRepository.save(newIncident);
    }

    private String generateUniqueFileName(String originalFileName) {
        String extension = "";
        int lastDot = originalFileName.lastIndexOf('.');
        if (lastDot > 0) {
            extension = originalFileName.substring(lastDot);
        }
        return UUID.randomUUID().toString() + extension;
    }

    private String determineFileType(String fileName) {
        if (fileName == null) return "unknown";
        String lowerName = fileName.toLowerCase();

        if (lowerName.contains("incident") && lowerName.endsWith(".json")) {
            return "incident.json";
        }
        if (lowerName.contains("gc") && lowerName.endsWith(".log")) {
            return "gc.log";
        }
        if (lowerName.contains("thread") && lowerName.contains("dump")) {
            return "thread-dump";
        }
        if (lowerName.contains("jstack")) {
            return "thread-dump";
        }
        if (lowerName.contains("slow") && lowerName.contains("request")) {
            return "slow-request";
        }
        if (lowerName.contains("access") && lowerName.endsWith(".log")) {
            return "slow-request";
        }
        if (lowerName.contains("io") && (lowerName.contains("block") || lowerName.contains("disk"))) {
            return "io-block";
        }
        if (lowerName.contains("network") && (lowerName.contains("rtt") || lowerName.contains("latency"))) {
            return "network-rtt";
        }
        if (lowerName.contains("ping") || lowerName.contains("traceroute")) {
            return "network-rtt";
        }

        return "unknown";
    }

    private FileUploadResult convertToDto(UploadedFile uploadedFile) {
        FileUploadResult dto = new FileUploadResult();
        dto.setId(uploadedFile.getId());
        dto.setFileName(uploadedFile.getFileName());
        dto.setFileType(uploadedFile.getFileType());
        dto.setFileSize(uploadedFile.getFileSize());
        dto.setStatus(uploadedFile.getStatus());
        dto.setParseError(uploadedFile.getParseError());
        dto.setUploadedAt(uploadedFile.getUploadedAt());
        if (uploadedFile.getIncident() != null) {
            dto.setIncidentId(uploadedFile.getIncident().getId());
        }
        return dto;
    }

    public List<UploadedFile> getFilesByIncidentId(Long incidentId) {
        return uploadedFileRepository.findByIncidentIdOrderByUploadedAtDesc(incidentId);
    }
}
