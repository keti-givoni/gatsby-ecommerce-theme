import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCreatePaymentForm, parseCallback, isSuccessfulCharge, baseUrl, formatSum,
  createPaymentProcess, approveTransaction, describeErr,
} from '../lib/grow.ts';

const cfg = { env: 'sandbox', pageCode: 'PAGE', userId: 'USER', apiKey: 'KEY' };

test('baseUrl picks sandbox vs production', () => {
  assert.equal(baseUrl('sandbox'), 'https://sandbox.meshulam.co.il/api/light/server/1.0/');
  assert.equal(baseUrl('production'), 'https://secure.meshulam.co.il/api/light/server/1.0/');
});

test('buildCreatePaymentForm encodes all fields as form data', () => {
  const form = buildCreatePaymentForm(cfg, {
    sum: 29, description: 'מנוי', paymentNum: 120, fullName: 'קטי', email: 'a@b.c', phone: '0501234567',
    successUrl: 'https://x/s', cancelUrl: 'https://x/c', notifyUrl: 'https://x/n',
    customFields: ['sub-1', 'user-1'],
  });
  assert.equal(form.get('pageCode'), 'PAGE');
  assert.equal(form.get('userId'), 'USER');
  assert.equal(form.get('sum'), '29');
  assert.equal(form.get('paymentNum'), '120');
  assert.equal(form.get('pageField[fullName]'), 'קטי');
  assert.equal(form.get('pageField[email]'), 'a@b.c');
  assert.equal(form.get('pageField[phone]'), '0501234567');
  assert.equal(form.get('cField1'), 'sub-1');
  assert.equal(form.get('cField2'), 'user-1');
  assert.equal(form.get('cField3'), null);
  assert.equal(form.get('notifyUrl'), 'https://x/n');
});

test('formatSum rejects non-positive and rounds to agorot', () => {
  assert.equal(formatSum(29.999), '30');
  assert.equal(formatSum(19.9), '19.9');
  assert.throws(() => formatSum(0));
});

test('parseCallback normalizes fields and detects success', () => {
  const cb = parseCallback(new URLSearchParams({
    processId: '332002', processToken: 'tok', transactionId: '55', transactionToken: 'tt',
    asmachta: '0289199', statusCode: '2', sum: '29', paymentType: 'הוראת קבע',
    fullName: 'קטי', payerEmail: 'a@b.c', cField1: 'sub-1', recurringDebitId: 'rd-9',
  }));
  assert.equal(cb.processId, '332002');
  assert.equal(cb.sum, 29);
  assert.equal(cb.recurringId, 'rd-9');
  assert.equal(cb.cField1, 'sub-1');
  assert.equal(isSuccessfulCharge(cb, ['2']), true);
  assert.equal(isSuccessfulCharge({ ...cb, statusCode: '0' }, ['2']), false);
});

test('parseCallback accepts data[...] shaped keys', () => {
  const cb = parseCallback({ 'data[processId]': '1', 'data[statusCode]': '2', 'data[directDebitId]': 'dd' });
  assert.equal(cb.processId, '1');
  assert.equal(cb.statusCode, '2');
  assert.equal(cb.recurringId, 'dd');
});

test('createPaymentProcess posts form data and returns the payment url', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ status: 1, err: '', data: { url: 'https://pay/x', processId: 7, processToken: 'p' } }), { status: 200 });
  };
  const r = await createPaymentProcess(cfg, {
    sum: 29, description: 'd', paymentNum: 12, fullName: 'n', email: 'e@e.e',
    successUrl: 's', cancelUrl: 'c', notifyUrl: 'n',
  }, fetchImpl);
  assert.equal(r.url, 'https://pay/x');
  assert.equal(r.processId, '7');
  assert.equal(captured.url, 'https://sandbox.meshulam.co.il/api/light/server/1.0/createPaymentProcess');
  assert.equal(captured.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.match(captured.init.body, /pageCode=PAGE/);
});

test('createPaymentProcess surfaces Grow errors', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ status: 0, err: { id: 400, message: 'bad page' } }), { status: 200 });
  await assert.rejects(
    () => createPaymentProcess(cfg, { sum: 1, description: 'd', paymentNum: 1, fullName: 'n', email: 'e', successUrl: 's', cancelUrl: 'c', notifyUrl: 'n' }, fetchImpl),
    /bad page/,
  );
});

test('approveTransaction sends transactionId and reports status', async () => {
  let body;
  const fetchImpl = async (_u, init) => { body = init.body; return new Response(JSON.stringify({ status: 1 }), { status: 200 }); };
  assert.equal(await approveTransaction(cfg, '55', fetchImpl), true);
  assert.match(body, /transactionId=55/);
  assert.match(body, /apiKey=KEY/);
});

test('describeErr handles shapes', () => {
  assert.equal(describeErr('x'), 'x');
  assert.equal(describeErr({ id: 1, message: 'm' }), '1: m');
  assert.equal(describeErr(null), 'unknown error');
});
