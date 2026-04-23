# fillQR Trigoon — Kundenprojekt

## Ueberblick

Digitale Mitgliederloesung fuer den Verein Trigoon auf Basis des fillQR-Produkts.
Einmalprojekt (kein Abo), dient gleichzeitig als Pilotumsetzung fuer spätere Vereinsloesungen.

## Eckdaten

| Was | Wert |
|-----|------|
| Kunde | Verein Trigoon |
| Preis | 1.100 EUR einmalig |
| Optional | Website-Ueberarbeitung 500 EUR separat |
| Nachbetreuung | 2 Monate inkl. |
| Hosting | STRATO (Vereins-eigenes Hosting) |
| Subdomain | mitglied.trigoon.de |
| Admin | mitglied.trigoon.de/admin |
| Tech | PHP, MySQL/MariaDB, SFTP/SSH |
| Basis | Bestehender fillQR-Entwicklungsstand |
| Datenquelle | JTL-Wawi (Import) |

## Notion

- Projekt-Select: `fillQR Trigoon`
- Lastenheft: TASK204 (`32952019-71f8-8189-8d71-d19bf0eb1e9e`)
- APs: TASK205-TASK217 (AP-01 bis AP-13)
- Alle APs verlinkt via Uebergeordnet auf Lastenheft

## Abgrenzung zu fillQR (Produkt)

- fillQR = SaaS-Produkt (Abo-Modell, eigenes Hosting)
- fillQR Trigoon = Einmal-Kundenprojekt (auf STRATO des Kunden)
- Gleiche Codebasis, aber Trigoon-spezifisches Branding + Konfiguration
- Repo bleibt `web/web-fillqr` (kein separates Repo)

## Projektumfang

### Enthalten
- Einrichtung auf STRATO (Subdomain + SSL + DB)
- Oeffentliches Online-Formular (Mitgliedsantrag)
- Admin-Bereich mit Login + 2FA
- CSV-Import / CSV-Export
- Mitgliederuebersicht + Statusverwaltung (aktiv/passiv)
- E-Mail-Benachrichtigungen
- Branding-Anpassung im Stil von Trigoon
- Liveschaltung + 2 Monate Nachbetreuung

### Nicht enthalten
- Vollwertige Mitgliederverwaltung mit Rollen-/Rechtesystem
- Mehrere Benutzerrollen
- Komplexe SEPA-Pruefung
- Dauerhafte Wartung ueber 2 Monate hinaus
- Rechtliche Beratung
- Website-Neuentwicklung (separat)

## Arbeitspakete

| AP | Titel | Wer | Status |
|----|-------|-----|--------|
| 01 | Projektfreigabe und kaufmaennische Grundlage | Jacky | Offen |
| 02 | Datenschutz und formale Absicherung | Jacky | Offen |
| 03 | Lexoffice vorbereiten | Jacky | Offen |
| 04 | Angebot / Auftrag schriftlich fixieren | Jacky | Offen |
| 05 | STRATO-Basis vorbereiten | CC | Offen |
| 06 | Datenbank einrichten | CC | Offen |
| 07 | Anwendung von Dev nach STRATO umziehen | CC | Offen |
| 08 | Funktionspruefung und technische Haertung | CC | Offen |
| 09 | Fachliche Pruefung mit Trigoon | Jacky | Offen |
| 10 | Datenmigration / Import | CC | Offen |
| 11 | Liveschaltung | CC | Offen |
| 12 | Nachbetreuung / Feinjustierung (2 Monate) | CC | Offen |
| 13 | Optionale Website-Ueberarbeitung | CC | Offen |

## Risiken

- Nicht als vollstaendige Mitgliederverwaltung verkaufen
- Importformat (JTL-Wawi) fruehzeitig pruefen
- Keine offenen Admin-Links oeffentlich verteilen
- Sensible Zugangsdaten sauber dokumentieren
- 2FA einbauen (zugesagt)
- Website-Ueberarbeitung klar separat halten
- Nachbetreuung inhaltlich begrenzen
