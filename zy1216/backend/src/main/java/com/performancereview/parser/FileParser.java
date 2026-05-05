package com.performancereview.parser;

import com.performancereview.entity.Incident;

import java.io.File;
import java.io.IOException;

public interface FileParser {

    String getSupportedFileType();

    boolean canParse(String fileName);

    void parse(File file, Incident incident) throws IOException, IllegalArgumentException;
}
