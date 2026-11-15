const form = document.querySelector('#print-form'), status = document.querySelector('#status'), renderButton = document.querySelector('#render-button');
let catalog, imageUrl;
const post = (path, value) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archenlicht-Test': '1' }, body: JSON.stringify(value) });
function options(name, values, selected) {
  const select = form.elements[name];
  for (const item of values) select.add(new Option(item.title || item.name, item.id, false, item.id === selected));
}
function modelChanged() {
  const supported = catalog.models.find(model => model.id === form.elements.modelId.value)?.magsafe;
  form.elements.magsafe.disabled = !supported;
  if (!supported) form.elements.magsafe.checked = false;
}
try {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('Der Testkatalog konnte nicht geladen werden.');
  catalog = await response.json();
  options('designId', catalog.designs, 'nach-dem-sturm');
  options('modelId', catalog.models, 'iphone-14-pro');
  options('backgroundId', catalog.colors, 'light-blue');
  modelChanged(); renderButton.disabled = false; status.textContent = 'Bereit für den Drucktest.';
} catch (error) { status.textContent = error.message; }
form.elements.modelId.addEventListener('change', modelChanged);
form.elements.kind.addEventListener('change', () => { document.querySelector('#custom-fields').hidden = form.elements.kind.value !== 'custom'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); renderButton.disabled = true; status.textContent = 'Originalmotiv und Druckfläche werden geprüft …';
  document.querySelector('#download').hidden = true;
  document.querySelector('#print').hidden = true;
  document.querySelector('#details').textContent = '';
  const input = Object.fromEntries(new FormData(form)); input.magsafe = form.elements.magsafe.checked;
  if (input.kind === 'fixed') { delete input.customText; delete input.dedication; }
  try {
    const response = await post('/api/render', input);
    if (!response.ok) throw new Error((await response.json()).error);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(await response.blob());
    const image = document.querySelector('#print'); image.src = imageUrl; image.hidden = false;
    document.querySelector('#empty').hidden = true;
    document.querySelector('#details').textContent = `${response.headers.get('X-Print-Width')} × ${response.headers.get('X-Print-Height')} Pixel · 300 DPI · sRGB · ${response.headers.get('X-Render-Ms')} ms Laufzeit`;
    const download = document.querySelector('#download'); download.href = imageUrl; download.hidden = false;
    status.textContent = 'Druckdatei erstellt. Die automatische Prüfung auf Beschnitt und Kameraausschnitt ist bestanden.';
  } catch (error) { status.textContent = error.message || 'Der Drucktest ist fehlgeschlagen.'; }
  finally { renderButton.disabled = false; }
});
document.querySelector('#password-button').addEventListener('click', async event => {
  const button = event.currentTarget, message = document.querySelector('#password-status');
  button.disabled = true; message.textContent = 'Test läuft …';
  try {
    const response = await post('/api/check-password', {}), result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Passworttest fehlgeschlagen.');
    message.textContent = `Test bestanden (${result.elapsedMs} ms Laufzeit). Es wurde kein Kundenkonto angelegt.`;
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
