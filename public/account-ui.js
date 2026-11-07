const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function recipientFields(address = {}, email = '') {
  return `<div class="form-grid">
    <label class="span-two">Vollständiger Name<input name="name" required autocomplete="name" maxlength="150" value="${esc(address.name)}" placeholder="Vor- und Nachname"></label>
    <label class="span-two">E-Mail-Adresse<input type="email" name="email" required autocomplete="email" value="${esc(address.email || email)}" placeholder="du@beispiel.de"></label>
    <label class="span-two">Telefonnummer mit Landesvorwahl<input type="tel" name="phone" required autocomplete="tel" value="${esc(address.phone)}" placeholder="+4915112345678"><small>Für die Lieferung erforderlich.</small></label>
    <label class="span-two">Straße und Hausnummer<input name="street" required autocomplete="street-address" maxlength="180" value="${esc(address.street)}" placeholder="Musterstraße 12"></label>
    <label>Postleitzahl<input name="postalCode" required pattern="[0-9]{5}" inputmode="numeric" autocomplete="postal-code" maxlength="5" value="${esc(address.postalCode)}" placeholder="10115"></label>
    <label>Ort<input name="city" required autocomplete="address-level2" maxlength="180" value="${esc(address.city)}" placeholder="Berlin"></label>
    <label class="span-two">Land<select name="country" autocomplete="country"><option value="DE">Deutschland</option></select></label>
  </div>`;
}

export function cardLabel(card) {
  const brands = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', unionpay: 'UnionPay', jcb: 'JCB' };
  return `${card.simulated ? 'Demo-Karte · ' : ''}${brands[card.brand] || 'Karte'} ···· ${card.last4} · ${String(card.expMonth).padStart(2, '0')}/${card.expYear}`;
}

export function accountSettings({ address, email, cards, cardsError, hasPreviousOrder, simulated }) {
  return `<div class="account-settings">
    <section class="account-settings-card">
      <h2>Deine gespeicherten Lieferdaten</h2>
      <p>${address ? 'Diese Angaben füllen wir bei deiner nächsten Bestellung vor. Du kannst sie hier ändern oder entfernen.' : 'Speichere deine Lieferdaten freiwillig, damit du sie beim nächsten Einkauf nicht noch einmal eingeben musst.'}</p>
      ${!address && hasPreviousOrder ? '<button type="button" class="button secondary use-last-address" data-action="use-last-address">Daten aus meiner letzten Bestellung übernehmen</button><p class="field-help">Danach kannst du die Angaben prüfen und mit „Lieferdaten speichern“ übernehmen.</p>' : ''}
      <form id="account-address-form">
        ${recipientFields(address || {}, email)}
        <div class="form-error" role="alert"></div>
        <div class="account-settings-actions"><button type="submit" class="button primary">Lieferdaten speichern</button>${address ? '<button type="button" class="text-button" data-action="remove-address">Gespeicherte Lieferdaten entfernen</button>' : ''}</div>
      </form>
    </section>
    <section class="account-settings-card">
      <h2>Deine gespeicherten Karten</h2>
      <p>Karten werden bei Stripe hinterlegt und im sicheren Zahlungsfenster wieder angeboten. Kartennummer und Prüfnummer werden im Shop nicht gespeichert.</p>
      ${cardsError ? `<p class="form-error" role="alert">${esc(cardsError)}</p>` : cards.length ? `<ul class="saved-cards">${cards.map(card => `<li><span>${esc(cardLabel(card))}</span><button type="button" class="text-button" data-remove-card="${esc(card.id)}" aria-label="${esc(cardLabel(card))} entfernen">Entfernen</button></li>`).join('')}</ul>` : '<p class="no-saved-cards">Noch keine Karte gespeichert. Bei deiner nächsten Kartenzahlung kannst du das freiwillig auswählen.</p>'}
      ${simulated ? '<p class="test-source">Lokaler Testbetrieb: Gespeicherte Karten sind ausschließlich gekennzeichnete Demo-Karten.</p>' : '<p class="field-help">Du entscheidest im Stripe-Checkout, ob eine neue Karte gespeichert wird. Jede weitere Zahlung bestätigst du selbst.</p>'}
    </section>
  </div>`;
}

export function localCardOptions(cards) {
  return `<div class="local-card-options">
    ${cards.length ? `<label for="local-card-choice">Welche Demo-Karte möchtest du verwenden?</label><select id="local-card-choice">${cards.map(card => `<option value="${esc(card.id)}">${esc(cardLabel(card))}</option>`).join('')}<option value="new">Eine neue Demo-Karte verwenden</option></select>` : '<p>Für diesen Test verwenden wir eine Demo-Visa mit der Endung 4242.</p>'}
    <label class="save-choice" id="save-card-choice" ${cards.length ? 'hidden' : ''}><input id="save-card" type="checkbox" ${cards.length ? 'disabled' : ''}><span>Demo-Karte für spätere Einkäufe speichern<small>Freiwillig. Du kannst sie später in deinem Kundenkonto entfernen.</small></span></label>
  </div>`;
}
