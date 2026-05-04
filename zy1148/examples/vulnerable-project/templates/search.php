<!DOCTYPE html>
<html>
<head>
    <title>Search Results</title>
</head>
<body>
    <h1>Search Results</h1>
    
    <div class="query">
        You searched for: <?php echo $_GET['q']; ?>
    </div>

    <div class="results">
        <?php
        foreach ($results as $result) {
            echo "<div>" . $result['title'] . "</div>";
            echo "<div>" . $result['description'] . "</div>";
        }
        ?>
    </div>

    <div class="user-input">
        <?php print $_POST['comment']; ?>
    </div>

    <div class="short-tag">
        <?= $_GET['message'] ?>
    </div>

    <div class="decoded">
        <?php
        $safeContent = htmlspecialchars($content);
        echo htmlspecialchars_decode($safeContent);
        ?>
    </div>
</body>
</html>
