# MedMap — Full Stack Medicine Availability & Ordering App

MedMap is a college mini-project aligned with the supplied Full Stack Development syllabus: responsive HTML/CSS/JavaScript UI, React, Node.js/Express REST APIs, MongoDB CRUD, basic authentication, and deployment preparation for Render.

## Roles and demo credentials

| Role | Login ID | Password | Access |
|---|---:|---:|---|
| Administrator | `115` | `51000` | Full medicine CRUD, pharmacy listings, all orders |
| Pharmacist | `116` | `51000` | Add pharmacy listings, update/remove inventory, receive orders assigned to their pharmacy |
| Patient | Register with email | Chosen during registration | Search stock, choose a pharmacy, place orders, track order status |

The admin/pharmacist demo users and starter data are created automatically on the first server startup. Passwords are stored as bcrypt hashes, not plain text. Change the demo credentials before any public deployment.

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

## Deploy to Render (overview)

1. Push this folder to a GitHub repository.
2. Create a MongoDB Atlas database and configure network access for the deployment environment.
3. In Render, create a **Web Service** from the repository.
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Add environment variables in Render: `MONGODB_URI`, a strong `JWT_SECRET`, `ADMIN_ID`, `ADMIN_PASSWORD`, `PHARMACIST_ID`, `PHARMACIST_PASSWORD`.
7. Deploy and test `/api/health`, login, stock updates and the order routing flow.

For a production-grade deployment, configure CORS narrowly, use HTTPS, rotate demo credentials, add rate limiting and audit logging, and use a transaction or reservation/rollback strategy for concurrent inventory updates. This student demo does not process payments, validate prescriptions, or replace medical advice.
