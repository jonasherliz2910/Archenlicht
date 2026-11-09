# Administration und Kundenübersicht

Die Shop-Verwaltung ist unter `/admin/kunden` erreichbar. Anmeldung erfolgt über `/konto` mit dem ausdrücklich eingerichteten Administratorkonto `info@archenlicht.de`. Nach der Anmeldung wird dieses Konto direkt zur Verwaltung geführt. Startzugangsdaten liegen ausschließlich lokal in der ausgeschlossenen Datei `.tools/admin-zugang.txt` und werden nicht veröffentlicht oder per E-Mail verschickt.

## Sichtbare Kundendaten

- Zusammengeführte Kontakte aus Kundenkonten, Gastbestellungen und Newsletter-Anmeldungen, mit Suche nach Name/E-Mail, Filtern und 25 Kontakten pro Seite.
- Aktuell gespeicherte Lieferadresse, Name, Telefonnummer und E-Mail; letzte Bestelladresse sowie historische Adressen je Bestellung.
- Alle zugehörigen Bestellungen mit Betrag, Zahlungs-/Bestellstatus und Link zur bestehenden Bestellansicht mit Artikeln, Gestaltung und Versandstatus.
- Newsletter-Status und Zeitpunkte von Anmeldung, Bestätigung und Abmeldung.

Bestellungen mit einem Kundenkonto werden dem Konto zugeordnet, auch wenn die Liefer-E-Mail abweicht. Gastbestellungen werden anhand ihrer Bestell-E-Mail gruppiert. Diese Zusammenführung gilt ausschließlich für die Adminansicht: Sie gewährt normalen Kunden keinen zusätzlichen Zugriff auf Gastbestellungen oder fremde Konten.

Die Übersicht ist lesend. Passwörter, Passwort-Hashes, Sitzungstoken, Bestell-Zugriffstoken, Newsletter-Token und private Rabattcodes werden nicht ausgeliefert. Vollständige Kartendaten werden vom Shop ohnehin nicht gespeichert. Es gibt keine öffentliche Funktion zum Ernennen von Administratoren; die Registrierung erstellt stets ein Kundenkonto.

## Zugangsschutz

Jeder `/api/admin/`-Aufruf prüft serverseitig die aktuelle Datenbankrolle. Eine Rollenänderung gilt damit auch für bereits bestehende Sitzungen. Private Antworten sind `no-store`. Die Adminoberfläche liefert unangemeldeten Besuchern keine Kundendaten.

Zusätzlich zum bestehenden Sitzungslimit begrenzen kurzlebige Datenbankzähler Anmeldeversuche über neue Browsersitzungen und Serverinstanzen hinweg. Es werden nur gehashte Kennungen gespeichert, keine IP-Adressen im Klartext.

Unter `/admin/sicherheit` kann der Administrator sein Passwort ändern. Erforderlich sind das aktuelle Passwort und mindestens zwölf Zeichen für das neue. Der Server rotiert Sitzung und CSRF-Token und beendet andere Anmeldungen dieses Kontos. Die Datenbank speichert nur den bestehenden scrypt-Passwort-Hash. Ein paralleler, bereits laufender Login wird gegen den aktuellen Hash geprüft, damit ein zurückgesetztes Passwort keine neue Sitzung mehr eröffnen kann.

Das frühere Administratorkonto `jonas@archenlicht.test` wird bei der Einrichtung auf Kundenrechte zurückgesetzt; vorhandene Kundendaten und Bestellungen bleiben erhalten. Für neue Serverinstanzen verweist `ADMIN_EMAIL` in Vercel Production auf `info@archenlicht.de`. Das Bootstrap-Passwort überschreibt keine bestehende Anmeldung und keine spätere Passwortänderung.

## Prüfung

`tests/admin-customers.test.js` deckt Gäste, normale Kunden, manipulierte Rollen, falsche Adminpasswörter, Entzug von Adminrechten bei bestehenden Sitzungen, Passwortwechsel, CSRF, Sitzungswiderruf, Ratenbegrenzung, Geheimnisfilterung, Gruppierung, Pagination, Suche und HTML-Escaping ab. Die bestehenden Konten- und Kaufwegtests bleiben aktiv.

Zusätzlich: Neon-Prüfung in einem isolierten, anschließend gelöschten Testschema, einschließlich Suche, Gastdetails, Passwortwechsel und Serverneustart. Browserprüfung mit fiktiven Kundendaten bei 320, 390 und 1440 Pixeln; Belege ausschließlich unter `test-results/admin-browser/`. Keine realen Zahlungen, Druckaufträge oder E-Mails durch diese Prüfungen.
