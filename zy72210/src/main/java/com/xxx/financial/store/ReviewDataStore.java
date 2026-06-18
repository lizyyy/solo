package com.xxx.financial.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.xxx.financial.model.InterestReviewContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ReviewDataStore {

    private static final Logger logger = LoggerFactory.getLogger(ReviewDataStore.class);

    private static final String DATA_DIR = "data";
    private static final String CONTEXTS_FILE = "review_contexts.json";
    private static final String IMPORTED_ADJUSTMENTS_FILE = "imported_adjustments.json";

    private final Map<String, InterestReviewContext> contextStore = new ConcurrentHashMap<>();
    private final Set<String> importedAdjustments = Collections.synchronizedSet(new HashSet<>());

    private final ObjectMapper objectMapper;

    public ReviewDataStore() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @PostConstruct
    public void init() {
        loadFromDisk();
    }

    private void loadFromDisk() {
        File dataDir = new File(DATA_DIR);
        if (!dataDir.exists()) {
            logger.info("数据目录不存在，首次启动");
            return;
        }

        File contextsFile = new File(dataDir, CONTEXTS_FILE);
        if (contextsFile.exists()) {
            try {
                InterestReviewContext[] contexts = objectMapper.readValue(contextsFile, InterestReviewContext[].class);
                for (InterestReviewContext ctx : contexts) {
                    contextStore.put(ctx.getReviewNo(), ctx);
                }
                logger.info("从磁盘加载了 {} 条复核记录", contextStore.size());
            } catch (IOException e) {
                logger.error("加载复核记录失败: {}", e.getMessage());
            }
        }

        File adjustmentsFile = new File(dataDir, IMPORTED_ADJUSTMENTS_FILE);
        if (adjustmentsFile.exists()) {
            try {
                String[] adjustments = objectMapper.readValue(adjustmentsFile, String[].class);
                importedAdjustments.addAll(Arrays.asList(adjustments));
                logger.info("从磁盘加载了 {} 条已导入调整单号", importedAdjustments.size());
            } catch (IOException e) {
                logger.error("加载已导入调整单号失败: {}", e.getMessage());
            }
        }
    }

    public synchronized void saveToDisk() {
        File dataDir = new File(DATA_DIR);
        if (!dataDir.exists()) {
            dataDir.mkdirs();
        }

        try {
            File contextsFile = new File(dataDir, CONTEXTS_FILE);
            List<InterestReviewContext> contextList = new ArrayList<>(contextStore.values());
            objectMapper.writeValue(contextsFile, contextList);

            File adjustmentsFile = new File(dataDir, IMPORTED_ADJUSTMENTS_FILE);
            List<String> adjustmentList = new ArrayList<>(importedAdjustments);
            objectMapper.writeValue(adjustmentsFile, adjustmentList);

            logger.info("数据已持久化到磁盘，复核记录: {} 条, 已导入调整: {} 条",
                    contextStore.size(), importedAdjustments.size());
        } catch (IOException e) {
            logger.error("保存数据到磁盘失败: {}", e.getMessage());
        }
    }

    public void saveContext(InterestReviewContext context) {
        contextStore.put(context.getReviewNo(), context);
        saveToDisk();
    }

    public InterestReviewContext getContext(String reviewNo) {
        return contextStore.get(reviewNo);
    }

    public List<InterestReviewContext> getAllContexts() {
        return new ArrayList<>(contextStore.values());
    }

    public void addImportedAdjustment(String adjustmentNo) {
        importedAdjustments.add(adjustmentNo);
        saveToDisk();
    }

    public void removeImportedAdjustment(String adjustmentNo) {
        importedAdjustments.remove(adjustmentNo);
        saveToDisk();
    }

    public boolean isAdjustmentImported(String adjustmentNo) {
        return importedAdjustments.contains(adjustmentNo);
    }

    public Set<String> getAllImportedAdjustments() {
        return new HashSet<>(importedAdjustments);
    }

    public void deleteContext(String reviewNo) {
        InterestReviewContext ctx = contextStore.remove(reviewNo);
        if (ctx != null && ctx.getTailAdjustment() != null) {
            importedAdjustments.remove(ctx.getTailAdjustment().getAdjustmentNo());
        }
        saveToDisk();
    }

    public void clearAll() {
        contextStore.clear();
        importedAdjustments.clear();
        saveToDisk();
    }
}
