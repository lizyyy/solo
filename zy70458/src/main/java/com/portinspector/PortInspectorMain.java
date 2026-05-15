package com.portinspector;

import com.portinspector.model.BatchInfo;
import com.portinspector.model.InspectionResult;
import com.portinspector.model.InspectionSample;
import picocli.CommandLine;
import picocli.CommandLine.*;

import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Callable;

@Command(name = "port-inspector", description = "端口占用巡检命令行工具",
        subcommands = {
                PortInspectorMain.InspectCommand.class,
                PortInspectorMain.ReportCommand.class,
                PortInspectorMain.ExportCommand.class,
                PortInspectorMain.ExportAnomaliesCommand.class,
                PortInspectorMain.ExportByRiskCommand.class,
                PortInspectorMain.ListBatchesCommand.class,
                PortInspectorMain.ListRulesCommand.class,
                PortInspectorMain.ReviewCommand.class
        })
public class PortInspectorMain implements Callable<Integer> {

    @Option(names = {"--data-dir"}, description = "数据目录")
    private String dataDir = Paths.get(System.getProperty("user.home"), ".port_inspector", "data").toString();

    public static void main(String[] args) {
        int exitCode = new CommandLine(new PortInspectorMain()).execute(args);
        System.exit(exitCode);
    }

    @Override
    public Integer call() {
        System.out.println("端口占用巡检命令行工具");
        System.out.println("使用 --help 查看帮助");
        return 0;
    }

    private PortInspector createInspector() {
        return new PortInspector(dataDir);
    }

    @Command(name = "inspect", description = "执行端口占用巡检")
    static class InspectCommand implements Callable<Integer> {
        @Parameters(index = "0", description = "Excel文件路径")
        private String excelFile;

        @Option(names = {"--rule-version"}, description = "指定规则版本")
        private String ruleVersion;

        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                ExcelImporter importer = new ExcelImporter(inspector);
                List<InspectionSample> samples = importer.loadSamplesFromExcel(excelFile);

                System.out.println("加载了 " + samples.size() + " 个样本");

                BatchInfo batch = inspector.processBatch(samples, ruleVersion);
                Map<String, Object> report = inspector.getBatchReport(batch.getBatchId());

                System.out.println();
                System.out.println("批次ID: " + batch.getBatchId());
                System.out.println("使用规则版本: " + batch.getRuleVersionAtSubmit());
                System.out.println("总样本数: " + report.get("totalSamples"));
                System.out.println("异常样本数: " + report.get("anomalyCount"));
                System.out.println();
                System.out.println("风险等级分布:");
                Map<String, Integer> distribution = (Map<String, Integer>) report.get("riskDistribution");
                for (Map.Entry<String, Integer> entry : distribution.entrySet()) {
                    System.out.println("  " + entry.getKey() + ": " + entry.getValue());
                }

                if (batch.getAnomalyCount() > 0) {
                    ExcelExporter exporter = new ExcelExporter(inspector.getStorage());
                    String output = exporter.exportAnomalies(batch.getBatchId(), null, null);
                    System.out.println();
                    System.out.println("异常样本已导出到: " + output);
                }

                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                e.printStackTrace();
                return 1;
            }
        }
    }

    @Command(name = "report", description = "查看批次巡检报告")
    static class ReportCommand implements Callable<Integer> {
        @Parameters(index = "0", description = "批次ID")
        private String batchId;

        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                Map<String, Object> report = inspector.getBatchReport(batchId);
                BatchInfo batch = (BatchInfo) report.get("batch");

                System.out.println("批次ID: " + batchId);
                System.out.println("提交时间: " + batch.getSubmitTime());
                System.out.println("规则版本: " + report.get("ruleVersion"));
                System.out.println("总样本数: " + report.get("totalSamples"));
                System.out.println("异常样本数: " + report.get("anomalyCount"));
                System.out.println();
                System.out.println("风险等级分布:");
                Map<String, Integer> distribution = (Map<String, Integer>) report.get("riskDistribution");
                for (Map.Entry<String, Integer> entry : distribution.entrySet()) {
                    System.out.println("  " + entry.getKey() + ": " + entry.getValue());
                }

                System.out.println();
                System.out.println("异常样本详情:");
                List<InspectionResult> results = (List<InspectionResult>) report.get("results");
                for (InspectionResult result : results) {
                    if (result.isAnomaly()) {
                        InspectionSample sample = inspector.getStorage().getSample(result.getSampleId()).orElse(null);
                        if (sample == null) continue;

                        System.out.println();
                        System.out.println("  样本ID: " + sample.getSampleId());
                        System.out.println("  IP: " + sample.getIpAddress() + ":" + sample.getPort());
                        System.out.println("  供应商: " + sample.getSupplier() + " (原始: " + sample.getSupplierOriginal() + ")");
                        System.out.println("  风险等级: " + result.getRiskLevel().getValue());
                        System.out.println("  结论: " + result.getConclusion());
                    }
                }

                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }

    @Command(name = "export", description = "导出批次完整报告")
    static class ExportCommand implements Callable<Integer> {
        @Parameters(index = "0", description = "批次ID")
        private String batchId;

        @Option(names = {"--output"}, description = "输出文件路径")
        private String output;

        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                ExcelExporter exporter = new ExcelExporter(inspector.getStorage());
                String result = exporter.exportFullReport(batchId, output);
                System.out.println("报告已导出到: " + result);
                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }

    @Command(name = "export-anomalies", description = "导出异常样本供复核")
    static class ExportAnomaliesCommand implements Callable<Integer> {
        @Parameters(index = "0", description = "批次ID")
        private String batchId;

        @Option(names = {"--output"}, description = "输出文件路径")
        private String output;

        @Option(names = {"--risk-level"}, description = "按风险等级过滤")
        private String riskLevel;

        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                ExcelExporter exporter = new ExcelExporter(inspector.getStorage());
                String result = exporter.exportAnomalies(batchId, output, riskLevel);
                System.out.println("异常样本已导出到: " + result);
                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }

    @Command(name = "export-by-risk", description = "按风险等级导出所有异常样本")
    static class ExportByRiskCommand implements Callable<Integer> {
        @Parameters(index = "0", description = "风险等级")
        private String riskLevel;

        @Option(names = {"--output"}, description = "输出文件路径")
        private String output;

        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                ExcelExporter exporter = new ExcelExporter(inspector.getStorage());
                String result = exporter.exportByRiskLevel(riskLevel, output);
                System.out.println("风险等级 " + riskLevel + " 的异常样本已导出到: " + result);
                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }

    @Command(name = "list-batches", description = "列出所有巡检批次")
    static class ListBatchesCommand implements Callable<Integer> {
        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                List<BatchInfo> batches = inspector.getStorage().listBatches();

                if (batches.isEmpty()) {
                    System.out.println("暂无巡检批次");
                    return 0;
                }

                System.out.println("共 " + batches.size() + " 个批次:");
                for (BatchInfo batch : batches) {
                    System.out.println();
                    System.out.println("批次ID: " + batch.getBatchId());
                    System.out.println("  提交时间: " + batch.getSubmitTime());
                    System.out.println("  规则版本: " + batch.getRuleVersionAtSubmit());
                    System.out.println("  总样本数: " + batch.getTotalSamples());
                    System.out.println("  异常数: " + batch.getAnomalyCount());
                    System.out.println("  状态: " + batch.getStatus());
                }
                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }

    @Command(name = "list-rules", description = "列出所有规则版本")
    static class ListRulesCommand implements Callable<Integer> {
        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                List<String> versions = inspector.getRuleManager().listRuleVersions();

                System.out.println("共 " + versions.size() + " 个规则版本:");
                for (String v : versions) {
                    System.out.println();
                    System.out.println("版本: " + v);
                    System.out.println("  描述: " + inspector.getRuleManager().getRule(v).getDescription());
                }
                System.out.println();
                System.out.println("当前生效版本: " + inspector.getRuleManager().getLatestRule().getVersion());
                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }

    @Command(name = "review", description = "标记样本为已复核")
    static class ReviewCommand implements Callable<Integer> {
        @Parameters(index = "0", description = "样本ID")
        private String sampleId;

        @Parameters(index = "1", description = "复核人")
        private String reviewer;

        @Option(names = {"--notes"}, description = "复核备注")
        private String notes = "";

        @ParentCommand
        private PortInspectorMain parent;

        @Override
        public Integer call() {
            try {
                PortInspector inspector = parent.createInspector();
                ReviewService reviewService = new ReviewService(inspector.getStorage());
                InspectionResult result = reviewService.markReviewed(sampleId, reviewer, notes);
                System.out.println("样本 " + sampleId + " 已标记为已复核");
                return 0;
            } catch (Exception e) {
                System.err.println("错误: " + e.getMessage());
                return 1;
            }
        }
    }
}
