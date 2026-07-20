# Drake AI Production Environment

Use one backend API and one PostgreSQL database for both dashboards.

- Admin dashboard domain: `https://admin.your-domain.com`
- User dashboard domain: `https://user.your-domain.com`
- Backend API domain: `https://api.your-domain.com`

Admin-created credentials are stored in the backend PostgreSQL `users` table. The user's allowed modules are stored in `users.access_modules`. Login/logout history is stored in `user_activities` and is fetched by the admin endpoint `/api/auth/admin/activity`.

Required database tables are already defined by migrations:

- `users`
- `user_activities`
- `projects`
- `wells`
- `well_files`
- `curves`
- `ai_jobs`
- `reports`

Admin module access values stored in `users.access_modules`:

- `log-visualization`
- `missing-log-prediction`
- `ai-facies-classification`
- `ai-formation-tops`
- `ai-parameter-prediction`
- `ai-uncertainty`
- `auto-splicer`
- `seismic-frequency-enhancer`
- `production-intelligence`
- `ccus-screening`
- `geothermal-screening`
- `drake-slm-gpt`
- `drake-ocr`

Important API endpoints:

- User login: `POST /api/auth/login`
- User logout history: `POST /api/auth/logout`
- Admin-created user credentials: `POST /api/auth/admin/users`
- Admin user updates: `PUT /api/auth/admin/users/{user_id}`
- Admin user activity history: `GET /api/auth/admin/activity`
- Drake SLM/GPT status: `GET /api/slm-gpt/status`
- Drake SLM/GPT upload: `POST /api/slm-gpt/workspaces/{workspace_id}/upload`
- Drake SLM/GPT chat: `POST /api/slm-gpt/chat`
- Drake OCR status: `GET /api/ocr/status`
- Drake OCR image extraction: `POST /api/ocr/extract-image`
- Drake OCR PDF extraction: `POST /api/ocr/extract-pdf`

Production env files added:

- `.env.production.example`: root Docker production stack values.
- `backend/.env.production.example`: backend-only production values.
- `backend/.env.digitizer.production.example`: Drake SLM/GPT and Drake OCR endpoint values.
- `frontend/.env.user.production.example`: user dashboard build values.
- `frontend/.env.admin.production.example`: admin dashboard build values.

Deployment rule:

Both admin and user dashboards must use the same `VITE_API_URL`, and the backend must use the same `DATABASE_URL`. That is what makes admin-created credentials immediately work on the user login page and what makes user activity visible in the admin dashboard.
