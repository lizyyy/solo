package com.performancereview.service;

import com.performancereview.entity.Incident;
import com.performancereview.parser.FileParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.List;

@Service
@Slf4j
public class FileParserManager {

    private final List<FileParser> parsers;

    public FileParserManager(List<FileParser> parsers) {
        this.parsers = parsers;
        log.info("已注册 {} 个文件解析器", parsers.size());
        for (FileParser parser : parsers) {
            log.info(" - 解析器: {}", parser.getSupportedFileType());
        }
    }

    public FileParser getParser(String fileName) {
        for (FileParser parser : parsers) {
            if (parser.canParse(fileName)) {
                return parser;
            }
        }
        return null;
    }

    public void parseFile(File file, String fileName, Incident incident) throws IOException, IllegalArgumentException {
        FileParser parser = getParser(fileName);
        if (parser == null) {
            // 对于无法识别的文件类型，我们不抛出异常，而是记录警告并继续
            log.warn("没有找到适合文件 {} 的解析器", fileName);
            return;
        }

        log.info("使用解析器 {} 解析文件: {}", parser.getSupportedFileType(), fileName);
        parser.parse(file, incident);
    }

    public List<FileParser> getAllParsers() {
        return parsers;
    }
}
