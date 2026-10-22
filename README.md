# MedMap — Full Stack Medicine Availability & Ordering App

MedMap is a college mini-project aligned with the supplied Full Stack Development syllabus: responsive HTML/CSS/JavaScript UI, React, Node.js/Express REST APIs, MongoDB CRUD, basic authentication, and deployment on Vercel using a serverless Express API plus MongoDB Atlas.

## Roles and demo credentials

| Role | Login ID | Password | Access |
|---|---:|---:|---|
| Administrator | `115` | `51000` | Full medicine CRUD, pharmacy listings, all orders |
| Pharmacist | `116` | `51000` | Add pharmacy listings, update/remove inventory, receive orders assigned to their pharmacy |
| Patient | Register with email | Chosen during registration | Search stock, choose a pharmacy, place orders, track order status |

The admin/pharmacist demo users and starter data are created automatically on the first server startup. Passwords are stored as bcrypt hashes, not plain text. Change the demo credentials before any public deployment.


## Deploy to Vercel (frontend and API together)

This version is configured for Vercel. The React/Vite frontend builds to `dist`, and `api/[...path].js` routes `/api/*` requests to the Express backend as a Vercel Function. The frontend uses same-origin `/api` URLs, so you do not need a separate `VITE_API_URL` or a Render backend for this configuration.

1. Push the entire `medmap` folder contents to a GitHub repository.
2. In Vercel, import that repository. If the repository root is the project folder, leave Root Directory as `.`. If the project is inside a larger repository, set Root Directory to `medmap`.
3. Use the Vercel defaults from `vercel.json`: build command `npm run build`, output directory `dist`.
4. Create a MongoDB Atlas database and database user. In Atlas Network Access, allow access from Vercel. For a college demo, `0.0.0.0/0` may be used temporarily with a strong database password; restrict access when possible.
5. In Vercel → Project → Settings → Environment Variables, add:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `JWT_SECRET` = a long random secret
   - `ADMIN_ID` = `115`
   - `ADMIN_PASSWORD` = `51000`
   - `PHARMACIST_ID` = `116`
   - `PHARMACIST_PASSWORD` = `51000`
6. Redeploy after adding the variables. Open `https://YOUR-PROJECT.vercel.app/api/health`; it should return `{"ok":true,"app":"MedMap API"}` once the database connects.
7. Test login and ordering on the deployed URL.

Important: Vercel cannot connect to your laptop's local MongoDB. `MONGODB_URI` must point to a reachable MongoDB Atlas database. Do not commit `.env` or publish your database credentials. The demo staff passwords are deliberately simple for assessment only; replace them before public use.

## Local development

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your local MongoDB or Atlas URI.
3. Run `npm install` and then `npm run dev`.
4. Open `http://localhost:5173`.

## Main features

- Responsive medicine search by name, brand, or category; optional city filter.
- Pharmacy selector and per-pharmacy price/quantity display.
- Patient registration and login.
- Admin: create/update/delete medicines, create and deactivate pharmacy listings, review all orders.
- Pharmacist portal: add pharmacy listings, update quantities/prices, remove stock entries, view and update orders assigned to their user account.
- An order is saved with the selected pharmacy and its assigned pharmacist. Only that pharmacist and the admin can see it in the staff order list.
- Inventory is decremented when an order is placed. The API checks quantity again before decrementing.
- Order statuses: Placed → Accepted → Ready → Completed, or Cancelled.
- Prescription-required medicines are listed for discovery but ordering them is blocked in this demo; no prescription upload/validation is implemented.
- Past order history is preserved when a pharmacy is removed from public listings.

## Requirements

- Node.js 18 or newer
- MongoDB running locally, or a MongoDB Atlas connection string

## Run locally

1. Extract the project folder and open a terminal in it.
2. Install packages:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update `MONGODB_URI` if needed.
   - Local default: `mongodb://127.0.0.1:27017/medmap`
   - For Atlas, use your Atlas connection string and URL-encode special characters in the database user's password.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173`.

The React dev server proxies `/api` requests to the Express server on port 5000. MongoDB must be running before the API starts.

## Test the main flow

1. Sign in as admin (`115` / `51000`) and add a medicine and/or pharmacy.
2. Sign out and sign in as pharmacist (`116` / `51000`).
3. Open Pharmacy Portal and update stock for the demo pharmacy. The seeded catalogue includes Paracetamol, Cetirizine, ORS and a prescription-required Amoxicillin entry.
4. Sign out and create a patient account with an email.
5. On Find Medicine, select the pharmacy, choose quantities from its stock, then place the order.
6. Sign out and sign in as pharmacist. The new order should appear under Incoming orders because it is assigned to the selected pharmacy's pharmacist.
7. Update the order to Accepted, Ready or Completed. Sign in as patient to see status updates.

## API overview

- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET /api/pharmacies`, `POST /api/pharmacies`, `PATCH /api/pharmacies/:id`, `DELETE /api/pharmacies/:id`
- `GET /api/medicines`, `POST /api/medicines`, `PATCH /api/medicines/:id`, `DELETE /api/medicines/:id`
- `GET /api/stock`, `POST /api/stock`, `DELETE /api/stock/:id`
- `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders`, `PATCH /api/orders/:id/status`
- `GET /api/health`

Staff routes use bearer-token authentication and role-based authorization. Pharmacists can update stock only for pharmacies assigned to them, and they see only orders assigned to their account.

## Optional: Render deployment

The same Express app can also be hosted as a Render Web Service using `npm install` and `npm start`, with the same MongoDB Atlas and secret environment variables. For the requested Vercel deployment, use the Vercel steps above.

For a production-grade deployment, configure CORS narrowly, use HTTPS, rotate demo credentials, add rate limiting and audit logging, and use a transaction or reservation/rollback strategy for concurrent inventory updates. This student demo does not process payments, validate prescriptions, or replace medical advice.
