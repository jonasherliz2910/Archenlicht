import { caseLabel } from '../public/case-options.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { recipientFields } from '../public/account-ui.js';
import { phoneMockup } from '../public/device-preview.js';
import { caseColor } from '../public/case-colors.js';
import { TAX_NOTICE } from '../server/payments.js';
import { BRAND, DESIGNS, MODELS } from '../server/catalog.js';

test('Stripe-Kasse zeigt dynamische Zahlungswahl, freiwillige Kartenspeicherung und Kleinunternehmerhinweis', () => {
  const context=vm.createContext({Intl,URL,URLSearchParams,caseLabel,recipientFields,phoneMockup,caseColor,document:{addEventListener(){}},window:{addEventListener(){}}});
  const source=readFileSync('public/app.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/\nstart\(\);\s*$/,'');
  vm.runInContext(source,context);
  const state={paymentMode:'sandbox',taxNotice:TAX_NOTICE,user:{email:'fixture@example.test'},account:{address:null},cart:[{id:'fixture',configuration:{kind:'fixed',designId:'getragen',modelId:'iphone-18-pro'},unitPrice:2999,quantity:1,title:'Getragen',model:'iPhone 18 Pro',printText:'Jesaja 40,11',hash:'fixture'}]};
  context.fixtureState={...state,brand:BRAND,designs:DESIGNS,models:MODELS};vm.runInContext('state=fixtureState',context);
  const html=vm.runInContext('checkoutPage()',context);
  assert.match(html,/name="method" value="stripe"/);assert.doesNotMatch(html,/type="radio" name="method"/);
  assert.match(html,/Kleinunternehmerregelung/);assert.match(html,/freiwillig eine Karte speichern/);
  assert.doesNotMatch(html,/<p id="card-saving-note"[^>]*hidden/);
  assert.match(html,/name="saveAddress"/);assert.doesNotMatch(html,/name="saveAddress"[^>]*checked/);
  assert.doesNotMatch(vm.runInContext('cartPage()',context),/Lokal simulierte Zahlung|paypal-word/);
});
