<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
</head>
<body>
    <h1>Dashboard</h1>
    
    <div class="user-content">
        {{ $user->bio }}
    </div>

    <div class="notifications">
        @foreach($notifications as $notification)
            <div class="notification">
                {{ $notification->message }}
            </div>
        @endforeach
    </div>

    <div>
        {{ request('query') }}
    </div>

    @csrf
</body>
</html>
