FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN addgroup -S paymentguard && adduser -S paymentguard -G paymentguard

COPY --from=builder /app/target/*.jar app.jar

RUN chown -R paymentguard:paymentguard /app
USER paymentguard

EXPOSE 8080

ENV JAVA_OPTS="-Xms512m -Xmx1024m"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
