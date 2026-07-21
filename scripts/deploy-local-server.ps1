param(
  [string]$EnvFile = "env/deployment/.env.local-server"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $EnvFile)) {
  throw "Missing $EnvFile. Copy env/deployment/.env.local-server.example to $EnvFile and set your local server IP/hostname first."
}

docker compose --env-file $EnvFile -f docker-compose.local-server.yml up -d --build
docker compose --env-file $EnvFile -f docker-compose.local-server.yml ps
