<?php

require_once __DIR__ . '/../vendor/autoload.php';

use CacheAnalyzer\Controller\ImportController;
use CacheAnalyzer\Controller\AnalysisController;
use CacheAnalyzer\Controller\SimulationController;
use CacheAnalyzer\Controller\ExportController;
use CacheAnalyzer\Storage\Database;

header('Content-Type: application/json');

try {
    $database = new Database(__DIR__ . '/../data/cache_analyzer.db');
    
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    
    $path = preg_replace('#^/api#', '', $path);
    
    switch ($path) {
        case '/import/cache-events':
            if ($method === 'POST') {
                $controller = new ImportController($database);
                $controller->importCacheEvents();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/import/routes':
            if ($method === 'POST') {
                $controller = new ImportController($database);
                $controller->importRoutes();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/import/cache-config':
            if ($method === 'POST') {
                $controller = new ImportController($database);
                $controller->importCacheConfig();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/import/slow-queries':
            if ($method === 'POST') {
                $controller = new ImportController($database);
                $controller->importSlowQueries();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/import/all':
            if ($method === 'POST') {
                $controller = new ImportController($database);
                $controller->importAllFromFiles();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/import/clear':
            if ($method === 'POST') {
                $controller = new ImportController($database);
                $controller->clearAllData();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/import/status':
            if ($method === 'GET') {
                $controller = new ImportController($database);
                $controller->getImportStatus();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/analysis/hit-rate':
            if ($method === 'GET') {
                $controller = new AnalysisController($database);
                $controller->getHitRateAnalysis();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/analysis/performance':
            if ($method === 'GET') {
                $controller = new AnalysisController($database);
                $controller->getPerformanceAnalysis();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/analysis/hot-keys':
            if ($method === 'GET') {
                $controller = new AnalysisController($database);
                $controller->getHotKeysAnalysis();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/analysis/ttl-distribution':
            if ($method === 'GET') {
                $controller = new AnalysisController($database);
                $controller->getTtlDistributionAnalysis();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/analysis/risks':
            if ($method === 'GET') {
                $controller = new AnalysisController($database);
                $controller->getRiskAnalysis();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/analysis/full':
            if ($method === 'POST') {
                $controller = new AnalysisController($database);
                $controller->runFullAnalysis();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/simulation/optimization':
            if ($method === 'POST') {
                $controller = new SimulationController($database);
                $controller->simulateOptimization();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/simulation/compare':
            if ($method === 'POST') {
                $controller = new SimulationController($database);
                $controller->compareStrategies();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/simulation/strategies':
            if ($method === 'GET') {
                $controller = new SimulationController($database);
                $controller->getAvailableStrategies();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/simulation/recommended':
            if ($method === 'POST') {
                $controller = new SimulationController($database);
                $controller->runRecommendedSimulation();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/export/report/markdown':
            if ($method === 'GET') {
                $controller = new ExportController($database);
                $controller->exportMarkdown();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/export/report/json':
            if ($method === 'GET') {
                $controller = new ExportController($database);
                $controller->exportJson();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        case '/export/report/csv':
            if ($method === 'GET') {
                $controller = new ExportController($database);
                $controller->exportCsv();
            } else {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
