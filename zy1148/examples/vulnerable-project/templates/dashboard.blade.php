<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
</head>
<body>
    <h1>Dashboard</h1>
    
    <div class="user-content">
        {!! $user->bio !!}
        {!! request('message') !!}
    </div>

    <div class="notifications">
        @foreach($notifications as $notification)
            <div class="notification">
                {!! $notification->message !!}
            </div>
        @endforeach
    </div>

    @php
        $username = $_GET['username'];
        echo "Hello, " . $username;
    @endphp

    <div>
        {{ request('query') }}
    </div>
</body>
</html>
