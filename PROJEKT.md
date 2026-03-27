# fillQR - Projekt-Dokumentation

> QR-Code-basierte Datenerfassung als SaaS Multi-Tenant Abo-Produkt.

---

## Quick Info

| Aspekt | Wert |
|--------|------|
| **Status** | Relaunch (Sprint 0 Infrastruktur fertig) |
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
- Eigene App-Auth (E-Mail + Passwort, session-/cookie-basiert)
- Rollen: owner, admin, editor

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
| xpgad.fillqr.de | Caddy → pgadmin:80 | pgAdmin (IP-Whitelist: nur Jacky) |
| *.fillqr.de | Caddy → Next.js App:3000 | Oeffentliche Formulare je Tenant |

**Tenant-Routing:** Next.js App liest Subdomain aus Request-Header → tenant_id aus DB. Wildcard-DNS + Wildcard-TLS (Cloudflare DNS-Challenge). ERP Buddy bleibt Betreiber-/Firmenseite, nicht Kundenportal.

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

### V1-Kernobjekte (werden mit AP-07 angelegt)

| Modell | Zweck |
|--------|-------|
| tenant | Mandant (Kunde) |
| app_user | Admin-Benutzer pro Tenant |
| form | Formular-Definition |
| form_field | Felder pro Formular |
| submission | Einsendung |
| audit_log | Aenderungsprotokoll |

Submission-Speicherung: relational (submission_value) oder pragmatisch (payload_json) — Entscheidung in AP-07. Kein Mischmodell ohne klare Begruendung. Pragmatische, wartbare Loesung wichtiger als akademische Perfektion.

### Formularsystem V1

V1 ist kein offener Form-Builder, sondern ein begrenzter Formularbaukasten.

Erlaubte Feldtypen: text, textarea, email, phone, select, checkbox, date

Nicht in V1: beliebig verschachtelte Bedingungen, Regel-Builder, komplexe Mehrseiten-Formulare, dynamische Felder mit Logik-Editor, freie Low-Code-Form-Engine.

### Submission-Status

- new
- in_review
- done
- archived

### Tenant-/Plan-Status

- draft
- trial
- active
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

## Sprints und Fortschritt

| Sprint | Thema | APs | Status |
|--------|-------|-----|--------|
| 0 | Scope und Infrastruktur | AP-00, AP-01, AP-02, AP-03, AP-04, AP-31 | AP-01/02/04 fertig, AP-03/31 wartet auf Cloudflare, AP-00 offen |
| 1 | Fullstack-Projektbasis | AP-05, AP-06, AP-07, AP-37 | Offen |
| 2 | Tenant- und Auth-Basis | AP-08, AP-09, AP-10, AP-28 | Offen |
| 3 | tRPC und Server-Fachlogik | AP-11, AP-12, AP-13, AP-14, AP-15 | Offen |
| 4 | Formularsystem V1 | AP-20, AP-21, AP-22 | Offen |
| 5 | Admin-App V1 | AP-16, AP-17, AP-18, AP-19 | Offen |
| 6 | Templates und Produktisierung | AP-23, AP-24, AP-25, AP-27 | Offen |
| 7 | Kommunikation und Export | AP-26, AP-30 | Offen |
| 8 | Landingpage und Demo | AP-29, AP-39 | Offen |
| 9 | Plan- und Aktivlogik | AP-32, AP-33 | Offen |
| 10 | Stabilitaet und Compliance | AP-34, AP-35, AP-36, AP-38 | Offen |

---

## Rechtliches (Stand: Februar 2026)

- Preise: 34,95 EUR/Monat + 99 EUR Design (inkl. MwSt)
- B2B-Ausrichtung: Verbraucher (§13 BGB) ausgeschlossen
- Durchgehend Du-Form
- USt-IdNr. im Impressum (DE370438727)
- AVV-Hinweis vorhanden

---

*Erstellt: 2026-02-10*
*Zuletzt aktualisiert: 2026-03-27 (Architektur-Neuausrichtung: Next.js Fullstack statt NestJS+React)*
