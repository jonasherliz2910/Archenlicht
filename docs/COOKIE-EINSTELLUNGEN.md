# Cookie-Auswahl

Stand: 10. November 2026.

Das Fenster wird unabhängig vom Shop-Bootstrap aus dem HTML gestartet. Ohne gültige gespeicherte Entscheidung erscheint es sofort. Datenschutz und Impressum bleiben ohne Auswahl lesbar. Bei anschließender Navigation in den Shop erscheint das Fenster wieder. Beide Hauptaktionen sind gleich gestaltet; Statistik ist nicht vorausgewählt. Escape entspricht „Nur notwendige“. Der Link „Cookie-Einstellungen“ im Footer und in der Datenschutzerklärung öffnet die Auswahl erneut.

`archenlicht_consent` enthält Version, Auswahl und Zeitpunkt, keine Nutzerkennung. Das Cookie gilt 180 Tage, mit Path=/, SameSite=Lax und Secure auf HTTPS. Fehlende, ungültige, abgelaufene oder unbekannte Fassungen erlauben keine Statistik. Die Auswahl wird erst bei einer Aktion gespeichert. Der Newsletter wird erst sechs Sekunden nach einer gespeicherten Entscheidung angeboten und überlagert das Cookie-Fenster nicht.

Der Server prüft die aktuelle Entscheidung bei jeder API-Anfrage. Eine technisch notwendige Sitzung allein erzeugt keinen Statistikbesuch. Ohne Einwilligung speichert er keine Ansichts- oder Warenkorbereignisse und verknüpft Bestellungen und Feedback nicht mit Statistikbesuchen. Erforderliche Bestellunterlagen und betriebliche Summen bleiben davon unabhängig. Nach Widerruf werden keine weiteren Ereignisse erfasst; eine spätere Zustimmung beginnt eine neue Besuchskennung. Bestehende rechtmäßig erhobene Daten werden durch den Widerruf nicht rückwirkend gelöscht.

`POST /api/privacy/consent` benötigt die normale CSRF-Prüfung. Die Auswahl stammt aus dem Cookie, nicht aus einem ungeprüften Statistik-Schalter im Request-Body. Der Aufruf gleicht eine während des Bootstraps getroffene Entscheidung ab. Herkunft und Kampagne werden nur nach Einwilligung übernommen und serverseitig begrenzt.

Prüfung: `tests/cookie-consent.test.js` deckt Standard-Ablehnung, explizite Zustimmung, Ablauf, ungültige Werte, Widerruf, Sitzungswechsel bei Anmeldung und Checkout ohne Statistik ab. Die bestehende Kaufwegprüfung erteilt für ihre Statistik-Assertions ausdrücklich Zustimmung. Lokale Browserprüfung bei 320, 390, 768, 844 und 1440 Pixeln: Fenster vor Laden von app.js, Erinnerung, Einstellungen, Newsletter-Reihenfolge, Widerruf und frei erreichbare Rechtstexte.

Gestaltungsgrundlagen: [LfDI Baden-Württemberg – FAQ zu Cookies und Tracking](https://www.baden-wuerttemberg.datenschutz.de/faq-zu-cookies-und-tracking-2/) und [Hessischer Datenschutzbeauftragter – Häufig gestellte Fragen zu Cookies](https://datenschutz.hessen.de/datenschutz/internet-und-medien/haeufige-fragen-zu-cookies). Es werden keine zusätzlichen Analyse- oder Marketinganbieter eingebunden.
