# Newsletter-Texte und E-Mail-Gestaltung – 10.11.2026

- Popup und Anmeldeseite erklären die notwendige Bestätigung und die anschließende zweite E-Mail mit dem persönlichen Rabattcode.
- Die öffentliche API-Antwort enthält keine bedingte Formulierung mehr. Sie bleibt für neue und vorhandene Adressen gleich; bestätigte Anmeldungen erhalten weiterhin keinen zweiten Willkommenscode.
- Bestätigungs- und Willkommensmail nutzen das vorhandene Archenlicht-Logo (`/assets/archenlicht-logo.png`), Creme-/Grüntöne, eine Tabellenstruktur mit Inline-Stilen und eine vollständige Textalternative.
- Die Willkommensmail enthält einen Gruß, die Markengeschichte, den Code, Einlöseschritte und die unveränderten Rabattbedingungen. Ihr Hauptbutton führt zur Kollektion.
- Die Abmeldung steht als unterstrichener, 13 px großer Link neben Datenschutz und Impressum im Footer. Abmeldeziel und One-Click-Abmeldeheader bleiben erhalten.
- Bereits gespeicherte oder versandte Mailinhalte werden nicht nachträglich verändert.

## Prüfung

- Die 13 bestehenden Newsletter-/Mailtests bestehen (Bestätigung, Wiederholungen, Rabattberechnung und Ausschlüsse, Abmeldung, Versandfehler und Webhooks).
- Syntaxprüfung des Projekts erfolgreich.
- Isolierter Browserdurchlauf mit lokalem Shop, eigener SQLite-Datenbank und abgefangenen Resend-Anfragen: Popup → Anmeldung → E-Mail-Link → bewusste Bestätigung → Willkommensmail → Footer-Abmeldelink → Abmeldung. Der Code bleibt danach gültig.
- Beide HTML-Mails bei 320, 390 und 1440 px geprüft: Logo geladen, kein horizontaler Überlauf. HTML-Escaping und Abmeldelink in HTML/Text geprüft.
- Lokale Nachweise unter `test-results/newsletter-branding/`; keine echten Newsletter-Mails oder Bestellungen für diese Prüfung erzeugt.
- Eine Darstellungskontrolle in echten Gmail-/Outlook-/Hostinger-Postfächern ist damit nicht ersetzt.

Verkaufsfreigabe und Podbase-Auftragsfreigabe gehören nicht zu dieser Änderung.
