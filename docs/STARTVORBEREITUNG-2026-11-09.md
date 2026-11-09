# Startvorbereitung: Original-Druckdateien und Zahlungsadapter

## Umgesetzt und geprüft

- `scripts/import-podbase-templates.py` extrahiert Sicherheits- und Kamerakurven
  aus der offiziellen PSD und gleicht sie mit den Varianten-IDs der
  Printanforderungen ab. 63 Modelle sind vollständig zugeordnet. Quellen und
  Prüfsummen stehen in `server/podbase-print-templates.json`.
- `PRINT_MODE=podbase` erzeugt vollflächige 2000 × 3400-PNG-Dateien mit 300 dpi.
  Texte bleiben Schriftpfade; Motive werden proportional übertragen und nie
  gegenüber der bisherigen Gestaltung vergrößert. Bei Bedarf wird die Gruppe
  gemeinsam in die freie Fläche verschoben/verkleinert; nicht passende
  Gestaltungen werden abgewiesen.
- Jeder sichtbare Motiv-/Schriftpixel wird gegen die Originalkurven geprüft,
  mit 45 Pixeln zusätzlichem Abstand. Bei rasterbasierten Kameramasken wird
  konservativ deren vollständiger Begrenzungsrahmen ausgeschlossen.
- Die Hüllenansicht zeigt einen Ausschnitt derselben gespeicherten Druckdatei.
  Die Außenform bleibt schematisch. Druckfarbe, Material und tatsächliche
  Passform sind dadurch nicht physisch bestätigt.
- 504 Modell-/Motiv-/Textkombinationen bestanden die Prüfung. PNG-Format,
  durchgehend deckender Hintergrund, unveränderter Drucktext, Warenkorb und
  Bestellsnapshot sind getestet. Browserprüfung bei 390 und 1440 Pixeln bestanden.
- Der Stripe-Adapter unterstützt getrennte Test-/Live-Schlüssel, Kunden und
  Modusprüfungen. Der Shop selbst sperrt Livebetrieb weiterhin; keine echte
  Checkout-Session wurde hierfür angelegt.
- Der vorbereitete Podbase-Adapter erlaubt ausschließlich den offiziellen
  API-Host und keine Weiterleitungen. Die Produktions-Payload-Prüfung verlangt
  einen bezahlten Liveauftrag, passende Varianten-/Vorlagen-IDs und die öffentliche
  PNG-Druckdatei. Testfälle arbeiten ausschließlich mit lokalen Providerantworten.

## Derzeitige Sperren und weitere Arbeit

1. Stripe zeigt im Livekonto „Mehrere Funktionen ausgesetzt“ und eine überfällige
   Pflichtaufgabe. Jonas öffnet „Aufgabe anzeigen“. Die Kontoinhaber müssen die
   verlangten Angaben direkt bei Stripe vervollständigen. Der Live-Schlüssel
   und ein Live-Webhook stehen noch aus. Keine Geheimnisse im Chat speichern.
2. Der Server verwendet weiterhin `SHOP_MODE=test`, Stripe-Sandbox,
   `LocalPodbase` für Aufträge und begrenzten Resend-Testversand. Diese Sperren
   müssen im zusammenhängenden Live-Kaufweg ersetzt werden, einschließlich
   Modustrennung für Bestellungen, Webhooks, Hintergrundjobs und E-Mails.
3. Die Originalunterlagen sind für elf Modelle unvollständig: Pixel 10a;
   iPhone 17, 17e, 18 Pro, 18 Pro Max; Galaxy S26 FE, A27, Z Flip8;
   Pixel 11, 11 Pro und 11 Pro XL. Keine ähnliche Druckvorlage wird ersatzweise
   angenommen. Die Fehlgründe stehen in der Vorlagendatei.
4. Versandkosten, Produktionskosten, realer Trackingablauf und Kartenbeilage
   sind noch nicht abgenommen. Kein kostenpflichtiges Muster wurde bestellt.
5. Rechtsseiten, Online-Widerrufsfunktion, Kontowiederherstellung,
   dauerhafte Anmeldebegrenzung, Daten-/Umgebungstrennung, häufige Workerläufe,
   Backup/Wiederherstellung und kommerziell geeigneter Hostingtarif bleiben
   gemäß `LIVE-CHECKLISTE.md` offen.

## Primärquellen

- [Podbase API-Integration](https://help.podbase.com/hc/en-us/articles/26709382744604-Podbase-API-integration-guide)
- [Podbase Druckanforderungen](https://help.podbase.com/hc/en-us/articles/26709497957532-How-to-prepare-print-files-for-Podbase-API)
- [Stripe Go-live-Prüfung](https://docs.stripe.com/get-started/checklist/go-live)

Die Vorbereitung ist keine Behauptung einer abgeschlossenen Verkaufsfreigabe.
