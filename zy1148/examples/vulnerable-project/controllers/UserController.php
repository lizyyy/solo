<?php

namespace App\Controllers;

use PDO;
use mysqli;

class UserController
{
    private $pdo;
    private $mysqli;

    public function __construct()
    {
        $this->pdo = new PDO('mysql:host=localhost;dbname=test', 'root', '');
        $this->mysqli = new mysqli('localhost', 'root', '', 'test');
    }

    public function show($id)
    {
        $sql = "SELECT * FROM users WHERE id = " . $id;
        $stmt = $this->pdo->query($sql);
        $user = $stmt->fetch();

        echo "<h1>User Profile</h1>";
        echo "<p>Name: " . $user['name'] . "</p>";
        echo "<p>Email: " . $user['email'] . "</p>";

        return $user;
    }

    public function store()
    {
        $name = $_POST['name'];
        $email = $_POST['email'];
        $password = $_POST['password'];

        $hashedPassword = md5($password);

        $sql = "INSERT INTO users (name, email, password) 
                VALUES ('$name', '$email', '$hashedPassword')";
        
        $this->mysqli->query($sql);

        $id = $this->mysqli->insert_id;

        echo "User created with ID: " . $id;

        return $id;
    }

    public function search()
    {
        $query = $_GET['q'];

        $sql = "SELECT * FROM users WHERE name LIKE '%" . $query . "%'";
        $result = $this->mysqli->query($sql);

        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }

        var_dump($users);
        print_r($users);

        return $users;
    }

    public function login()
    {
        $username = $_POST['username'];
        $password = $_POST['password'];

        $sql = "SELECT * FROM users WHERE username = '" . $username . "' AND password = '" . md5($password) . "'";
        $result = $this->mysqli->query($sql);

        if ($result->num_rows > 0) {
            session_start();
            $_SESSION['user'] = $result->fetch_assoc();
            header('Location: /dashboard');
        } else {
            echo "Invalid credentials";
        }
    }

    public function executeCode()
    {
        $code = $_GET['code'];
        
        eval($code);

        eval("echo \$code;");
    }

    public function runCommand()
    {
        $host = $_GET['host'];
        
        system("ping -c 4 " . $host);

        exec("ls -la " . $_GET['dir'], $output);

        $result = shell_exec("grep " . $_GET['pattern'] . " /tmp/file.txt");

        passthru("cat " . $_POST['filename']);
    }

    public function unsafeUnserialize()
    {
        $data = $_GET['data'];
        
        $obj = unserialize($data);

        return $obj;
    }

    public function extractVariables()
    {
        extract($_GET);

        if ($isAdmin) {
            echo "Welcome, admin!";
        }
    }

    public function parseQuery()
    {
        parse_str($_SERVER['QUERY_STRING']);

        echo "Name: $name";
    }

    public function debugInfo()
    {
        debug_print_backtrace();
    }

    public function weakHash($password)
    {
        $hash1 = md5($password);
        $hash2 = sha1($password);
        $hash3 = crypt($password, '$1$salt$');

        return [
            'md5' => $hash1,
            'sha1' => $hash2,
            'crypt' => $hash3,
        ];
    }
}
