import java.net.*;
import java.io.*;
import java.nio.channels.*;
import java.util.Properties;

public class MavenWrapperDownloader {

    private static final String WRAPPER_VERSION = "3.2.0";
    private static final String DEFAULT_MAVEN_REPO = "https://repo.maven.apache.org/maven2";
    private static final String WRAPPER_JAR = "/org/apache/maven/wrapper/maven-wrapper/" + WRAPPER_VERSION + "/maven-wrapper-" + WRAPPER_VERSION + ".jar";

    public static void main(String args[]) {
        if (args.length != 2) {
            System.err.println(" - Downloader requires 2 params: <url> <target>");
            System.exit(1);
        }

        String url = args[0];
        String target = args[1];

        try {
            downloadFileFromURL(url, target);
        } catch (Exception e) {
            System.err.println(" - Error downloading: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void downloadFileFromURL(String urlString, String destination) throws Exception {
        if (System.getenv("MVNW_USERNAME") != null && System.getenv("MVNW_PASSWORD") != null) {
            String username = System.getenv("MVNW_USERNAME");
            char[] password = System.getenv("MVNW_PASSWORD").toCharArray();
            Authenticator.setDefault(new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(username, password);
                }
            });
        }
        URL website = new URL(urlString);
        ReadableByteChannel rbc;
        try {
            rbc = Channels.newChannel(website.openStream());
        } catch (Exception e) {
            String baseUrl = System.getenv("MVNW_REPOURL");
            if (baseUrl == null) {
                baseUrl = DEFAULT_MAVEN_REPO;
            }
            System.out.println(" - Downloading from alternative: " + baseUrl + WRAPPER_JAR);
            website = new URL(baseUrl + WRAPPER_JAR);
            rbc = Channels.newChannel(website.openStream());
        }
        FileOutputStream fos = new FileOutputStream(destination);
        fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);
        fos.close();
        rbc.close();
        System.out.println(" - Download complete");
    }
}
