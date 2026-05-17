module.exports = {
  rules: {
    userAgents: {
      knownBots: [
        'Googlebot', 'Bingbot', 'Slurp', 'DuckDuckBot', 'Baiduspider',
        'YandexBot', 'Sogou', 'Exabot', 'facebot', 'ia_archiver',
        'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'rogerbot',
        'SEOkicks', 'SearchmetricsBot', 'spbot', 'zmeu', 'BLEXBot',
        'Ezooms', 'Yeti', 'NaverBot', 'Wotbox', 'YahooCacheSystem',
        'CCBot', 'CheckMarkNetwork', 'Dominator', 'Genieo', 'LinkpadBot',
        'MegaIndex.ru', 'Nutch', 'Proximic', 'Scrapy', 'SiteExplorer',
        'TurnitinBot', 'VoilaBot', 'Wget', 'curl', 'python-requests',
        'Python-urllib', 'Java/', 'php/', 'Go-http-client', 'HttpClient',
        'libwww-perl', 'Apache-HttpClient', 'okhttp', 'PostmanRuntime',
        'Insomnia', 'Swagger-Codegen', 'Faraday', 'Typhoeus', 'RestClient',
        'HTTPie', 'lwp-trivial', 'BBBike', 'W3C-checklink', 'W3C_Validator',
        'Jigsaw', 'FeedValidator', 'Feedfetcher', 'FeedBurner', 'FeedValidator',
        'AppEngine-Google', 'Google-Ads', 'Googlebot-Image', 'Googlebot-Video',
        'Googlebot-News', 'Mediapartners-Google', 'AdsBot-Google',
        'facebookexternalhit', 'Facebot', 'Twitterbot', 'Pinterestbot',
        'LinkedInBot', 'Slackbot', 'Discordbot', 'TelegramBot',
        'SkypeUriPreview', 'WhatsApp', 'Applebot', 'bingbot', 'MSN'
      ],
      suspiciousPatterns: [
        /bot/i, /crawl/i, /spider/i, /scraper/i, /crawler/i,
        /scan/i, /probe/i, /test/i, /check/i, /monitor/i,
        /agent/i, /script/i, /automate/i, /headless/i,
        /phantom/i, /selenium/i, /webdriver/i, /puppeteer/i,
        /\d{5,}/, /^[^ ]{50,}$/, /^Mozilla\/5\.0\s+$/
      ]
    },

    ips: {
      knownBadIPs: [],
      privateRanges: [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^127\./,
        /^::1$/,
        /^fc00:/,
        /^fe80:/
      ]
    },

    paths: {
      suspiciousPatterns: [
        /\/wp-admin/i, /\/wp-login/i, /\/xmlrpc\.php/i,
        /\/admin/i, /\/backend/i, /\/phpmyadmin/i,
        /\.env/i, /\.git/i, /\.svn/i, /\.hg/i,
        /\/cgi-bin/i, /\.bak/i, /\.sql/i, /\.zip/i,
        /\/etc\//i, /\/proc\//i, /\/system\//i,
        /\/shell/i, /\/exec/i, /\/eval/i,
        /\.\./, /%2e%2e/i, /select.*from/i, /union.*select/i,
        /insert.*into/i, /delete.*from/i, /drop.*table/i
      ],
      scannerPatterns: [
        /\/owa\//i, /Autodiscover/i, /ecp\//i,
        /HNAP1/i, /manager\/html/i, /jmx-console/i,
        /web-console/i, /invoker\/JmxInvoker/i,
        /axis2\/admin/i, /CFIDE/i, /CFIDE\/administrator/i,
        /fckeditor/i, /ckeditor/i, /tinymce/i
      ]
    },

    statusCodes: {
      errorThreshold: 0.5,
      errorCodes: [400, 401, 403, 404, 405, 429, 500, 502, 503]
    },

    frequency: {
      requestThreshold: 100,
      timeWindowMinutes: 5
    },

    headers: {
      missingAccept: true,
      missingAcceptLanguage: true,
      emptyUserAgent: true
    }
  },

  scoring: {
    knownBot: 100,
    suspiciousUA: 30,
    emptyUA: 50,
    suspiciousPath: 20,
    scannerPath: 40,
    privateIP: 10,
    highErrorRate: 40,
    highFrequency: 50,
    missingHeaders: 15,
    botThreshold: 40,
    suspiciousThreshold: 20
  }
};
