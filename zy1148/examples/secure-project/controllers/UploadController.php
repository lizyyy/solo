<?php

namespace App\Controllers;

use finfo;

class UploadController
{
    private const ALLOWED_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
    ];

    private const ALLOWED_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'
    ];

    private const MAX_FILE_SIZE = 5 * 1024 * 1024;

    private string $uploadDir;

    public function __construct(string $uploadDir)
    {
        $this->uploadDir = rtrim($uploadDir, '/') . '/';
    }

    public function upload(array $file): array
    {
        if (!isset($file['tmp_name'], $file['name'], $file['size'], $file['error'])) {
            throw new \InvalidArgumentException('Invalid file upload');
        }

        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('File upload error: ' . $file['error']);
        }

        if ($file['size'] > self::MAX_FILE_SIZE) {
            throw new \RuntimeException('File too large. Maximum size is 5MB');
        }

        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, self::ALLOWED_EXTENSIONS, true)) {
            throw new \RuntimeException('File type not allowed');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        
        if (!in_array($mimeType, self::ALLOWED_TYPES, true)) {
            throw new \RuntimeException('File MIME type not allowed');
        }

        if ($extension === 'jpg' || $extension === 'jpeg') {
            if (!@imagecreatefromjpeg($file['tmp_name'])) {
                throw new \RuntimeException('Invalid JPEG image');
            }
        } elseif ($extension === 'png') {
            if (!@imagecreatefrompng($file['tmp_name'])) {
                throw new \RuntimeException('Invalid PNG image');
            }
        }

        $fileName = bin2hex(random_bytes(16)) . '.' . $extension;
        $filePath = $this->uploadDir . $fileName;

        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            throw new \RuntimeException('Failed to move uploaded file');
        }

        chmod($filePath, 0644);

        return [
            'filename' => $fileName,
            'path' => $filePath,
            'size' => $file['size'],
            'mime_type' => $mimeType,
        ];
    }

    public function uploadWithValidation(array $file): array
    {
        return $this->upload($file);
    }
}
