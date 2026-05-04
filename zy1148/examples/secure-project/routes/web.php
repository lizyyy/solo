<?php

use App\Controllers\UserController;
use App\Controllers\ProductController;
use App\Controllers\UploadController;
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\AuthMiddleware;
use App\Http\Middleware\CsrfMiddleware;

Route::middleware([CsrfMiddleware::class])->group(function () {
    Route::get('/users/{id}', [UserController::class, 'show'])
        ->where('id', '[0-9]+');

    Route::post('/users', [UserController::class, 'store'])
        ->middleware(AuthMiddleware::class);

    Route::get('/products/search', [ProductController::class, 'search']);

    Route::post('/upload', [UploadController::class, 'upload'])
        ->middleware(AuthMiddleware::class);
});

Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', 'AdminController@dashboard');
    Route::get('/users', 'AdminController@users');
});

Route::post('/api/v1/webhook', 'WebhookController@handle')
    ->middleware('api.auth');
