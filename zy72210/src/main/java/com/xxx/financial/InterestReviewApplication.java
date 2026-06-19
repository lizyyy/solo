package com.xxx.financial;

import com.xxx.financial.cli.InterestReviewCli;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;

@SpringBootApplication(scanBasePackages = "com.xxx.financial", exclude = {DataSourceAutoConfiguration.class})
public class InterestReviewApplication {

    public static void main(String[] args) {
        if (args.length > 0 && isCliMode(args[0])) {
            InterestReviewCli.main(args);
            return;
        }
        new SpringApplicationBuilder(InterestReviewApplication.class)
                .web(WebApplicationType.SERVLET)
                .registerShutdownHook(true)
                .run(args);
    }

    private static boolean isCliMode(String firstArg) {
        switch (firstArg.toLowerCase()) {
            case "demo":
            case "normal":
            case "pinyin":
            case "conflict":
            case "all":
            case "interactive":
                return true;
            default:
                return false;
        }
    }
}
                return false;
        }
    }
}
