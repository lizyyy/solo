import java.io.*;
import java.net.*;
import java.nio.*;
import java.nio.channels.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/**
 * 纯 Java 项目构建器 - 无需 Maven/JDK，使用 ECJ 编译
 * 用法: java Build.java
 */
public class Build {
    
    private static final String ECJ_URL = "https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.20.0/ecj-3.20.0.jar";
    private static final String SPRING_BOOT_VERSION = "2.7.18";
    
    private static Path projectDir;
    private static Path libDir;
    private static Path buildDir;
    private static Path classesDir;
    
    public static void main(String[] args) throws Exception {
        projectDir = Paths.get(".").toAbsolutePath();
        libDir = projectDir.resolve("lib");
        buildDir = projectDir.resolve("target");
        classesDir = buildDir.resolve("classes");
        
        System.out.println("========================================");
        System.out.println("设备命令确认 API - 纯 Java 构建器");
        System.out.println("========================================");
        
        // 1. 创建目录
        System.out.println("\n[1/6] 创建目录...");
        Files.createDirectories(libDir);
        Files.createDirectories(classesDir);
        System.out.println("  项目目录: " + projectDir);
        
        // 2. 下载依赖
        System.out.println("\n[2/6] 下载核心依赖...");
        downloadDependencies();
        
        // 3. 编译源码
        System.out.println("\n[3/6] 编译 Java 源码...");
        compileSources();
        
        // 4. 复制资源
        System.out.println("\n[4/6] 复制资源文件...");
        copyResources();
        
        // 5. 打包 JAR
        System.out.println("\n[5/6] 创建可执行 JAR...");
        createExecutableJar();
        
        // 6. 完成
        System.out.println("\n[6/6] 构建完成!");
        System.out.println("========================================");
        System.out.println("✅ JAR 包: target/device-command-confirmation-api-1.0.0.jar");
        System.out.println("");
        System.out.println("启动服务: java -jar target/device-command-confirmation-api-1.0.0.jar");
        System.out.println("========================================");
    }
    
    private static void downloadDependencies() throws Exception {
        String[] dependencies = {
            ECJ_URL,
            "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-web/" + SPRING_BOOT_VERSION + "/spring-boot-starter-web-" + SPRING_BOOT_VERSION + ".jar",
            "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-data-jpa/" + SPRING_BOOT_VERSION + "/spring-boot-starter-data-jpa-" + SPRING_BOOT_VERSION + ".jar",
            "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-validation/" + SPRING_BOOT_VERSION + "/spring-boot-starter-validation-" + SPRING_BOOT_VERSION + ".jar",
            "https://repo1.maven.org/maven2/com/h2database/h2/2.1.214/h2-2.1.214.jar",
            "https://repo1.maven.org/maven2/org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar",
            "https://repo1.maven.org/maven2/com/alibaba/fastjson/1.2.83/fastjson-1.2.83.jar"
        };
        
        for (String depUrl : dependencies) {
            String fileName = depUrl.substring(depUrl.lastIndexOf('/') + 1);
            Path target = libDir.resolve(fileName);
            if (!Files.exists(target)) {
                System.out.println("  下载: " + fileName);
                download(depUrl, target);
            }
        }
    }
    
    private static void download(String urlStr, Path target) throws Exception {
        URL url = new URL(urlStr);
        try (ReadableByteChannel rbc = Channels.newChannel(url.openStream());
             FileOutputStream fos = new FileOutputStream(target.toFile())) {
            fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);
        }
    }
    
    private static void compileSources() throws Exception {
        Path srcDir = projectDir.resolve("src/main/java");
        
        List<String> files = new ArrayList<>();
        Files.walk(srcDir)
             .filter(p -> p.toString().endsWith(".java"))
             .forEach(p -> files.add(p.toAbsolutePath().toString()));
        
        System.out.println("  找到 " + files.size() + " 个 Java 文件");
        
        List<String> cp = new ArrayList<>();
        Files.list(libDir)
             .filter(p -> p.toString().endsWith(".jar"))
             .forEach(p -> cp.add(p.toAbsolutePath().toString()));
        
        String classpath = String.join(File.pathSeparator, cp);
        
        Path ecj = libDir.resolve("ecj-3.20.0.jar");
        
        List<String> cmd = new ArrayList<>();
        cmd.add("java");
        cmd.add("-jar");
        cmd.add(ecj.toAbsolutePath().toString());
        cmd.add("-cp");
        cmd.add(classpath);
        cmd.add("-d");
        cmd.add(classesDir.toAbsolutePath().toString());
        cmd.add("-source");
        cmd.add("1.8");
        cmd.add("-target");
        cmd.add("1.8");
        cmd.add("-encoding");
        cmd.add("UTF-8");
        cmd.addAll(files);
        
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(projectDir.toFile());
        pb.redirectErrorStream(true);
        
        Process p = pb.start();
        BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()));
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.contains("ERROR") || line.contains("error")) {
                System.out.println("  " + line);
            }
        }
        p.waitFor();
        
        if (p.exitValue() != 0) {
            throw new RuntimeException("编译失败，退出码: " + p.exitValue());
        }
        System.out.println("  编译成功!");
    }
    
    private static void copyResources() throws Exception {
        Path resourcesDir = projectDir.resolve("src/main/resources");
        if (Files.exists(resourcesDir)) {
            Files.walk(resourcesDir).forEach(source -> {
                try {
                    if (Files.isRegularFile(source)) {
                        Path relative = resourcesDir.relativize(source);
                        Path target = classesDir.resolve(relative);
                        Files.createDirectories(target.getParent());
                        Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
                    }
                } catch (IOException e) {
                    e.printStackTrace();
                }
            });
        }
        System.out.println("  资源复制完成!");
    }
    
    private static void createExecutableJar() throws Exception {
        Path jarPath = buildDir.resolve("device-command-confirmation-api-1.0.0.jar");
        Files.deleteIfExists(jarPath);
        
        Manifest manifest = new Manifest();
        manifest.getMainAttributes().put(Attributes.Name.MANIFEST_VERSION, "1.0");
        manifest.getMainAttributes().put(Attributes.Name.MAIN_CLASS, "org.springframework.boot.loader.JarLauncher");
        manifest.getMainAttributes().put(new Attributes.Name("Start-Class"), "com.devicecommand.DeviceCommandApplication");
        manifest.getMainAttributes().put(new Attributes.Name("Spring-Boot-Classes"), "BOOT-INF/classes/");
        manifest.getMainAttributes().put(new Attributes.Name("Spring-Boot-Lib"), "BOOT-INF/lib/");
        manifest.getMainAttributes().put(new Attributes.Name("Spring-Boot-Version"), SPRING_BOOT_VERSION);
        
        try (JarOutputStream jar = new JarOutputStream(new FileOutputStream(jarPath.toFile()), manifest)) {
            addJarToJar(jar, libDir.resolve("spring-boot-loader.jar"), "");
            
            Files.walk(classesDir).forEach(path -> {
                try {
                    if (Files.isRegularFile(path)) {
                        String entryName = "BOOT-INF/classes/" + classesDir.relativize(path).toString().replace("\\", "/");
                        jar.putNextEntry(new JarEntry(entryName));
                        Files.copy(path, jar);
                        jar.closeEntry();
                    }
                } catch (IOException e) {}
            });
            
            Files.list(libDir).filter(p -> p.toString().endsWith(".jar")).forEach(lib -> {
                try {
                    String entryName = "BOOT-INF/lib/" + lib.getFileName().toString();
                    jar.putNextEntry(new JarEntry(entryName));
                    Files.copy(lib, jar);
                    jar.closeEntry();
                } catch (IOException e) {}
            });
        }
        
        System.out.println("  JAR 包大小: " + (Files.size(jarPath) / 1024 / 1024) + " MB");
    }
    
    private static void addJarToJar(JarOutputStream target, Path jar, String prefix) throws Exception {
        try (JarInputStream jis = new JarInputStream(new FileInputStream(jar.toFile()))) {
            JarEntry entry;
            while ((entry = jis.getNextJarEntry()) != null) {
                if (!entry.isDirectory()) {
                    target.putNextEntry(new JarEntry(prefix + entry.getName()));
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = jis.read(buf)) > 0) {
                        target.write(buf, 0, n);
                    }
                    target.closeEntry();
                }
            }
        }
    }
}
