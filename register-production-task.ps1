$ErrorActionPreference = 'Stop'
$script = 'C:\customserviciosrs\ceiba-fleet\start-production.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $script + '"') -WorkingDirectory 'C:\customserviciosrs\ceiba-fleet'
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
Register-ScheduledTask -TaskName 'CSRS-Fleet-Production-3010' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Entrega de APK CSRS X y Ceiba Fleet en modo produccion' -Force | Out-Null
Write-Output 'TASK_REGISTERED'