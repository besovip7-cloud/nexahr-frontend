param(
    [int]$Port = 3001
)

Write-Host "Checking port $Port..."

$connections = netstat -ano | findstr :$Port

if ($connections) {
    $pids = $connections | ForEach-Object {
        ($_ -split "\s+")[-1]
    } | Select-Object -Unique

    foreach ($pid in $pids) {
        if ($pid -and $pid -ne "0") {
            Write-Host "Killing PID $pid on port $Port..."
            taskkill /PID $pid /F | Out-Null
        }
    }

    Write-Host "Port $Port is now free."
} else {
    Write-Host "Port $Port is already free."
}