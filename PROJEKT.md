# fillQR - Projekt-Dokumentation

> QR-Code-basierte Datenerfassung als SaaS Multi-Tenant Abo-Produkt.

---

## Quick Info

| Aspekt | Wert |
|--------|------|
| **Status** | Relaunch (Sprint 0: AP-01 bis AP-04 fertig) |
| **Stack** | Next.js (App Router) + TypeScript + tRPC + Prisma + PostgreSQL + Docker + Caddy |
| **Server** | Hetzner CCX13 (Dedicated, Falkenstein) |
| **Server-IP** | 91.99.113.226 |
| **OS** | Ubuntu 24.04 LTS |
| **Domains** | fillqr.de, app.fillqr.de, demo.fillqr.de, *.fillqr.de |
| **DNS** | Cloudflare (Migration von Variomedia, Stand 2026-03-26) |
| **Pricing** | 34,95 EUR/Monat + 99 EUR Design (inkl. MwSt) |
| **Zielgruppe** | B2B (Vereine, Restaurants, Messen) |
| **Git Repo** | web/web-fillqr |
| **Lastenheft** | Notion TASK255 |

### Alter Stack (abgeloest)

PHP + MySQL auf Variomedia Shared Hosting. Wird vollstaendig durch neuen Stack ersetzt.

---

## Architektur-Entscheidung (verbindlich seit 2026-03-27)

**Ein gemeinsames Fullstack-Projekt** mit Next.js (App Router), TypeScript, tRPC, Prisma, PostgreSQL.

### Explizit NICHT in V1:
- Kein separates NestJS-Backend
- Kein separates React-Frontend
- Kein Authentik
- Keine Business-Logik in n8n
- Kein offener Form-Builder / Low-Code-Engine
- Kein Self-Service-Onboarding
- Keine komplexe automatische Abrechnung
- Keine JWT-first-Architektur

### Auth V1:
- Eigene App-Auth (E-Mail + Passwort, session-/cookie-basiert via iron-session)
- Session speichert: userId, tenantId, email, appKey
- appKey bestimmt Produkt (vereinsbuddy/trainerfeedback/messebuddy)
- Rollen: Jeder User ist Admin — kein role-Feld in V1

---

## Beschreibung

fillQR ist eine mandantenfaehige SaaS-Plattform fuer digitale Datenerfassung per QR-Code mit Admin-Dashboard.

Grundprinzip: QR-Code → Formular → Datensatz → Uebersicht/Dashboard → Status/Bearbeitung

### V1 Use Cases (begrenzt auf drei):
1. **Verein** — Digitaler Mitgliedsantrag + Mitgliederuebersicht + Statusverwaltung
2. **Trainerfeedback** — Feedbackformular nach Training/Schulung + Auswertung
3. **Lead-Erfassung / Messe** — Kontaktdaten erfassen + Nachverfolgung

---

## Server-Zugang

```bash
# SSH (Key-Auth, Port 2222, kein Passwort-Login)
ssh -i ~/.ssh/fillqr/id_ed25519_jacky_fillqr -p 2222 jacky@91.99.113.226

# SSH als root
ssh -i ~/.ssh/fillqr/id_ed25519_jacky_fillqr -p 2222 root@91.99.113.226

# PostgreSQL via SSH-Tunnel (dann localhost:5433 in pgAdmin/DBeaver)
ssh -i ~/.ssh/fillqr/id_ed25519_jacky_fillqr -p 2222 -L 5433:127.0.0.1:5432 jacky@91.99.113.226 -N

# .env auf dem Server lesen
ssh -t -i ~/.ssh/fillqr/id_ed25519_jacky_fillqr -p 2222 jacky@91.99.113.226 "sudo cat /opt/fillqr/.env"
```

---

## Domain-Mapping

| Domain | Ziel | Beschreibung |
|--------|------|--------------|
| fillqr.de | Caddy → /srv/landing | Produktseite (statisches HTML) |
| www.fillqr.de | Caddy → /srv/landing | Redirect/Mirror |
| app.fillqr.de | Caddy → Next.js App:3000 | Kunden-Adminbereich |
| demo.fillqr.de | Caddy → Next.js App:3000 | Demo / Demo-Tenant |
| admin.fillqr.de | Caddy → Next.js App:3000 | Betreiber-Panel (IP-Whitelist + Basic Auth) |
| xpgad.fillqr.de | Caddy → pgadmin:80 | pgAdmin (IP-Whitelist: nur Jacky) |
| *.fillqr.de | Caddy → Next.js App:3000 | Oeffentliche Formulare je Tenant |

**Tenant-Routing:** Middleware liest Subdomain → setzt x-tenant-slug Header. Server-side get-tenant.ts löst slug zu {tenant, appKey} auf via tenant_apps. Reservierte Subdomains: app, www, admin, xpgad, demo, api. Wildcard-DNS + Wildcard-TLS (Cloudflare DNS-Challenge). ERP Buddy bleibt Betreiber-/Firmenseite, nicht Kundenportal.

---

## Server-Architektur

```
Hetzner CCX13 (91.99.113.226)
├── Hetzner Firewall (ICMP, 80, 443, 2222 nur Jacky-IP)
├── UFW (2222, 80, 443)
├── fail2ban (SSH: 3 Versuche → 24h Ban)
├── unattended-upgrades (automatische Sicherheitsupdates)
│
└── Docker Compose (/opt/fillqr/)
    ├── fillqr-caddy        (Custom-Build: Cloudflare DNS + Rate Limit)
    │   ├── HTTPS via Let's Encrypt
    │   ├── IP-Whitelist fuer pgAdmin
    │   └── Rate Limiting (60 req/min pro IP)
    ├── fillqr-postgres      (PostgreSQL 17, nur 127.0.0.1:5432)
    └── fillqr-pgadmin       (pgAdmin, nur ueber Caddy erreichbar)
```

---

## Docker-Struktur auf dem Server

```
/opt/fillqr/
├── docker-compose.yml
├── Caddyfile
├── .env                      ← Credentials (chmod 600, nur root)
├── landing/                  ← Statische Landingpage
├── caddy_data/               ← TLS-Zertifikate
├── caddy_config/
├── caddy-custom/
│   └── Dockerfile            ← Custom Caddy mit Cloudflare + Rate Limit
├── backups/                  ← PostgreSQL Dumps (7 Tage)
└── backup.sh                 ← Cron: taeglich 03:00
```

---

## Credentials

| Name | Wo | Hinweis |
|------|-----|---------|
| SSH Key (jacky) | `~/.ssh/fillqr/id_ed25519_jacky_fillqr` | Lokal auf Jackys Rechner |
| PostgreSQL (postgres) | `/opt/fillqr/.env` auf Server | Superuser — nur fuer Admin |
| PostgreSQL (fillqr_app) | `/opt/fillqr/.env` auf Server | App-User — fuer Backend |
| pgAdmin Login | `/opt/fillqr/.env` auf Server | jacky@erp-buddy.de |
| Hetzner API Token | `C:/ERPBuddy/.env` | HETZNER_API_TOKEN |
| Variomedia API Token | `C:/ERPBuddy/.env` | VARIOMEDIA_API_TOKEN |
| Cloudflare API Token | TODO | CLOUDFLARE_API_TOKEN |

---

## Sicherheit

| Massnahme | Status | Details |
|-----------|--------|---------|
| Hetzner Firewall | Aktiv | Nur 80, 443, 2222 (SSH nur 91.249.181.74) |
| UFW | Aktiv | 2222, 80, 443 |
| SSH Hardening | Aktiv | Port 2222, Key-Only, PermitRootLogin prohibit-password |
| fail2ban | Aktiv | SSH Jail: 3 Fehlversuche → 24h Ban |
| Caddy IP-Whitelist | Aktiv | pgAdmin nur Jacky Home-IP + Tailscale (100.64.0.0/10) |
| Caddy Rate Limiting | Aktiv | 60 Requests/Min pro IP |
| PostgreSQL | Aktiv | Nur 127.0.0.1, nicht von aussen erreichbar |
| Unattended Upgrades | Aktiv | Automatische Sicherheitsupdates |

---

## Datenbank (PostgreSQL 17)

- **Host:** fillqr-postgres (Docker) / 127.0.0.1:5432 (vom Server) / localhost:5433 (via SSH-Tunnel)
- **DB:** fillqr
- **App-User:** fillqr_app
- **Backup:** taeglich 03:00, 7 Tage Retention, `/opt/fillqr/backups/`

### Plattform-Modell (S0-AP01, 2026-03-30)

| Tabelle | Zweck |
|---------|-------|
| tbl_tenants | Mandant (Kunde) mit Adressdaten (name, street, zip, city, email, phone, logo_path) |
| tbl_apps | Produkte (statisch: vereinsbuddy, trainerfeedback, messebuddy) |
| tbl_tenant_apps | Zuordnung Tenant + Produkt + Subdomain (slug = Subdomain) |
| tbl_app_users | Login-Accounts (E-Mail + Passwort, keine Rollen) |

Status ist ein String-Feld (kein Enum). Jeder User ist Admin — kein role-Feld.

### VereinsBuddy-Modell (S1-AP10, 2026-03-31)

| Tabelle | Zweck |
|---------|-------|
| tbl_members | Vereinsmitglieder (Name, Adresse, Status, Beitragsdaten) |
| tbl_membership_types | Beitragsarten pro Tenant (Name, Betrag, aktiv/inaktiv) |
| tbl_departments | Abteilungen pro Tenant (Name, Zusatzbeitrag) |
| tbl_member_departments | N:M Zuordnung Member ↔ Department (Composite PK) |

Member-Status: eingegangen → in_pruefung → angenommen → abgelehnt → gekuendigt (String, kein Enum).

### Guardians + Annahme-Flow (S1-AP18 + S2-AP19, 2026-04-01)

| Tabelle | Zweck |
|---------|-------|
| tbl_guardians | Erziehungsberechtigte (member_id FK, Name, Email, Telefon, opt. Anschrift) |

Bei Annahme: Mitgliedsnummer vergeben (MAX+1, UNIQUE Constraint, Retry bei Race Condition). Willkommensmail async (sendMail, Fehler blockiert nicht). Template: `buildWelcomeEmail()` in `src/lib/email.ts`.

Formular: Abschnitt 3 (Erziehungsberechtigte) erscheint automatisch bei Alter < 18. Server-Validierung: Guardian Pflicht bei Minderjaehrigen.

### Admin-Einstellungen (S1-AP11, 2026-03-31)

| Route | Zweck |
|-------|-------|
| /admin/einstellungen | 7 Tabs: Vereinsdaten, Sparten CRUD, Mitgliedstypen CRUD, Zahlungsoptionen+SEPA, opt. Felder, Dokumente, Impressum |
| /api/upload | File Upload (Logo, Satzung, Beitragsordnung). Max 2MB, PNG/JPG/SVG/PDF |
| /api/uploads/[...path] | File Serving (auth-geschuetzt, nur eigene Tenant-Dateien) |

tRPC Router: `settings` (protectedProcedure). settings_json in tbl_tenant_apps speichert Zahlungsoptionen, SEPA-Toggle, opt. Felder, Dokument-URLs, Impressum.

Upload-Pfad: `/data/uploads/{tenant_id}/` (Docker Volume `./uploads:/app/data/uploads`). DB-Pfad: `/api/uploads/{tenant_id}/{datei}`.

### Public Formular (S1-AP12, 2026-03-31)

| Route | Zweck |
|-------|-------|
| / (Subdomain-Root) | appKey-Switch: vereinsbuddy → MembershipForm, Rest → "Coming soon" |
| /vereinsbuddy/MembershipForm.tsx | Client Component: 2 Abschnitte (Persoenliche Daten + Mitgliedschaftsauswahl) |

Dynamische Felder aus AP-11 Einstellungen. Turnstile Widget (appearance: "always").
Middleware-Fix: x-tenant-slug wird als Request-Header gesetzt (NextResponse.next({ request: { headers } })).

### Submit + Bestaetigungs-Flow (S1-AP15, 2026-03-31)

| Route | Zweck |
|-------|-------|
| POST /api/vereinsbuddy/submit | Antrag absenden: Turnstile + Zod + Prisma Transaction (Member + Departments) |
| /vereinsbuddy/success?id= | Bestaetigungsseite mit Zusammenfassung (Tenant-isoliert) |

E-Mail: Eingangsbestaetigung an Antragsteller + Notification an Admin (tbl_tenants.email).
Caddy: `/api/vereinsbuddy/*` und `/vereinsbuddy/success*` als Public Paths in Wildcard-Block.

### Admin Dashboard + Mitglieder (S1-AP16+AP17, 2026-03-31)

| Route | Zweck |
|-------|-------|
| /admin/dashboard | Stats-Karten (eingegangen/angenommen/pruefung) + letzte 5 Eingaenge |
| /admin/mitglieder | Mitgliederliste mit Filter (Status/Sparte/Typ), Suche, Pagination, CSV-Export |
| /admin/mitglieder/[id] | Detailansicht mit Status-Wechsel (Transition-Map), History-Timeline, QR-Link |
| /api/admin/members/export | CSV-Export (BOM, gefiltert) |

tRPC Router: `members` (stats, recent, list, getById, updateStatus). Schema: `statusHistory Json?` in Member.
Status-Flow: eingegangen → in_pruefung/angenommen/abgelehnt → gekuendigt (serverseitig enforced).

### Email & Auth-Token (S0-AP06/AP07, 2026-03-30)

| Feature | Details |
|---------|---------|
| SMTP | nodemailer, smtp.variomedia.de:587, STARTTLS |
| Absender | noreply@fillqr.de |
| Invite-Flow | Betreiber legt User an → Token (48h, UUID) → Mail → /set-password?token=xxx |
| Reset-Flow | /forgot-password → Token (1h, UUID) → Mail → /reset-password?token=xxx |
| Token-Felder | tbl_app_users: invite_token, invite_expires_at, reset_token, reset_expires_at |
| Rate-Limiting | forgot-password: 3 Requests/Email/Stunde (In-Memory, V1) |
| Sicherheit | Kein Account-Enumeration, bcrypt(10), Token nach Use geloescht |
| Public Routes | /set-password, /forgot-password, /reset-password, /login — via Caddy ohne Basic Auth (*.fillqr.de) |
| Email-Links | Tenant-Subdomain: https://slug.fillqr.de/set-password?token=xxx |

### Tenant-Status

- active (Default)
- trial
- paused
- cancelled
- paused
- cancelled

---

## Onboarding- und Betriebslogik V1

### Onboarding (manuell in V1)

Kein Self-Service-Onboarding. Neue Kunden werden manuell angelegt:

1. Tenant anlegen
2. Ersten Admin-User anlegen
3. Template auswaehlen
4. Erstes Formular anlegen / veroeffentlichen
5. QR-Code bereitstellen
6. Testsubmission durchfuehren
7. Uebergabe an Kunden

### Billing / Abrechnung V1

Keine komplexe automatische Billing-Engine. Aber V1 muss vorbereiten:
- Plan/Tarif pro Tenant
- Tenant-Status
- Aktiv-/Inaktiv-Steuerung
- Basis fuer spaetere Rechnungslogik

Abrechnung darf in V1 organisatorisch noch manuell bleiben.

### DSGVO / Produktbetrieb V1

- Kunde/Verein/Firma ist in der Regel Verantwortlicher
- FillQR ist Auftragsverarbeiter
- AVV vor produktiver Nutzung
- Keine sensiblen Inhalte in Benachrichtigungs-E-Mails
- Loesch-/Deaktivierungskonzept vorbereiten
- Technische und organisatorische Mindestmassnahmen dokumentieren

---

## Verbindliche Entwicklungsleitplanken fuer Claude

- kein NestJS
- keine separate React-App
- kein Authentik in V1
- keine Business-Logik in n8n
- keine Overengineering-Muster
- keine Sonderlogik pro Kunde, wenn sie nicht als Template-/Config-Fall gedacht ist
- Tenant-Isolation immer mitdenken
- lieber stabil und einfach als clever und ueberladen
- UI nuechtern, funktional, wartbar
- Public-Form und Admin-App bleiben Teil eines gemeinsamen Next.js-Projekts
- Typensicherheit und klare Verantwortlichkeiten priorisieren
- keine alten Architekturannahmen unbemerkt mitschleppen

---

## Lokale Entwicklung

### DB-Verbindung (SSH-Tunnel)

Die PostgreSQL-DB laeuft auf dem Server. Fuer lokale Entwicklung und Tests SSH-Tunnel aufbauen:

```bash
# Terminal 1: SSH-Tunnel (bleibt offen)
ssh -i ~/.ssh/fillqr/id_ed25519_jacky_fillqr -p 2222 -L 5433:127.0.0.1:5432 jacky@91.99.113.226 -N
```

Die lokale `.env` muss `DATABASE_URL` auf den Tunnel zeigen:
```
DATABASE_URL=postgresql://fillqr_app:<passwort>@localhost:5433/fillqr
```

**Tunnel-Check:** `curl -s telnet://localhost:5433` oder `npx prisma db pull --print` — wenn Fehler, Tunnel pruefen.

### Dev-Server starten

```bash
cd C:/ERPBuddy/web/web-fillqr/fillqr-app

# Prisma-Client generieren (nach Schema-Aenderungen)
npx prisma generate

# Dev-Server
npm run dev
```

### Prisma-Migrationen (FALLE-077)

`npx prisma migrate dev` braucht interaktives Terminal — geht NICHT in Claude Code.
Stattdessen diesen Workflow nutzen:

```bash
# 1. SQL generieren (Diff zwischen aktueller DB und neuem Schema)
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > migration.sql

# 2. SQL pruefen! Dann in Migrations-Ordner speichern
mkdir -p prisma/migrations/YYYYMMDD_beschreibung
mv migration.sql prisma/migrations/YYYYMMDD_beschreibung/migration.sql

# 3. Migration als angewendet registrieren (nach manuellem Apply auf Server)
npx prisma migrate resolve --applied YYYYMMDD_beschreibung
```

App laeuft auf http://localhost:3000. Fuer automatisierte Tests siehe `web-nextjs.md` Checkliste.

### Testdaten

Testdaten pruefen/erstellen via Prisma:
```bash
# Bestehende Daten pruefen
npx tsx --eval "
  import 'dotenv/config';
  import { PrismaClient } from './src/generated/prisma/client.js';
  const prisma = new PrismaClient();
  const tenants = await prisma.tenant.findMany({ select: { slug: true, status: true } });
  const forms = await prisma.form.findMany({ select: { slug: true, status: true, tenant: { select: { slug: true } } } });
  console.log('Tenants:', tenants);
  console.log('Forms:', forms);
  await prisma.\$disconnect();
"
```

Falls keine Testdaten vorhanden: Seed-Script anlegen oder ueber pgAdmin (xpgad.fillqr.de) manuell einfuegen.

### tRPC-Endpoints testen

tRPC Query-Procedures (GET) erwarten den Input als URL-encoded superjson:

```bash
# Format: input={"json":{"key":"value"}}
curl -s "http://localhost:3000/api/trpc/form.getBySlug?input=%7B%22json%22%3A%7B%22tenantSlug%22%3A%22demo%22%2C%22formSlug%22%3A%22mitglied%22%7D%7D"

# Lesbarer (node URL-Encoding):
node -e "console.log(encodeURIComponent(JSON.stringify({json:{tenantSlug:'demo',formSlug:'mitglied'}})))"
```

- **Query** (GET): `input={json:{...}}` als URL-Parameter
- **Mutation** (POST): `{json:{...}}` als Request-Body
- POST auf eine Query → 405 METHOD_NOT_SUPPORTED
- Falsches Input-Format → BAD_REQUEST (Zod-Fehler)

### DB-Rechte (fillqr_app User)

Prisma-Migrationen laufen als `postgres` (Superuser). Der App-User `fillqr_app` hat dann keine Rechte auf neue Tabellen. Nach manuellen Schema-Aenderungen oder neuen Migrationen:

```sql
-- Einmalig ausfuehren als postgres:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fillqr_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fillqr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fillqr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO fillqr_app;
```

Die `ALTER DEFAULT PRIVILEGES` sorgen dafuer, dass zukuenftige Tabellen automatisch die richtigen Rechte bekommen. Muss nur einmal ausgefuehrt werden.

---

## Deployment

### Aktuell (manuell)

```bash
# Auf dem Server
cd /opt/fillqr
git pull
docker compose up -d --build
```

### Spaeter (automatisiert)

Push nach main → Tests → Auto-Deploy (GitHub Webhook oder CI/CD).

---

## Pflichtenheft + Sprints

**WICHTIG: V1-Pflichtenheft (TASK255) und alle alten APs sind ARCHIVIERT und nicht mehr gueltig.**

**Verbindliche Quelle: Pflichtenheft V2 (TASK296)**
- Notion: https://www.notion.so/3325201971f88124a9d4d35ee9927e41
- 3 Produkte: VereinsBuddy, TrainerFeedback, MesseBuddy
- 8 Sprints (S0-S7), 64 APs (TASK297-TASK360)
- Unterseiten: VereinsBuddy, TrainerFeedback, MesseBuddy, Tenant-Architektur + DB-Modell, Betreiber-Panel, Landingpage, Ergaenzungen, Umsetzungsplan

| Sprint | Thema | Tasks | Ziel |
|--------|-------|-------|------|
| S0 | DB-Umbau + Plattform | TASK297-305 | Neues Schema, Routing, Betreiber-Panel Basis |
| S1 | VereinsBuddy Kern | TASK306-314 | Formular + Admin (ohne SEPA/Minderjaehrige) |
| S2 | VereinsBuddy Komplett | TASK315-324 | SEPA, Minderjaehrige, E-Mail, CSV, Statistiken |
| S3 | VereinsBuddy Demo | TASK325-330 | Erste verkaufbare Demo |
| S4 | TrainerFeedback | TASK331-337 | Formular + Dashboard + Demo |
| S5 | MesseBuddy | TASK338-346 | Formular + Lead-Inbox + Demo |
| S6 | Betreiber-Panel Komplett | TASK347-353 | LexOffice, Branding, Zahlungsuebersicht |
| S7 | Landingpage + Go-Live | TASK354-360 | Alles live, Werbung starten |

---

## Rechtliches (Stand: Maerz 2026)

- VereinsBuddy: 34,95 EUR/Monat (12-Monats-Vertrag)
- TrainerFeedback: 9,95 EUR/Monat (12-Monats-Vertrag)
- MesseBuddy: Preis offen
- Branding-Paket: 99 EUR einmalig
- B2B-Ausrichtung: Verbraucher (§13 BGB) ausgeschlossen
- Durchgehend Du-Form
- USt-IdNr. im Impressum (DE370438727)
- AGB + AV-Vertrag: Entwuerfe in Notion (TASK296 Unterseiten)

---

*Erstellt: 2026-02-10*
*Zuletzt aktualisiert: 2026-03-31 (S1-AP16+17: Dashboard, Mitgliederliste, Detailansicht, Status-Workflow)*
