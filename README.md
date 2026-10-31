# Jannes Maskin & Smide

Web platform and internal administration system for **Jannes Maskin & Smide AB**, a machinery sales, spare parts, workshop, and metalworking company based in Värmland, Sweden.

The application provides a bilingual public website (Swedish and English) for browsing machinery and inventory and submitting quote inquiries, paired with a role-based administration panel for managing catalog listings, customer email threads, sales records, statistics, and staff accounts.

## Tech Stack

- **Frontend:** React 19 (`19.2.8`), React Router 7 (`HashRouter`), Vite 8 (`8.2.0`)
- **Styling:** Custom CSS with CSS custom properties for dark and light themes (`src/index.css`)
- **Charts & Icons:** Recharts 3 (`3.10.1`), Lucide React (`1.31.0`)
- **Progressive Web App:** `vite-plugin-pwa` (`injectManifest` strategy) and a custom Service Worker (`public/sw.js`) supporting Web Push notifications
- **Backend & Database:** Supabase (`@supabase/supabase-js` `2.112.3`, PostgreSQL 17, Auth, Row Level Security, Storage, Realtime, `pg_cron`, `pg_net`)
- **Serverless Functions:** Supabase Edge Functions (Deno 2 / TypeScript) with Nodemailer (SMTP) and ImapFlow + `mailparser` (IMAP)
- **Testing & Quality:** Node.js built-in test runner (`node:test`), ESLint 10 (`eslint.config.js`), GitHub Actions CI, `gh-pages`

## Features

### Public Website

- **Bilingual interface:** Full Swedish and English translations managed through `LanguageContext` and `src/i18n/translations.js`.
- **Theme support:** Dark and light theme toggle persisted in `localStorage`.
- **Machinery catalog (`/#/maskiner`, `/#/maskiner/:slug`):** Filterable and searchable catalog of agricultural, forestry, construction, and transport machinery with status badges (`published`, `reserved`, `sold`), multi-image galleries, technical specifications, feature lists, and an optional toggle to view sold machines.
- **Spare parts and equipment inventory (`/#/losore`, `/#/losore/:slug`):** Searchable catalog of spare parts, attachments, and workshop equipment with category filtering, status badges, image galleries, and item detail pages.
- **Service and company pages:** Dedicated views for workshop and repair services (`/#/verkstad`), custom manufacturing and metalworking, machinery transport, buying and selling machinery, company background (`/#/om-oss`), and contact information (`/#/kontakt`).
- **Quote and contact flows:** Context-aware quote request forms (`QuoteRequestForm`, `QuoteModal`) and general contact forms (`ContactForm`, `ContactModal`) that create records in `quote_requests` linked to specific machines, inventory items, or service categories.

### Administration Panel

- **Dedicated admin entry (`/#/admin` and `admin.html`):** Lazy-loaded administration interface (`AdminLayout`) with a separate PWA manifest (`public/admin.webmanifest`) for standalone installation.
- **Authentication and account recovery:** Password sign-in (`/#/admin/login`), invitation and password recovery token verification (`/#/admin/update-password`), and user profile management (`/#/admin/profile`).
- **Role-based access control (RBAC):** Four hierarchical roles (`superadmin`, `admin`, `employee`, `intern`) combined with granular permission flags (`machines:read/write/delete`, `inventory:read/write/delete`, `quotes:read/write/delete`, `sales:read/write`, `statistics:read`), job role tags, and per-user notification preferences.
- **Catalog management (`MachineFormPage`, `InventoryFormPage`):** Create, edit, and delete machinery and inventory items with multi-image uploads to Supabase Storage (`machine-images` and `inventory-images`), primary image selection, image sort order, automatic URL slug generation, bilingual descriptions, and status management (`published`, `draft`, `reserved`, `sold`).
- **Quote and email thread management (`QuoteRequestsPanel`):** Manage customer inquiries across status stages (`new`, `contacted`, `completed`, `archived`), send threaded email replies with file attachments (`quote-attachments`), use reply templates, and receive real-time thread updates via Supabase Realtime.
- **Statistics and sales tracking (`StatisticsPanel`, `SalesPanel`):** Interactive KPI cards and Recharts visualizations (bar, pie, and line charts) for catalog distribution and quote trends, plus sales history tracking (`sales_records`) with total revenue, sold count, and average sale price filtered by rolling time windows (`7`, `30`, `90`, `365` days, all time, or specific calendar months).
- **User administration (`UsersPanel`):** Invite new staff accounts, resend pending invitations, assign roles and permissions, configure notification preferences, trigger password resets, and delete accounts via the `admin-users` Edge Function.
- **Web Push notifications (`GlobalAdminNotifications`):** Browser push notifications for new quote requests and incoming customer email replies.

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm
- A Supabase project (or the Supabase CLI for local database and Edge Function development)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Tivva34/Jannes-Maskin-o-Smide.git
cd Jannes-Maskin-o-Smide
```

2. Install dependencies:

```bash
npm install
```

3. Create a local environment file from `.env.example`:

```bash
cp .env.example .env.local
```

4. Populate `.env.local` with your Supabase project URL, publishable anonymous key, and VAPID public key.

5. Start the Vite development server:

```bash
npm run dev
```

## Environment Variables

### Frontend (`.env.local`)

The client application reads the following Vite environment variables (defined in `.env.example` and accessed in `src/lib/supabase.js`, `src/lib/config.js`, and `src/lib/pushNotificationService.js`):

| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Base URL of the Supabase project |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase public anonymous key |
| `VITE_VAPID_PUBLIC_KEY` | Base64URL-encoded VAPID public key for browser Web Push subscriptions |

### Supabase Edge Functions

The Edge Functions under `supabase/functions/` read the following runtime variables from the Supabase Edge environment via `Deno.env.get(...)`:

#### Core Supabase & Application URLs

| Variable | Used by | Description |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `admin-users`, `send-quote-reply`, `fetch-incoming-emails`, `send-push-notification` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `admin-users`, `send-quote-reply`, `send-push-notification` | Supabase anonymous key used to verify caller JWTs |
| `SUPABASE_SERVICE_ROLE_KEY` | `admin-users`, `send-quote-reply`, `fetch-incoming-emails`, `send-push-notification` | Service role key for privileged Auth, database, and storage operations |
| `VITE_APP_URL` | `admin-users` | Fallback application origin used when constructing invitation redirect URLs |
| `BASE_PATH` | `send-push-notification` | Base URL path prefix for notification click targets (defaults to `/Jannes-Maskin-o-Smide`) |

#### SMTP & IMAP Email Configuration

| Variable | Used by | Description |
| :--- | :--- | :--- |
| `GMAIL_SMTP_USER` | `send-quote-reply`, `fetch-incoming-emails`, `test-smtp` | Email address used for outbound SMTP sending and inbound IMAP polling |
| `GMAIL_SMTP_PASSWORD` | `send-quote-reply`, `fetch-incoming-emails`, `test-smtp` | App password used for SMTP and IMAP authentication |
| `EMAIL_SENDER_NAME` | `send-quote-reply` | Display name in outbound `From` headers (sanitized to prevent header injection) |
| `EMAIL_TEST_MODE` | `send-quote-reply` | When set to `"true"`, redirects outbound emails to `EMAIL_TEST_RECIPIENT` |
| `EMAIL_TEST_RECIPIENT` | `send-quote-reply` | Override recipient address used when `EMAIL_TEST_MODE` is `"true"` |
| `IMAP_MAILBOX` | `fetch-incoming-emails` | IMAP folder to poll for incoming replies (defaults to `INBOX`) |
| `INBOUND_SENDER_FALLBACK` | `fetch-incoming-emails` | Optional flag (`"true"`) enabling sender-address fallback matching |
| `IMAP_TEST_API_KEY` | `fetch-incoming-emails` | Shared secret (`x-api-key` header) authenticating scheduled `pg_cron` or manual polling requests |
| `SMTP_TEST_API_KEY` | `test-smtp` | Shared secret (`x-api-key` header) required to call the SMTP test function |

#### Web Push & VAPID Configuration

| Variable | Used by | Description |
| :--- | :--- | :--- |
| `VAPID_PUBLIC_KEY` | `send-push-notification` | VAPID public key (also accepts lowercase `vapid_public_key`) |
| `VAPID_PRIVATE_KEY` | `send-push-notification` | VAPID private signing key (also accepts lowercase `vapid_private_key`) |
| `VAPID_SUBJECT` | `send-push-notification` | Contact URI (`mailto:` or `https:`) for VAPID JWT claims |
| `PUSH_TRIGGER_SECRET` | `send-push-notification` | Shared secret (`x-push-secret` header) authenticating database trigger requests |

Never commit `.env.local` or any secret values to version control.

## Available Scripts

The following scripts are configured in `package.json`:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Build the production bundle (`index.html` and `admin.html`) into `dist/` |
| `npm run preview` | Locally preview the production build from `dist/` |
| `npm run lint` | Run ESLint across the repository |
| `npm test` | Run the unit test suite (`node --test "tests/*.test.js"`) |
| `npm run deploy` | Build the project and publish `dist/` to GitHub Pages (`base: '/Jannes-Maskin-o-Smide/'`) via `gh-pages` |
| `npm run supabase` | Execute the local Supabase CLI binary |

## Project Structure

```text
.
|-- .github/
|   `-- workflows/
|       `-- ci.yml                     # GitHub Actions CI workflow (lint, test, build)
|-- public/
|   |-- images/                        # Hero background and brand images
|   |-- admin.webmanifest              # PWA manifest for the standalone admin app
|   |-- sw.js                          # Custom Service Worker (Workbox precache + Web Push)
|   |-- robots.txt
|   `-- sitemap.xml
|-- src/
|   |-- assets/                        # Static frontend assets
|   |-- components/
|   |   |-- admin/                     # AdminLayout, QuoteRequestsPanel, SalesPanel, StatisticsPanel, UsersPanel
|   |   `-- *.jsx                      # Public sections, Navbar, Footer, cards, and form modals
|   |-- contexts/
|   |   |-- AuthContext.jsx            # Supabase session management and user profile loader
|   |   `-- LanguageContext.jsx        # Swedish/English language provider
|   |-- data/
|   |   `-- company.js                 # Company metadata, contact details, and partner brands
|   |-- i18n/
|   |   `-- translations.js            # Bilingual UI dictionary (sv / en)
|   |-- lib/
|   |   |-- config.js                  # Environment variable validation helpers
|   |   |-- emailUtils.js              # Client-side quoted-reply stripping helpers
|   |   |-- inventoryService.js        # Inventory CRUD and storage operations
|   |   |-- machinesService.js         # Machinery CRUD, slug generation, and storage operations
|   |   |-- pushNotificationService.js # Web Push subscription management
|   |   |-- quoteService.js            # Quote request and message thread operations
|   |   |-- salesService.js            # Sales record creation, reversion, and queries
|   |   `-- supabase.js                # Supabase client instance
|   |-- pages/
|   |   |-- admin/                     # AdminDashboard, MachineFormPage, InventoryFormPage, LoginPage, ProfilePage, UpdatePasswordPage
|   |   `-- *.jsx                      # Public route views (HomePage, MachineryPage, InventoryPage, WorkshopPage, AboutPage, ContactPage)
|   |-- App.jsx                        # Root HashRouter setup and auth recovery/invite handler
|   |-- index.css                      # Global styles and dark/light theme variables
|   `-- main.jsx                       # React DOM entry point
|-- supabase/
|   |-- functions/
|   |   |-- _shared/                   # Shared pure modules (rbac.js, email-logic.js)
|   |   |-- admin-users/               # User account and RBAC management Edge Function
|   |   |-- fetch-incoming-emails/     # Inbound IMAP polling and thread matching Edge Function
|   |   |-- send-push-notification/    # Web Push encryption and delivery Edge Function
|   |   |-- send-quote-reply/          # Outbound SMTP quote reply Edge Function
|   |   `-- test-smtp/                 # SMTP connection diagnostic Edge Function
|   |-- migrations/                    # 40 sequential PostgreSQL schema and RLS migrations
|   `-- config.toml                    # Supabase CLI configuration
|-- tests/
|   |-- _no-network.js                 # Preload guard blocking outbound network calls during tests
|   |-- config-rbac.test.js            # Unit tests for config validation and RBAC permission logic
|   `-- email-logic.test.js            # Unit tests for email threading, quote stripping, and attachment paths
|-- admin.html                         # Entry HTML for the standalone admin PWA
|-- index.html                         # Primary application entry HTML
|-- eslint.config.js                   # ESLint 10 flat configuration
|-- package.json
`-- vite.config.js                     # Vite multi-page build and PWA configuration
```

## Supabase

### Database Migrations

The `supabase/migrations/` directory contains 40 sequential SQL migrations defining the database schema, Row Level Security (RLS) policies, storage buckets, and background jobs:

- **Catalog and CRM tables:** `machines`, `machine_images`, `inventory_items`, `inventory_images`, `quote_requests`, `quote_messages`, `sales_records`, `user_profiles`, and `push_subscriptions`.
- **Storage buckets and policies:** Public read / authenticated write buckets for `machine-images` and `inventory-images`, and a private bucket (`quote-attachments`) restricted by RLS policies to staff roles (`superadmin`, `admin`, `employee`) or users with explicit `quotes:read`, `quotes:write`, or `quotes:delete` permissions.
- **Role-based security:** PostgreSQL helper functions (`has_role`, `has_permission`, `is_admin` with hardened `search_path = ''`) and RLS policies enforcing role boundaries, preventing privilege escalation on `user_profiles`, and protecting the last `superadmin` account from deletion or demotion.
- **Realtime & scheduled jobs:** Supabase Realtime publication on quote tables, database triggers invoking `send-push-notification` via `pg_net`, and a `pg_cron` job polling `fetch-incoming-emails` every 30 seconds with a 120-second timeout.

### Edge Functions

Each Edge Function in `supabase/functions/` runs on Deno 2:

- `admin-users`: Authenticates the caller's JWT and role rank before creating accounts, inviting users (`inviteUserByEmail`), resending pending invitations, updating roles/permissions/notification preferences, sending password recovery links, or deleting users.
- `send-quote-reply`: Verifies `quotes:write` access, stores the outgoing message in `quote_messages`, validates and downloads attachments from `quote-attachments`, sends threaded emails over SMTP via Nodemailer (`In-Reply-To` and `References`), and records delivery status (`sent`, `sent_test_mode`, `failed`, or `not_configured`).
- `fetch-incoming-emails`: Connects to the IMAP mailbox via ImapFlow, matches unread messages to existing quote threads using `In-Reply-To` and `References` headers, strips quoted reply history (`stripQuotedReply`), uploads customer attachments to `quote-attachments`, and inserts records idempotently (handling PostgreSQL unique constraint `23505`).
- `send-push-notification`: Implements RFC 8291 (`aes128gcm`) payload encryption and VAPID (`ES256`) signing using the Web Crypto API, filters recipients by their `notification_preferences`, and removes expired subscriptions returning HTTP `404` or `410`.
- `test-smtp`: Diagnostic endpoint protected by `x-api-key` for verifying SMTP server authentication and delivery.

Shared pure logic in `supabase/functions/_shared/rbac.js` and `supabase/functions/_shared/email-logic.js` is imported by both the Edge Functions and the Node.js unit test suite in `tests/`.

## Development Workflow

- `main` is the primary branch and holds the verified, production-ready state of the repository.
- Feature additions, bug fixes, and refactoring are developed on scoped topic branches (`update/*`, `fix/*`, `refactor/*`) and merged into `main` using non-fast-forward merges (`--no-ff`) to preserve branch history.
- Every push and pull request targeting `main` triggers the GitHub Actions workflow in `.github/workflows/ci.yml` on `ubuntu-latest` with Node.js 22 (`npm ci`, `npm run lint`, `npm test`, and `npm run build`).
- Unit tests in `tests/` import `tests/_no-network.js`, which intercepts and blocks `fetch`, `http`, `https`, `net`, `tls`, and `dgram` so all tests execute deterministically offline.
