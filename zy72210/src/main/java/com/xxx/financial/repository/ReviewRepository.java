package com.xxx.financial.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.xxx.financial.model.InterestReviewContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class ReviewRepository {

    private static final Logger logger = LoggerFactory.getLogger(ReviewRepository.class);
    private static final String REVIEWS_DIR = "reviews";
    private static final String IMPORTED_FILE = "imported_adjustments.json";
    private static final String REVIEWS_INDEX = "reviews_index.json";

    private final ObjectMapper objectMapper;
    private final Map<String, InterestReviewContext> contexts = new ConcurrentHashMap<>();
    private final Set<String> importedAdjustments = Collections.synchronizedSet(new LinkedHashSet<>());

    @Value("${review.storage.dir:data}")
    private String storageDir;

    public ReviewRepository() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.setDateFormat(new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss"));
    }

    @PostConstruct
    public void loadFromDisk() {
        try {
            Path dir = Paths.get(storageDir, REVIEWS_DIR);
            Files.createDirectories(dir);

            File importedFile = Paths.get(storageDir, IMPORTED_FILE).toFile();
            if (importedFile.exists()) {
                List<String> list = objectMapper.readValue(importedFile,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
                importedAdjustments.addAll(list);
                logger.info("从磁盘加载导入记录{}条", importedAdjustments.size());
            }

            File indexFile = Paths.get(storageDir, REVIEWS_INDEX).toFile();
            if (indexFile.exists()) {
                List<String> reviewNos = objectMapper.readValue(indexFile,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
                for (String reviewNo : reviewNos) {
                    File ctxFile = dir.resolve(reviewNo + ".json").toFile();
                    if (ctxFile.exists()) {
                        InterestReviewContext ctx = objectMapper.readValue(ctxFile, InterestReviewContext.class);
                        contexts.put(reviewNo, ctx);
                    }
                }
                logger.info("从磁盘加载复核上下文{}个", contexts.size());
            }
        } catch (IOException e) {
            logger.error("加载持久化数据失败: {}", e.getMessage(), e);
        }
    }

    @PreDestroy
    public void saveToDisk() {
        try {
            Path dir = Paths.get(storageDir, REVIEWS_DIR);
            Files.createDirectories(dir);

            File importedFile = Paths.get(storageDir, IMPORTED_FILE).toFile();
            objectMapper.writeValue(importedFile, new ArrayList<>(importedAdjustments));

            List<String> reviewNos = new ArrayList<>(contexts.keySet());
            File indexFile = Paths.get(storageDir, REVIEWS_INDEX).toFile();
            objectMapper.writeValue(indexFile, reviewNos);

            for (Map.Entry<String, InterestReviewContext> e : contexts.entrySet()) {
                File ctxFile = dir.resolve(e.getKey() + ".json").toFile();
                objectMapper.writeValue(ctxFile, e.getValue());
            }
            logger.info("持久化数据保存完成: {}个复核, {}条导入记录", contexts.size(), importedAdjustments.size());
        } catch (IOException e) {
            logger.error("保存持久化数据失败: {}", e.getMessage(), e);
        }
    }

    public void saveContext(InterestReviewContext context) {
        contexts.put(context.getReviewNo(), context);
        try {
            Path dir = Paths.get(storageDir, REVIEWS_DIR);
            Files.createDirectories(dir);
            objectMapper.writeValue(dir.resolve(context.getReviewNo() + ".json").toFile(), context);

            List<String> reviewNos = new ArrayList<>(contexts.keySet());
            objectMapper.writeValue(Paths.get(storageDir, REVIEWS_INDEX).toFile(), reviewNos);

            objectMapper.writeValue(Paths.get(storageDir, IMPORTED_FILE).toFile(),
                    new ArrayList<>(importedAdjustments));
        } catch (IOException e) {
            logger.error("保存上下文{}失败: {}", context.getReviewNo(), e.getMessage());
        }
    }

    public Optional<InterestReviewContext> findByReviewNo(String reviewNo) {
        return Optional.ofNullable(contexts.get(reviewNo));
    }

    public List<InterestReviewContext> findAll() {
        return new ArrayList<>(contexts.values());
    }

    public List<InterestReviewContext> findByBillNo(String billNo) {
        return contexts.values().stream()
                .filter(c -> billNo.equals(c.getCommercialBill() != null ? c.getCommercialBill().getBillNo() : null))
                .collect(Collectors.toList());
    }

    public boolean isAdjustmentImported(String adjustmentNo) {
        return importedAdjustments.contains(adjustmentNo);
    }

    public void recordAdjustmentImported(String adjustmentNo) {
        importedAdjustments.add(adjustmentNo);
        try {
            objectMapper.writeValue(Paths.get(storageDir, IMPORTED_FILE).toFile(),
                    new ArrayList<>(importedAdjustments));
        } catch (IOException e) {
            logger.error("保存导入记录失败: {}", e.getMessage());
        }
    }

    public void clearAdjustmentImported(String adjustmentNo) {
        importedAdjustments.remove(adjustmentNo);
        try {
            objectMapper.writeValue(Paths.get(storageDir, IMPORTED_FILE).toFile(),
                    new ArrayList<>(importedAdjustments));
        } catch (IOException e) {
            logger.error("保存导入记录失败: {}", e.getMessage());
        }
    }

    public Set<String> getAllImportedAdjustments() {
        return new LinkedHashSet<>(importedAdjustments);
    }
}
