package com.portinspector;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.portinspector.model.BatchInfo;
import com.portinspector.model.InspectionResult;
import com.portinspector.model.InspectionSample;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class DataStorage {
    private final Path samplesDir;
    private final Path resultsDir;
    private final Path batchesDir;
    private final Path exportsDir;
    private final ObjectMapper objectMapper;

    public DataStorage(String dataDir) {
        this.samplesDir = Paths.get(dataDir, "samples");
        this.resultsDir = Paths.get(dataDir, "results");
        this.batchesDir = Paths.get(dataDir, "batches");
        this.exportsDir = Paths.get(dataDir, "exports");
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        initDirectories();
    }

    private void initDirectories() {
        try {
            Files.createDirectories(samplesDir);
            Files.createDirectories(resultsDir);
            Files.createDirectories(batchesDir);
            Files.createDirectories(exportsDir);
        } catch (IOException e) {
            throw new RuntimeException("创建数据目录失败", e);
        }
    }

    public void saveSample(InspectionSample sample) {
        try {
            Path file = samplesDir.resolve(sample.getSampleId() + ".json");
            objectMapper.writeValue(file.toFile(), sample);
        } catch (IOException e) {
            throw new RuntimeException("保存样本失败", e);
        }
    }

    public Optional<InspectionSample> getSample(String sampleId) {
        try {
            Path file = samplesDir.resolve(sampleId + ".json");
            if (Files.exists(file)) {
                return Optional.of(objectMapper.readValue(file.toFile(), InspectionSample.class));
            }
            return Optional.empty();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public Optional<InspectionSample> findExistingSample(String ipAddress, int port, String supplier) {
        try (Stream<Path> files = Files.list(samplesDir)) {
            return files
                    .filter(p -> p.toString().endsWith(".json"))
                    .map(p -> {
                        try {
                            return objectMapper.readValue(p.toFile(), InspectionSample.class);
                        } catch (IOException e) {
                            return null;
                        }
                    })
                    .filter(s -> s != null
                            && s.getIpAddress().equals(ipAddress)
                            && s.getPort() == port
                            && s.getSupplier().equals(supplier))
                    .findFirst();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public void saveResult(InspectionResult result) {
        try {
            Path file = resultsDir.resolve(result.getSampleId() + ".json");
            objectMapper.writeValue(file.toFile(), result);
        } catch (IOException e) {
            throw new RuntimeException("保存结果失败", e);
        }
    }

    public Optional<InspectionResult> getResult(String sampleId) {
        try {
            Path file = resultsDir.resolve(sampleId + ".json");
            if (Files.exists(file)) {
                return Optional.of(objectMapper.readValue(file.toFile(), InspectionResult.class));
            }
            return Optional.empty();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public List<InspectionResult> getResultsByBatch(String batchId) {
        List<InspectionResult> results = new ArrayList<>();
        try (Stream<Path> files = Files.list(resultsDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            InspectionResult r = objectMapper.readValue(p.toFile(), InspectionResult.class);
                            if (r.getBatchId().equals(batchId)) {
                                results.add(r);
                            }
                        } catch (IOException ignored) {
                        }
                    });
        } catch (IOException ignored) {
        }
        return results;
    }

    public void saveBatch(BatchInfo batch) {
        try {
            Path file = batchesDir.resolve(batch.getBatchId() + ".json");
            objectMapper.writeValue(file.toFile(), batch);
        } catch (IOException e) {
            throw new RuntimeException("保存批次失败", e);
        }
    }

    public Optional<BatchInfo> getBatch(String batchId) {
        try {
            Path file = batchesDir.resolve(batchId + ".json");
            if (Files.exists(file)) {
                return Optional.of(objectMapper.readValue(file.toFile(), BatchInfo.class));
            }
            return Optional.empty();
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    public List<BatchInfo> listBatches() {
        List<BatchInfo> batches = new ArrayList<>();
        try (Stream<Path> files = Files.list(batchesDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            batches.add(objectMapper.readValue(p.toFile(), BatchInfo.class));
                        } catch (IOException ignored) {
                        }
                    });
        } catch (IOException ignored) {
        }
        return batches.stream()
                .sorted((a, b) -> b.getSubmitTime().compareTo(a.getSubmitTime()))
                .collect(Collectors.toList());
    }

    public List<InspectionResult> getAnomaliesByRisk(String riskLevel) {
        List<InspectionResult> results = new ArrayList<>();
        try (Stream<Path> files = Files.list(resultsDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            InspectionResult r = objectMapper.readValue(p.toFile(), InspectionResult.class);
                            if (r.isAnomaly() && r.getRiskLevel().getValue().equalsIgnoreCase(riskLevel)) {
                                results.add(r);
                            }
                        } catch (IOException ignored) {
                        }
                    });
        } catch (IOException ignored) {
        }
        return results;
    }

    public Path getExportsDir() {
        return exportsDir;
    }
}
