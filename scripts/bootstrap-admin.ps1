param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Email
)

$projectDirectory = Split-Path -Parent $PSScriptRoot
$bunCommand = Get-Command bun -ErrorAction SilentlyContinue
$bunPath = if ($bunCommand) { $bunCommand.Source } else { $null }

if (-not $bunPath) {
    $wingetBunDirectory = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64'
    $installedBun = Join-Path $wingetBunDirectory 'bun.exe'
    if (Test-Path -LiteralPath $installedBun) {
        $bunPath = $installedBun
    }
}

if (-not $bunPath) {
    throw 'Bun was not found. Install Bun or add it to PATH, then rerun this script.'
}

$securePassword = Read-Host 'Enter a unique administrator password (at least 16 characters)' -AsSecureString
$passwordPointer = [IntPtr]::Zero

try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:BOOTSTRAP_ADMIN_EMAIL = $Email
    $env:BOOTSTRAP_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

    Push-Location $projectDirectory
    try {
        & $bunPath run bootstrap-admin
        if ($LASTEXITCODE -ne 0) {
            throw "Administrator bootstrap failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $securePassword.Dispose()
}
