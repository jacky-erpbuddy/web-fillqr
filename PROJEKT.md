# fillQR - Projekt-Dokumentation

> QR-Code-basiertes Mitgliedsantrags-System als SaaS Multi-Tenant Abo-Produkt.

---

## Quick Info

| Aspekt | Wert |
|--------|------|
| **Status** | Produktiv (Landingpage) / Development (App) |
| **Version** | v2.0.0 (Landingpage) / v0.1.2 (App) |
| **Stack** | PHP, MySQL, HTML/CSS/JS |
| **Server** | Variomedia (Shared Hosting) |
| **Domains** | fillqr.de (Landingpage), [tenant].fillqr.de (App) |
| **Pricing** | 34,95 EUR/Monat + 99 EUR Design (inkl. MwSt) |
| **Zielgruppe** | B2B (Vereine, Restaurants) |
| **Git Repo** | jacky-erpbuddy/fillqr-landingpage (TODO: umbenennen zu fillqr) |
| **Git Branch** | master |

---

## Beschreibung

fillQR ermoeglicht Vereinen und Organisationen, Mitgliedsantraege ueber QR-Codes digital zu erfassen.
Mitglieder scannen einen QR-Code, fuellen ein Online-Formular aus, und der Verein verwaltet die Antraege ueber ein Admin-Backend.
Multi-Tenant-faehig: Jeder Verein hat seine eigene Subdomain und Konfiguration.

---

## Domain-Mapping

| Domain | Ziel | Beschreibung |
|--------|------|--------------|
| fillqr.de | landing/public/ | Produktseite, Pricing, Kontaktformular |
| www.fillqr.de | → Redirect auf fillqr.de | via .htaccess RewriteRule |
| [tenant].fillqr.de | app/public/ | Mitgliedsantrag-Formular (Tenant-spezifisch) |

**Tenant-Routing:** Die App nutzt host-basierte Aufloesung (`$_SERVER['HTTP_HOST']` → `tbl_tenant_domain.host` → `tenant_id`). Jeder Verein bekommt eine eigene Subdomain.

**⚠️ Bekanntes Problem:** Die Landingpage hat als canonical URL `https://www.fillqr.de/`, aber die .htaccess leitet www → non-www um. Das muss vereinheitlicht werden (canonical auf `https://fillqr.de/` aendern).

---

## Repo-Struktur

```
fillqr/                          ← Git Root (Branch: master)
├── PROJEKT.md                   ← DU BIST HIER
├── .gitignore
├── .env.example
│
├── landing/                     ← Landingpage (fillqr.de)
│   └── public/
│       ├── index.html           ← Produktseite, Pricing, CTA
│       ├── datenschutz.html     ← DSGVO-konform
│       ├── impressum.html       ← Rechtlich
│       ├── nutzungsbedingungen.html
│       ├── robots.txt           ← SEO
│       ├── sitemap.xml          ← SEO
│       ├── .htaccess            ← HTTPS, www→non-www, Security Headers
│       ├── api/contact.php      ← Kontaktformular-Handler
│       ├── css/style.css
│       ├── js/main.js
│       └── images/favicon.png
│
├── app/                         ← PHP-App ([tenant].fillqr.de)
│   ├── fillqr_changelog.txt     ← Aelteres Changelog
│   ├── public/
│   │   ├── index.php            ← Mitgliedsantrag-Formular (Tenant-spezifisch)
│   │   ├── submit.php           ← Formular-Verarbeitung + DB-Insert
│   │   ├── thanks.html          ← Danke-Seite
│   │   ├── .htaccess            ← Basic Auth (Passwortschutz waehrend Dev)
│   │   ├── assets/css/base.css  ← App-Styling
│   │   ├── uploads/             ← Datei-Uploads (gitignored, .gitkeep)
│   │   └── admin/
│   │       ├── index.php        ← Antrags-Liste (pro Verein)
│   │       ├── detail.php       ← Antrags-Details
│   │       ├── .htaccess        ← Admin-Schutz
│   │       └── update_status.php
│   └── src/
│       ├── config.php           ← DB-Credentials (gitignored!)
│       ├── config.example.php   ← Template fuer config.php
│       ├── app.php              ← Geschaeftslogik, Helper-Funktionen
│       └── tenant.php           ← Multi-Tenant Logik (Host → tenant_id)
│
├── bugs/                        ← (leer, Scaffolding)
├── docs/                        ← (leer, Scaffolding)
├── features/                    ← (leer, Scaffolding)
└── src/                         ← (leer, Scaffolding)
```

---

## Deployment

### Landingpage (fillqr.de)

```bash
cd c:/ERPBuddy/web/fillqr/landing/public
scp index.html datenschutz.html impressum.html nutzungsbedingungen.html variomedia:~/fillqr/landing/public/
scp css/style.css variomedia:~/fillqr/landing/public/css/
scp js/main.js variomedia:~/fillqr/landing/public/js/
scp robots.txt sitemap.xml variomedia:~/fillqr/landing/public/
```

### PHP-App ([tenant].fillqr.de)

```bash
cd c:/ERPBuddy/web/fillqr/app
# ACHTUNG: config.php NICHT deployen (liegt nur auf Server)
scp public/*.php variomedia:~/fillqr/app/public/
scp public/admin/*.php variomedia:~/fillqr/app/public/admin/
scp src/app.php src/tenant.php variomedia:~/fillqr/app/src/
scp public/assets/css/base.css variomedia:~/fillqr/app/public/assets/css/
```

---

## Datenbank (MySQL bei Variomedia)

### Wichtige Tabellen

| Tabelle | Zweck |
|---------|-------|
| tbl_tenant | Vereins-Stammdaten, Logo, Config |
| tbl_tenant_domain | Domain-Mapping pro Tenant (host → tenant_id) |
| tbl_membership_type | Mitgliedstypen pro Tenant (code, label, price) |
| tbl_application | Mitgliedsantraege |
| tbl_application_event | Event-Log (Statuswechsel, Warnungen) |
| tbl_app_user | Admin-Benutzer (geplant) |

### Antrags-Status-Flow

```
NEW → REVIEWED → EXPORTED → ARCHIVED
```

---

## Offene Punkte

### Erledigt
- [x] Serverseitige Validierung (Pflichtfelder, Fehlermeldungen)
- [x] Geschaeftsregeln (Alter, Minderjahrige, SEPA, Eintrittstermin)
- [x] Warn-Flags Grundstruktur

### Offen - Admin Backend
- [ ] Statuswechsel (NEW/REVIEWED/EXPORTED/ARCHIVED)
- [ ] Filter und Suche in Admin-Liste
- [ ] Warnungen im Admin anzeigen

### Offen - Sicherheit
- [ ] Login ueber tbl_app_user (E-Mail + Passwort)
- [ ] Rechte und CSRF-Tokens
- [ ] Rate-Limiting

### Offen - Multi-Tenant Cockpit
- [ ] Cockpit-Grundseite (alle Tenants uebersicht)
- [ ] Onboarding-Formular (neuen Verein anlegen)

### Offen - Komfort
- [ ] Branding je Verein (Logo, Farben)
- [ ] Foto-Upload (Mitgliedsbild)

### Offen - Infrastruktur
- [ ] Git Repo umbenennen: fillqr-landingpage → fillqr
- [ ] Canonical URL in index.html fixen (www → non-www)
- [ ] Doppelte resolveTenantId Funktion in tenant.php bereinigen

---

## Bekannte Code-Issues

| Problem | Datei | Beschreibung |
|---------|-------|--------------|
| Doppelte Funktion | app/src/tenant.php | `resolveTenantIdByHost()` (ohne PDO) und `resolveTenantId()` (mit PDO) — gleiche Logik, unterschiedliche Signaturen |
| Canonical URL | landing/public/index.html | `www.fillqr.de` als canonical, aber .htaccess leitet www→non-www |

---

## Rechtliches (Stand: Februar 2026)

- Preise: 34,95 EUR/Monat + 99 EUR Design (inkl. MwSt)
- B2B-Ausrichtung: Verbraucher (§13 BGB) ausgeschlossen
- Durchgehend Du-Form
- USt-IdNr. im Impressum (DE370438727)
- AVV-Hinweis vorhanden
- TMG → DDG, TTDSG → TDDDG (Gesetzesaenderung Mai 2024)

---

## Credentials

| Name | Typ | Wo |
|------|-----|----|
| MySQL DB | DB-Login | app/src/config.php (nur auf Server, gitignored) |
| reCAPTCHA | Site Key | app/src/config.php |
| SMTP | E-Mail-Versand | app/src/config.php (geplant) |
| Basic Auth | .htpasswd | Server: /homepages/u77196/fillqr/.htpasswd |

---

*Erstellt: 2026-02-10*
*Zuletzt aktualisiert: 2026-03-09*
