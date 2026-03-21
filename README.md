# CRM Pro

Modern CRM platform with role-based access, analytics, workflow automation, notifications, and document management.

## Implemented Upgrades

1. UI/UX
- Dark/Light theme toggle
- Responsive sidebar + mobile-friendly navigation
- KPI cards and analytics dashboard charts

2. Analytics
- Lead conversion rate
- Monthly sales trend (budget x completion)
- Customer growth trend
- Activity logs feed
- Advanced analytics endpoint with range/team filtering (`GET /api/analytics/advanced`)
- Sales funnel value, team performance, and lead/deal timeline widgets

3. Authentication & Roles
- JWT auth
- Role + permission-aware authorization middleware
- Permission-based RBAC enforcement for leads/customers/deals/analytics/notifications APIs

4. Notifications
- In-app notifications API
- Task reminders and workflow alerts
- Optional SMTP email notifications via Nodemailer for every notification event

5. File & Document Management
- Customer document upload endpoint
- File metadata stored on customer profile

6. Automation
- Hourly scheduler for upcoming deadline reminders
- Auto lead progression (stale new leads -> qualified)
- Auto-assignment for new leads (round-robin)

7. Search/Filters
- Leads: search, status filter, sorting
- Customers: search, status filter, sorting
- Tasks: search, status filter, sorting

8. Mobile Responsiveness
- Sidebar drawer on mobile
- Adaptive spacing and controls

9. Cloud/Deployment Ready
- Backend static file hosting for uploads
- Environment-ready API base URL

10. AI Bonus Hooks
- Lead scoring endpoint (`GET /api/leads/:id/score`)

## Local Run

### Backend

1. `cd backend`
2. `npm install`
3. Create `.env`:
	- `PORT=5000`
	- `JWT_SECRET=your_secret`
	- `MONGODB_URI=your_mongodb_uri`
	- Optional email config:
		- `SMTP_HOST=smtp.yourprovider.com`
		- `SMTP_PORT=587`
		- `SMTP_SECURE=false`
		- `SMTP_USER=your_user`
		- `SMTP_PASS=your_password`
		- `EMAIL_FROM=no-reply@yourdomain.com`
4. `npm run dev`

### Frontend

1. `cd frontend`
2. `npm install`
3. Optional `.env`:
	- `VITE_API_URL=http://localhost:5000/api`
4. `npm run dev`

## Deployment

### Frontend (Vercel/Netlify)
- Build command: `npm run build`
- Output directory: `dist`
- Set env var: `VITE_API_URL=https://your-backend-domain/api`

### Backend (Render/AWS/Fly)
- Start command: `node server.js`
- Set env vars:
  - `PORT`
  - `JWT_SECRET`
	- `MONGODB_URI` (MongoDB Atlas recommended)
  - Optional: `DISABLE_AUTH=false`
	- Optional SMTP vars for email notifications

### One-command Cloud-like Local Stack (Docker)
- `docker compose up --build`
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5003/api/health`

### Render Blueprint
- `render.yaml` is included for backend + static frontend provisioning.

### Database
- Use MongoDB Atlas in production
- Add indexes for high-cardinality search fields
