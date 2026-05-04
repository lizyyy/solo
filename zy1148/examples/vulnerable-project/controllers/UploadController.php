<?php

namespace App\Controllers;

use PDO;

class UploadController
{
    public function upload()
    {
        if (isset($_FILES['file'])) {
            $uploadDir = __DIR__ . '/../public/uploads/';
            
            $fileName = $_FILES['file']['name'];
            $targetPath = $uploadDir . $fileName;

            move_uploaded_file($_FILES['file']['tmp_name'], $targetPath);

            echo "File uploaded: " . $fileName;

            return $targetPath;
        }

        return false;
    }

    public function uploadWithCheck()
    {
        if (isset($_FILES['file'])) {
            $uploadDir = __DIR__ . '/../public/uploads/';
            
            $fileName = $_FILES['file']['name'];
            
            $ext = pathinfo($fileName, PATHINFO_EXTENSION);
            
            if ($ext != 'jpg' && $ext != 'png' && $ext != 'gif') {
                echo "Invalid file type";
                return false;
            }

            $targetPath = $uploadDir . $fileName;
            move_uploaded_file($_FILES['file']['tmp_name'], $targetPath);

            echo "File uploaded: " . $fileName;

            return $targetPath;
        }

        return false;
    }

    public function uploadWithBlacklist()
    {
        if (isset($_FILES['file'])) {
            $uploadDir = __DIR__ . '/../public/uploads/';
            
            $fileName = $_FILES['file']['name'];
            $ext = pathinfo($fileName, PATHINFO_EXTENSION);
            
            $blacklist = ['php', 'php5', 'phtml'];
            
            if (in_array(strtolower($ext), $blacklist)) {
                echo "Invalid file type";
                return false;
            }

            $targetPath = $uploadDir . $fileName;
            move_uploaded_file($_FILES['file']['tmp_name'], $targetPath);

            echo "File uploaded: " . $fileName;

            return $targetPath;
        }

        return false;
    }
}
