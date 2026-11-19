param(
    [Parameter(Mandatory = $true)][string]$Config,
    [string]$Terraform = 'terraform',
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$configPath = (Resolve-Path -LiteralPath $Config).Path
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$infra = Join-Path $project 'infra'
$library = Join-Path $project '.private/library.json'
if (-not (Test-Path -LiteralPath $library -PathType Leaf)) { throw 'Importa primero el catálogo privado.' }
if ([IO.Path]::IsPathRooted($Terraform) -or $Terraform.Contains('/') -or $Terraform.Contains('\')) {
    $Terraform = (Resolve-Path -LiteralPath $Terraform).Path
}
$account = & aws sts get-caller-identity --region us-east-1 --query Account --output text --no-cli-pager
if ($LASTEXITCODE -ne 0 -or $account -notmatch '^[0-9]{12}$') { throw 'AWS debe confirmar la cuenta de destino.' }
$accountDirectory = (New-Item -Path (Join-Path $project ".private/aws-$account") -ItemType Directory -Force).FullName
$state = Join-Path $accountDirectory 'terraform.tfstate'
$plan = Join-Path $accountDirectory 'infra.tfplan'

function Invoke-Step([string]$Executable, [string[]]$ArgumentList) {
    & $Executable @ArgumentList
    if ($LASTEXITCODE -ne 0) { throw "$Executable terminó con código $LASTEXITCODE." }
}

Push-Location -LiteralPath $project
try {
    $env:ASTRO_TELEMETRY_DISABLED = '1'
    Invoke-Step pnpm @('build')
    Invoke-Step $Terraform @("-chdir=$infra", 'init', '-input=false', '-reconfigure', "-backend-config=path=$state")
    Invoke-Step $Terraform @("-chdir=$infra", 'plan', '-input=false', "-var-file=$configPath", "-out=$plan")
    if ($Apply) {
        Invoke-Step $Terraform @("-chdir=$infra", 'apply', '-input=false', $plan)
        $bucket = & $Terraform "-chdir=$infra" output -raw bucket
        if ($LASTEXITCODE -ne 0) { throw 'Falta el bucket de PlanEstudio.' }
        $distribution = & $Terraform "-chdir=$infra" output -raw distribution
        if ($LASTEXITCODE -ne 0) { throw 'Falta la distribución de PlanEstudio.' }
        Invoke-Step aws @('s3', 'cp', $library, "s3://$bucket/private/library.json", '--content-type', 'application/json', '--only-show-errors')
        Invoke-Step aws @('s3', 'sync', 'dist/_astro', "s3://$bucket/site/PlanEstudio/_astro", '--cache-control', 'public,max-age=31536000,immutable', '--only-show-errors')
        Invoke-Step aws @('s3', 'sync', 'dist', "s3://$bucket/site/PlanEstudio", '--exclude', '_astro/*', '--cache-control', 'public,max-age=60', '--only-show-errors')
        Invoke-Step aws @('cloudfront', 'create-invalidation', '--distribution-id', $distribution, '--paths', '/PlanEstudio', '/PlanEstudio/*', '--query', 'Invalidation.Id', '--output', 'text')
    }
}
finally {
    Pop-Location
}
