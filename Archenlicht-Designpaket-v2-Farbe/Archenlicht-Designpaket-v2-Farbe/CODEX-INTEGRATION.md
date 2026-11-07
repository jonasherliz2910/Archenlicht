# Archenlicht: sechs Motive integrieren

## Dateien und Verwendung
Dieses Paket in VS Code öffnen oder in einen separaten Unterordner des Shop-Projekts kopieren. Nicht index.html über die Shop-Startseite kopieren! Die beigefügte Seite ist nur eine eigenständige Layoutdemo.

Vorschau starten: Im Terminal dieses Ordners `node serve.mjs` ausführen und http://127.0.0.1:4178 öffnen. Node.js wird benötigt. Beenden mit Strg+C.

assets/ enthält die sechs unveränderten PNG-Blankomotive (962 × 1635 Pixel). Illustration und heller Hintergrund sind in diesen Dateien zusammengefügt; es sind keine freigestellten oder mehrschichtigen Produktionsmaster. designs.json enthält Motivnamen, feste Versstellen und vorläufige normierte Textflächen. renderer.js enthält den gemeinsamen Textumbruch und die Größenanpassung. fonts/ enthält Caveat und die mitgelieferte Lizenz.

## Auftrag an Codex
1. Bestehende Projektregeln, Produktdaten und Rendering-Funktionen zuerst prüfen. Dieses Paket in die bestehende Architektur integrieren; keine zweite unabhängige Warenkorb- oder Bestelllogik anlegen.
2. Feste Produkte verwenden die im Katalog hinterlegte Versstelle. Personalisierte Produkte verwenden denselben Motivdatensatz mit geprüfter Versstelle, optionalem freigegebenem Originalauszug und separater Widmung. Produktnamen und Logo niemals auf die Hülle setzen.
3. Text nicht in das Grundmotiv einbacken. Gewählten Motivschlüssel, Layoutversion, Schriftversion, Versstelle, exakten Auszug und Widmung strukturiert speichern. Persönliche Situationsbeschreibungen des KI-Beraters niemals übernehmen.
4. Die Layoutboxen sind normierte Vorschläge für die vorhandene Leinwand. Schriftgrößen beziehen sich auf 962 Pixel Breite. Nicht unverändert als Freigabe für sämtliche Handymodelle verwenden. Freie Textbereiche und die vorhandenen Zweige beachten.
5. Lange Texte umbrechen und nur bis zur definierten Mindestschriftgröße verkleinern. Wenn sie danach nicht passen, Auswahl/Kürzung verlangen. Niemals abschneiden, beliebig winzig setzen oder Bibelzitate automatisch umformulieren. Für feste Referenzen eine Zeile; Auszüge maximal drei Zeilen; Widmungen eine Zeile. Textmessung mit tatsächlich geladener identischer Schrift durchführen. Kein stiller Font-Fallback.
6. Für jedes tatsächlich verfügbare Podbase-Tough-Modell Kamerabereich, Beschnitt, sichere Flächen, physische Mindestschriftgröße und Druckabmessungen anhand der offiziellen Vorlage verifizieren. Geprüfte modellbezogene Layouts versionieren. Fehlende Modellvorlage bedeutet keine Bestellfreigabe. Kein blindes Strecken.
7. Vor Produktion hochauflösende geeignete Motive beschaffen/aufbereiten und prüfen. Ein Hochskalieren dieser Vorschauen auf 2000 × 3400 erzeugt keine zusätzlichen Bilddetails. Allgemeine Podbase-Richtwerte ersetzen nicht die konkrete Modellvorlage. productionApproved bleibt false, bis alle Prüfungen abgeschlossen sind.
8. Im echten Shop serverseitig aus dem autoritativen Motiv/Text/Layout-Datensatz rendern. Den gleichen finalen Entwurf für Kundenvorschau und Druckexport verwenden; Darstellung mit tatsächlicher Modellmaske. Die Browserdemo ist eine Referenz, kein verbindlicher Produktionsrenderer. Keine vom Browser manipulierte Druckdatei ungeprüft an Podbase senden.
9. Feste Kollektion und Personalisierung mit kurzen/langen Referenzen, Umlauten, langen Wörtern, dreizeiligen Auszügen und Widmungen prüfen. Überlauf muss Kauf verhindern und Bearbeitung ermöglichen. Nach Layoutänderungen bereits bestellte Druckdateien nicht verändern.

## Abnahme
- Alle sechs Motive sind auswählbar und die festen Versstellen korrekt zugeordnet.
- Wunschvers ersetzt die feste Versstelle vollständig; kein alter Text bleibt sichtbar.
- Vorschau, Warenkorb und finaler Export verwenden dieselben Inhalte und Positionen.
- Schrift und Linien sind in physischer Druckgröße lesbar; kein Text liegt über Dekorzweigen oder Kameraausschnitten.
- Kein Produktionsstatus allein aufgrund der beigefügten Demo. Modellprüfung und reale Druckmuster stehen noch aus.

Das Paket wurde als lokale Übergabe erstellt. Es ist noch nicht in den bestehenden Shop eingebaut.
