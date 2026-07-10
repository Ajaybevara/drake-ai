# Drake AI Deployment Guide

This project now has two production deployment targets:

- AWS first: `docker-compose.aws.yml`
- Local server later: `docker-compose.local-server.yml`

Both targets run the same application stack:

- Nginx reverse proxy
- React frontend
- FastAPI backend
- PostgreSQL database
- Redis
- MinIO object storage

## Default Admin Login

```text
Username: Drake6105
Password: Drake123@
```

## AWS Deployment

Use this when deploying to an AWS EC2 server.

1. Install Docker and Docker Compose on the EC2 instance.
2. Open inbound ports in the EC2 security group:
   - `80` for HTTP
   - `443` later if you add TLS
   - SSH only from your IP
3. Copy the project to the EC2 instance.
4. Create the AWS environment file:

```bash
cp .env.aws.example .env.aws
```

5. Edit `.env.aws`:

```text
POSTGRES_PASSWORD=your-strong-postgres-password
SECRET_KEY=your-long-random-jwt-secret
MINIO_SECRET_KEY=your-strong-minio-password
PUBLIC_ORIGIN=https://your-domain.example.com
CORS_ORIGINS=["https://your-domain.example.com","http://your-ec2-public-dns"]
VITE_API_URL=/
```

6. Start AWS deployment:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml up -d --build
```

On Windows PowerShell:

```powershell
.\scripts\deploy-aws.ps1
```

7. Check status:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml ps
docker compose --env-file .env.aws -f docker-compose.aws.yml logs -f backend
```

The app will be available at:

```text
http://your-ec2-public-dns
```

### AWS RDS Option

By default, `docker-compose.aws.yml` runs PostgreSQL inside Docker on the EC2 host.

If you later use AWS RDS, set `DATABASE_URL` in `.env.aws`:

```text
DATABASE_URL=postgresql://drakeai:your-password@your-rds-endpoint:5432/drakeai
```

The backend will use RDS without code changes.

## Local Server Deployment

Use this when moving from AWS to an office/local server.

1. Install Docker and Docker Compose on the local server.
2. Copy the project to the local server.
3. Create the local server environment file:

```bash
cp .env.local-server.example .env.local-server
```

4. Edit `.env.local-server`:

```text
POSTGRES_PASSWORD=your-local-postgres-password
SECRET_KEY=your-local-server-jwt-secret
MINIO_SECRET_KEY=your-local-minio-password
LOCAL_SERVER_ORIGIN=http://192.168.1.100
CORS_ORIGINS=["http://192.168.1.100","http://localhost","http://127.0.0.1"]
VITE_API_URL=/
```

5. Start local server deployment:

```bash
docker compose --env-file .env.local-server -f docker-compose.local-server.yml up -d --build
```

On Windows PowerShell:

```powershell
.\scripts\deploy-local-server.ps1
```

The app will be available at:

```text
http://192.168.1.100
```

Replace `192.168.1.100` with the actual local server IP address.

## Database Migration and Seed

Both AWS and local-server compose files run this automatically when backend starts:

```bash
alembic upgrade head
python -c 'from app.core.seed import seed_db; seed_db()'
```

This creates/updates tables and ensures the admin user exists.

## Backup PostgreSQL

AWS:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml exec postgres pg_dump -U drakeai drakeai > drakeai_backup.sql
```

Local server:

```bash
docker compose --env-file .env.local-server -f docker-compose.local-server.yml exec postgres pg_dump -U drakeai drakeai > drakeai_backup.sql
```

## Restore PostgreSQL

```bash
docker compose --env-file .env.local-server -f docker-compose.local-server.yml exec -T postgres psql -U drakeai drakeai < drakeai_backup.sql
```

Use `.env.aws` and `docker-compose.aws.yml` instead when restoring on AWS.

## Health Checks

Frontend:

```text
http://your-host/
```

Backend:

```text
http://your-host/api/health
```

API docs:

```text
http://your-host/docs
```

## Stop / Restart

AWS:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml restart
docker compose --env-file .env.aws -f docker-compose.aws.yml down
```

Local server:

```bash
docker compose --env-file .env.local-server -f docker-compose.local-server.yml restart
docker compose --env-file .env.local-server -f docker-compose.local-server.yml down
```

## Production Notes

- Use HTTPS before exposing real users publicly.
- Keep `.env.aws` and `.env.local-server` private.
- Commit only `.env.example`, `.env.aws.example`, and `.env.local-server.example`.
- Use long random values for `SECRET_KEY`, `POSTGRES_PASSWORD`, and `MINIO_SECRET_KEY`.
- Restrict AWS security group access to only required ports.
