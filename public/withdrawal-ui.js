const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function withdrawalPage() {
  return `<section class="section-wrap prose-page withdrawal-page"><span class="eyebrow">ARCHENLICHT · WIDERRUF</span><h1>Vertrag widerrufen</h1><p>Hier kannst du deine Bestellung oder einzelne Artikel widerrufen. Ein Kundenkonto, eine Anmeldung oder eine Begründung sind nicht erforderlich. Du kannst deinen Widerruf auch an <a href="mailto:info@archenlicht.de">info@archenlicht.de</a> senden.</p><form id="withdrawal-form"><label for="withdrawal-name">Dein Name</label><input id="withdrawal-name" name="name" autocomplete="name" maxlength="120" required><label for="withdrawal-contract">Welche Bestellung oder welche Artikel möchtest du widerrufen?</label><textarea id="withdrawal-contract" name="contract" rows="4" maxlength="1500" required placeholder="Bestellnummer, falls vorhanden, oder z. B. Artikel und Bestelldatum. Bei einem Teilwiderruf bitte die betroffenen Artikel nennen."></textarea><label for="withdrawal-email">E-Mail-Adresse für die Eingangsbestätigung</label><input id="withdrawal-email" name="email" type="email" autocomplete="email" maxlength="180" required><p class="fine-print">Wir verwenden diese Angaben zur Bearbeitung deines Widerrufs und für die Eingangsbestätigung. <a href="/datenschutz">Datenschutz</a> · <a href="/widerruf">Widerrufsbelehrung</a></p><div class="form-error" role="alert"></div><button type="submit" class="button primary">Angaben prüfen</button></form><div id="withdrawal-review" hidden></div><div id="withdrawal-result" role="status" aria-live="polite"></div></section>`;
}
export function mountWithdrawal(post) {
  const form = document.querySelector('#withdrawal-form'); if (!form) return;
  const review = document.querySelector('#withdrawal-review'), result = document.querySelector('#withdrawal-result');
  let data, requestId = crypto.randomUUID(), pending = false;
  form.addEventListener('submit', event => {
    event.preventDefault(); event.stopPropagation();
    data = Object.fromEntries(new FormData(form)); form.hidden = true; review.hidden = false;
    review.innerHTML = `<h2 tabindex="-1">Deinen Widerruf prüfen</h2><p>Hiermit widerrufe ich den Vertrag bzw. den folgenden Teil des Vertrags:</p><p class="legal-text">${esc(data.contract)}</p><p><strong>Name:</strong> ${esc(data.name)}<br><strong>Eingangsbestätigung an:</strong> ${esc(data.email)}</p><div class="form-error" role="alert"></div><div class="withdrawal-actions"><button type="button" class="button primary" id="withdrawal-confirm">Widerruf bestätigen</button><button type="button" class="button secondary" id="withdrawal-edit">Angaben ändern</button></div>`;
    review.querySelector('h2').focus();
    review.querySelector('#withdrawal-edit').onclick = () => { if (pending) return; requestId = crypto.randomUUID(); review.hidden = true; form.hidden = false; form.querySelector('input').focus(); };
    review.querySelector('#withdrawal-confirm').onclick = async () => {
      if (pending) return; pending = true;
      const buttons = review.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
      try {
        const response = await post('/api/withdrawals', { ...data, requestId, confirm: true });
        review.hidden = true;
        result.innerHTML = `<h2 tabindex="-1">Dein Widerruf ist eingegangen.</h2><p>Die Eingangsbestätigung wird an ${esc(data.email)} versendet. Du kannst sie auch hier speichern.</p><pre class="withdrawal-receipt">${esc(response.text)}</pre><button type="button" class="button secondary" id="withdrawal-download">Eingangsbestätigung speichern</button><p>Wir bearbeiten deine Erklärung und melden uns zu den weiteren Schritten.</p>`;
        result.querySelector('h2').focus();
        result.querySelector('#withdrawal-download').onclick = () => {
          const url = URL.createObjectURL(new Blob([response.text], { type: 'text/plain;charset=utf-8' }));
          const a = document.createElement('a'); a.href = url; a.download = `Archenlicht-Widerruf-${response.id}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
      } catch (error) { review.querySelector('.form-error').textContent = `${error.message} Du kannst es erneut versuchen oder deinen Widerruf per E-Mail an info@archenlicht.de senden.`; }
      finally { pending = false; buttons.forEach(b => b.disabled = false); }
    };
  });
}
