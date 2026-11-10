# Archenlicht: Informationsseiten und Widerrufsfunktion

Stand: 10. November 2026. Technisch umgesetzt und getestet; keine anwaltliche Freigabe. Checkout und Podbase-Auftragsübergabe bleiben geschlossen.

Veröffentlicht: Code-Commit `3230e00`, Deployment `dpl_5SbSvPLyJ53Uz8H2iLhMWuKB6iYf`, https://archenlicht-a0pioj4bh-jonas-4eb6.vercel.app, auf https://www.archenlicht.de hochgestuft. 11 geschützte Deployment-Prüfungen bestanden, anschließend 10 öffentliche Browserprüfungen bei 390/1440 Pixeln. Öffentlich ausgelieferte Textquelle stimmt mit dem Commit überein; kein Telefonlink im Impressum, Checkout und Produktionsübergabe weiterhin geschlossen. Bei diesen Prüfungen wurden keine Widerrufserklärungen oder echten E-Mails ausgelöst.

## Bestätigte Entscheidungen

- Anbieter: Herzly Marketing GbR, vertreten durch Julian Isaak und Laura Herliz, Stettiner Straße 27, 36251 Bad Hersfeld. Archenlicht ist das Shopangebot dieses Betreibers.
- Kundenkontakt: info@archenlicht.de. Der Nutzer hat seine vorherige Freigabe zur Veröffentlichung seiner privaten Telefonnummer zurückgenommen. Deshalb ist `OPERATOR.phone` leer; keine Ersatznummer ohne Auftrag verwenden.
- Rücksendeadresse: Geschäftsanschrift oben. Kunde trägt bei normalem Widerruf die unmittelbaren Rücksendekosten. Mängelrechte bleiben unberührt.
- Lieferfrist: 5–10 Werktage, Montag bis Freitag, ausgenommen gesetzliche Feiertage; einschließlich Fertigung und Versand, ab dem Tag nach Vertragsschluss. Vom Nutzer bestätigt; die tatsächliche Einhaltung durch manuelle Freigabe und Podbase bleibt betrieblich sicherzustellen.
- Kleinunternehmerregelung; keine gesonderte Umsatzsteuer. Keine USt-ID laut öffentlichem Betreiber-Impressum. Eine eventuell später zugeteilte Wirtschafts-Identifikationsnummer muss der Betreiber ergänzen.
- Kartenbeilage derzeit eine je Bestellung; mehrere Beilagen entsprechend der Hüllenanzahl sind nicht bestätigt.

## Umsetzung

- Gemeinsame versionierte Textquelle `public/legal-content.js`: Impressum, Datenschutz passend zu Vercel/Neon/Resend/Hostinger/Stripe/Podbase, AGB, Lieferung, Widerruf und Musterformular.
- Normale angebotene Modell-, Farb-, MagSafe-, Motiv- und Versvarianten werden nicht allein wegen Fertigung auf Bestellung vom Widerruf ausgeschlossen. Eigene Texte/Widmungen nur bei Vorliegen der gesetzlichen Voraussetzungen.
- `/vertrag-widerrufen`: ohne Anmeldung, Name, Vertrags-/Artikelbeschreibung und E-Mail; zweistufige Prüfung und „Widerruf bestätigen“. Keine Begründung oder zwingende Bestellnummer. Unbekannte Nummern werden nicht für Datenabfragen verwendet.
- Speicherung mit Eingangszeit, unveränderlicher Erklärung und wiederholbarer Anfragekennung. Zwei dauerhafte Mailaufträge: Eingangsbestätigung an Verbraucher, Benachrichtigung an info@archenlicht.de. Identische Resend-Schlüssel bei Wiederholung, getrennte Test-/Live-Verarbeitung. Kein automatischer Refund, kein automatischer Produktionsstopp oder Freigabeaufruf.
- Downloadbare Eingangsbestätigung im Browser. Eingänge unter `/admin/widerrufe`; neueste 100, nur Admin. Mitarbeiter müssen Zuordnung, Frist, Produktion, Rücksendung und Erstattung bearbeiten.
- Echte Bestellbestätigungen enthalten AGB/Widerruf/Musterformular als Text, HTML und Text-Anhang. Die Fassung wird schon beim Anlegen des Bestell-Mailauftrags gespeichert, nicht erst beim späteren Versand dynamisch geladen.
- Unveränderte deutsche farbige EU-Gewährleistungsmitteilung im Checkout und unter `/gewaehrleistung`; Original-SVG, lokal ausgeliefert. Kein eigenes Garantieversprechen daraus ableiten.
- Keine Änderung von Preisen, Steuerbehandlung, Zahlungsmethoden oder Produktionsfreigaben. Keine echten E-Mails, Zahlungen oder Druckaufträge bei den Entwicklungstests ausgelöst.

## Vor Verkaufsöffnung noch erforderlich

1. Öffentliche erreichbare Geschäfts-Telefonnummer: Art. 246a § 1 Abs. 1 Nr. 3 EGBGB. Eine private Nummer ist nicht erforderlich, eine reine E-Mail-Angabe reicht für den Warenfernabsatz aber nicht. Nummer in `OPERATOR` ergänzen, Textversion aktualisieren und erneut veröffentlichen. Die reguläre Live-Startkonfiguration verhindert eine Checkout-Öffnung, solange dieser Kontakt fehlt.
2. Betreiber muss die für seine Verträge geltenden Texte prüfen/freigeben; insbesondere individuelle Texte/religiöse Angaben nach Art. 9 DSGVO, Löschfristen und Verfahren, vollständige Dienstleister-Verträge/Transfergrundlagen sowie gegebenenfalls W-IdNr. und sonstige Pflichtangaben. Ein religiöses Motiv ist nicht automatisch ein Religionsprofil; die Bewertung der konkreten Verarbeitung ist offen. Es wird keine pauschale Art.-9-Einwilligung aus dem Kauf unterstellt.
3. Aktuellen abschließenden Stripe-Zahlungsschritt vor Freischaltung auf vollständige Produktmerkmale, Vertragserklärung, Pflichtinformationen und Gewährleistungshinweis prüfen. Die eigene Checkout-Seite wurde ergänzt; die rechtliche Abnahme der gesamten externen Zahlungsoberfläche steht aus.
4. Reale Muster-/Druckfreigabe, Einhaltung der Lieferzeit, GPSR-/Verpackungs-/Rechtefragen, geeigneter kommerzieller Hostingtarif und zuverlässige häufige Hintergrundverarbeitung sind weiterhin eigene Startvoraussetzungen. Der aktuelle tägliche Cron ist für schnelle Wiederholungen fehlgeschlagener E-Mails nicht ausreichend; unmittelbarer Erstversuch und dauerhafter Auftrag sind vorhanden. Fehlgeschlagene Zustellungen müssen überwacht werden.
5. Verantwortliche Person muss Widerrufseingänge im Adminbereich/Postfach bearbeiten und eine mögliche Podbase-Fertigung rechtzeitig stoppen. Die technische Eingangsbestätigung entscheidet nicht über Wirksamkeit oder Erstattung.

## Verifikation

- 21 erfolgreiche gezielte Tests für Mail, Newsletter, Livefluss und Widerruf; ein optionaler alter Neon-Live-Test übersprungen. Nach Ergänzung der Kontaktsperre betroffene Live-/Widerrufstests erneut bestanden.
- Gesonderter Test mit echtem Neon-Postgres in isoliertem, danach gelöschtem Schema: Speicherung, Neustart, unveränderte Wiederholung, zwei gemockte Mailaufträge, keine Bestellung.
- 27 Playwright-Prüfungen bei 360, 390 und 1440 Pixeln: Informationsseiten, kein horizontaler Überlauf, Gastformular → Prüfung → Änderung → Absenden → Datenbank → Download. Keine JavaScript-Fehler. Externer Mailversand im Test deaktiviert.
- Evidenz lokal unter `test-results/legal-pages/`; keine privaten Testdaten veröffentlichen.

## Quellen und Herkunft

- Betreiberangaben: https://www.herzly.de/impressum/ (abgerufen 10.11.2026); Kundenkontakt und Rücksendebedingungen ausdrücklich im Chat geändert. Den dort veralteten OS-Plattform-Link nicht übernommen.
- Informationspflichten: https://www.gesetze-im-internet.de/bgbeg/art_246a__1.html
- Elektronische Widerrufsfunktion: https://www.gesetze-im-internet.de/bgb/__356a.html
- Widerrufsmuster: https://www.gesetze-im-internet.de/bgbeg/art_253anlage_1.html?data=false
- Musterformular: https://www.gesetze-im-internet.de/bgbeg/art_253anlage_2.html
- Gesetzliche Ausnahme: https://www.gesetze-im-internet.de/bgb/__312g.html
- Anbieterpflichten: https://www.gesetze-im-internet.de/ddg/__5.html
- EU-Mitteilung: https://europa.eu/youreurope/business/selling-in-eu/consumer-contracts-guarantees/eu-legal-guarantee-notice-and-garan-label/index_en.htm
- Originalgrafik „Legal guarantee_notice DE.svg“ aus dem SVG-Paket: https://commission.europa.eu/publications/practical-guidelines-and-high-resolution-vector-files-eu-notice-and-label-product-guarantees_en
- Dienstleister: https://vercel.com/legal/dpa ; https://neon.com/platform-terms ; https://resend.com/legal/dpa ; https://www.hostinger.com/legal/privacy-policy ; https://stripe.com/de/privacy ; https://www.podbase.com/policies/privacy-policy
