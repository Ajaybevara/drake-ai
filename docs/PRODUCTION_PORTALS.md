# Production Portal Deployment

This project builds two separate production dashboards from the same codebase:

- User portal: `VITE_PORTAL_MODE=user`
- Admin portal: `VITE_PORTAL_MODE=admin`

Both portals use the same backend API and the same PostgreSQL database. Users created in the admin portal can sign in immediately through the user portal with the credentials and module access assigned by admin.

## Docker Compose Deployment

### Full Stack With Both Dashboards

Set production secrets in `.env`:

```env
POSTGRES_PASSWORD=change-this-postgres-password
SECRET_KEY=change-this-to-a-long-random-secret
ADMIN_USERNAME=Drake6105
ADMIN_PASSWORD=change-this-admin-password
ADMIN_FULL_NAME=Admin
MINIO_ACCESS_KEY=drakeai_minio
MINIO_SECRET_KEY=change-this-minio-password
ANTHROPIC_API_KEY=
```

Start production:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Open:

- User dashboard: `http://your-server/`
- Admin dashboard: `http://your-server:8080/`

### Admin Dashboard Only

Use this when the backend/database already exists and you want to deploy the admin dashboard separately.

Set `.env.admin`:

```env
VITE_API_URL=https://api.your-domain.com
ADMIN_DASHBOARD_PORT=8080
```

Start admin dashboard:

```bash
docker compose --env-file .env.admin -f docker-compose.admin.yml up --build -d
```

The admin dashboard contains only:

- `/admin-login`
- `/admin`

Every other route redirects to `/admin-login`.

### User Dashboard Only

Use this when the backend/database already exists and you want to deploy the user dashboard separately.

Set `.env.user`:

```env
VITE_API_URL=https://api.your-domain.com
USER_DASHBOARD_PORT=80
```

Start user dashboard:

```bash
docker compose --env-file .env.user -f docker-compose.user.yml up --build -d
```

The user dashboard contains user login and assigned module routes only.

## Access Rules

- The user portal exposes only `/login` and user module routes.
- The admin portal exposes only `/admin-login` and `/admin`.
- Admin-created users are stored in PostgreSQL with hashed passwords.
- User module access is stored in the `users.access_modules` column.
- Direct URL changes to unassigned modules redirect users back to `/login`.
- User login/logout history is stored in the `user_activities` table.
- Admin can filter activity by user and inspect daily login/logout timings.

## Database

Production startup runs:

```bash
alembic upgrade head
```

The required production tables include:

- `users`
- `user_activities`
- existing project/well/result tables

## Build Modes

Manual user build:

```bash
VITE_PORTAL_MODE=user npm run build
```

Manual admin build:

```bash
VITE_PORTAL_MODE=admin npm run build
```

Docker admin image build:

```bash
docker build -f frontend/Dockerfile.admin --build-arg VITE_API_URL=https://api.your-domain.com -t drakeai-admin-dashboard ./frontend
```

Docker user image build:

```bash
docker build -f frontend/Dockerfile.user --build-arg VITE_API_URL=https://api.your-domain.com -t drakeai-user-dashboard ./frontend
```
