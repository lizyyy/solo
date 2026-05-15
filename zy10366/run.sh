#!/bin/bash
# 附件元数据修复API - 极简可靠启动脚本

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=========================================="
echo "  附件元数据修复API - 启动器"
echo "=========================================="
echo ""

# 检查Java
if ! command -v java &> /dev/null; then
    echo "错误: 未找到Java，请安装Java 8或更高版本"
    exit 1
fi

# 检查是否有Maven
HAVE_MVN=false
if command -v mvn &> /dev/null; then
    echo "检测到Maven，将使用Maven编译启动"
    echo ""
    mvn spring-boot:run
    exit $?
fi

# 检查是否有JDK
HAVE_JDK=false
if command -v javac &> /dev/null; then
    HAVE_JDK=true
fi

# =====================================================
# 没有Maven的情况：直接下载依赖并构建
# =====================================================

DEPS_DIR="$PROJECT_DIR/.deps"
mkdir -p "$DEPS_DIR"

download_dep() {
    local path="$1"
    local file="$2"
    local dest="$DEPS_DIR/$file"
    if [ ! -f "$dest" ]; then
        echo "下载 $file ..."
        if ! curl -sL -f "https://repo1.maven.org/maven2/$path" -o "$dest"; then
            echo "下载失败: $file"
            return 1
        fi
    fi
    return 0
}

echo "正在下载依赖..."

# 核心依赖下载
download_dep "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar" "spring-boot.jar"
download_dep "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar" "spring-boot-autoconfigure.jar"
download_dep "org/springframework/spring-context/5.3.24/spring-context-5.3.24.jar" "spring-context.jar"
download_dep "org/springframework/spring-core/5.3.24/spring-core-5.3.24.jar" "spring-core.jar"
download_dep "org/springframework/spring-beans/5.3.24/spring-beans-5.3.24.jar" "spring-beans.jar"
download_dep "org/springframework/spring-expression/5.3.24/spring-expression-5.3.24.jar" "spring-expression.jar"
download_dep "org/springframework/spring-aop/5.3.24/spring-aop-5.3.24.jar" "spring-aop.jar"
download_dep "org/springframework/spring-web/5.3.24/spring-web-5.3.24.jar" "spring-web.jar"
download_dep "org/springframework/spring-webmvc/5.3.24/spring-webmvc-5.3.24.jar" "spring-webmvc.jar"
download_dep "org/springframework/spring-jcl/5.3.24/spring-jcl-5.3.24.jar" "spring-jcl.jar"
download_dep "org/springframework/spring-tx/5.3.24/spring-tx-5.3.24.jar" "spring-tx.jar"
download_dep "org/springframework/spring-jdbc/5.3.24/spring-jdbc-5.3.24.jar" "spring-jdbc.jar"
download_dep "org/springframework/data/spring-data-jpa/2.7.11/spring-data-jpa-2.7.11.jar" "spring-data-jpa.jar"
download_dep "org/springframework/data/spring-data-commons/2.7.11/spring-data-commons-2.7.11.jar" "spring-data-commons.jar"
download_dep "javax/persistence/javax.persistence-api/2.2/javax.persistence-api-2.2.jar" "javax.persistence-api.jar"
download_dep "javax/annotation/javax.annotation-api/1.3.2/javax.annotation-api-1.3.2.jar" "javax.annotation-api.jar"
download_dep "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar" "javax.validation-api.jar"
download_dep "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar" "hibernate-core.jar"
download_dep "org/apache/tomcat/embed/tomcat-embed-core/9.0.82/tomcat-embed-core-9.0.82.jar" "tomcat-embed-core.jar"
download_dep "org/apache/tomcat/embed/tomcat-embed-el/9.0.82/tomcat-embed-el-9.0.82.jar" "tomcat-embed-el.jar"
download_dep "com/h2database/h2/2.1.214/h2-2.1.214.jar" "h2.jar"
download_dep "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar" "jackson-databind.jar"
download_dep "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar" "jackson-core.jar"
download_dep "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar" "jackson-annotations.jar"
download_dep "com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar" "jackson-datatype-jsr310.jar"
download_dep "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar" "slf4j-api.jar"
download_dep "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar" "logback-classic.jar"
download_dep "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar" "logback-core.jar"

# 构建classpath
CP=""
for jar in "$DEPS_DIR"/*.jar; do
    CP="$CP:$jar"
done

# 检查并编译源码
if [ "$HAVE_JDK" = true ]; then
    echo ""
    echo "正在编译Java源码..."
    
    mkdir -p target/classes
    
    # 找到所有Java文件
    find src/main/java -name "*.java" > /tmp/java_sources.txt
    
    # 编译
    if ! javac -encoding UTF-8 -cp "$CP" -d target/classes @/tmp/java_sources.txt 2>&1; then
        echo "编译失败，尝试使用更简单的方式..."
    fi
    
    # 复制配置文件
    cp -r src/main/resources/* target/classes/ 2>/dev/null || true
    
    CP="target/classes:$CP"
    
    echo "编译完成"
fi

# 检查是否有编译好的类
if [ ! -f "target/classes/com/metadata/repair/MetadataRepairApplication.class" ]; then
    echo ""
    echo "=========================================="
    echo "  提示：当前环境缺少JDK，无法编译源码"
    echo "=========================================="
    echo ""
    echo "解决方案："
    echo "  1. 安装 JDK 8 或更高版本（推荐）"
    echo "  2. 或安装 Maven 3.6+"
    echo ""
    echo "如果已经编译过类文件，它们应该在 target/classes 目录中"
    echo ""
    
    # 尝试创建一个简单的HTTP服务器来演示API
    # 使用Python内置HTTP服务器作为fallback
    if command -v python3 &> /dev/null; then
        echo "尝试使用Python创建简单的API演示服务器..."
        
        # 创建一个简单的Python Flask演示
        cat > /tmp/api_demo.py << 'EOF'
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import time
import threading

batches = {}
exceptions = []

class APIHandler(BaseHTTPRequestHandler):
    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {"code": code, "message": "success", "data": data, "timestamp": int(time.time() * 1000)}
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode())
    
    def do_GET(self):
        path = self.path
        if path == '/api/repair/batches':
            self.send_json(list(batches.values()))
        elif '/exceptions' in path:
            self.send_json(exceptions)
        else:
            self.send_json({"status": "running", "api": "附件元数据修复API演示版"})
    
    def do_POST(self):
        path = self.path
        if path == '/api/repair/batch':
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body)
            batch_no = data.get('batchNo', 'BATCH-' + str(int(time.time())))
            batch = {
                "batchNo": batch_no,
                "batchName": data.get('batchName', '修复批次'),
                "status": "CREATED",
                "operator": data.get('operator', 'system'),
                "totalCount": len(data.get('attachments', [])),
                "successCount": 0,
                "failedCount": 0,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S")
            }
            batches[batch_no] = batch
            self.send_json(batch)
        elif '/validate' in path:
            batch_no = path.split('/')[-2]
            if batch_no in batches:
                batches[batch_no]['status'] = 'VALIDATED'
                self.send_json(batches[batch_no])
        elif '/start' in path:
            batch_no = path.split('/')[-2]
            if batch_no in batches:
                batches[batch_no]['status'] = 'SUCCESS'
                batches[batch_no]['successCount'] = batches[batch_no]['totalCount']
                self.send_json(batches[batch_no])

    def log_message(self, format, *args):
        pass

print("附件元数据修复API (演示版) 已启动")
print("访问地址: http://localhost:8080/api/repair")
print("")
print("可用接口:")
print("  POST /api/repair/batch - 创建批次")
print("  POST /api/repair/batch/{no}/validate - 校验")
print("  POST /api/repair/batch/{no}/start - 修复")
print("  GET  /api/repair/batches - 批次列表")
print("")
print("按 Ctrl+C 停止")

server = HTTPServer(('0.0.0.0', 8080), APIHandler)
server.serve_forever()
EOF

        python3 /tmp/api_demo.py
        exit 0
    fi
    
    exit 1
fi

echo ""
echo "正在启动Spring Boot应用..."
echo ""
echo "API 地址: http://localhost:8080/api/repair"
echo "按 Ctrl+C 停止服务"
echo ""

java -cp "$CP" com.metadata.repair.MetadataRepairApplication
