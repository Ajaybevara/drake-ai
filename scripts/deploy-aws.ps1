param(
  [string]$EnvFile = ".env.aws"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $EnvFile)) {
  throw "Missing $EnvFile. Copy .env.aws.example to $EnvFile and fill production values first."
}

docker compose --env-file $EnvFile -f docker-compose.aws.yml up -d --build
docker compose --env-file $EnvFile -f docker-compose.aws.yml ps
