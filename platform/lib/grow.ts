// Grow (formerly Meshulam) "Light API" client.
//
// Facts this module relies on (from Grow's public docs):
// - All calls are server-to-server HTTP POST with form-encoded bodies, not JSON.
// - Endpoints live under https://sandbox.meshulam.co.il/api/light/server/1.0/
//   (sandbox) and https://secure.meshulam.co.il/api/light/server/1.0/ (production).
// - createPaymentProcess returns { status: 1, data: { url, processId, processToken } }
//   on success; the payment URL is valid for ~10 minutes.
// - A recurring monthly charge (הוראת קבע) is created by calling createPaymentProcess
//   with a page code that was configured as recurring in the Grow dashboard, and
//   paymentNum = number of charges.
// - Grow calls notifyUrl (form-encoded POST) on each charge; the merchant then
//   calls approveTransaction with the transactionId as an acknowledgement.
// - updateRecurringPayment changes amount / pauses / cancels a recurring order.

export type GrowEnv = 'sandbox' | 'production';

export interface GrowConfig {
  env: GrowEnv;
  pageCode: string;
  userId: string;
  apiKey: string;
}

export interface CreatePaymentInput {
  sum: number;
  description: string;
  paymentNum: number;
  fullName: string;
  email: string;
  phone?: string;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Free custom fields echoed back in the callback (cField1..cField3). */
  customFields?: [string?, string?, string?];
}

export interface CreatePaymentResult {
  url: string;
  processId: string;
  processToken: string;
}

export interface GrowCallback {
  processId: string;
  processToken: string;
  transactionId: string;
  transactionToken: string;
  asmachta: string;
  statusCode: string;
  sum: number | null;
  paymentType: string;
  fullName: string;
  payerEmail: string;
  payerPhone: string;
  recurringId: string;
  cField1: string;
  cField2: string;
  cField3: string;
  raw: Record<string, string>;
}

export function baseUrl(env: GrowEnv): string {
  return env === 'production'
    ? 'https://secure.meshulam.co.il/api/light/server/1.0/'
    : 'https://sandbox.meshulam.co.il/api/light/server/1.0/';
}

export function configFromEnv(e: NodeJS.ProcessEnv = process.env): GrowConfig {
  const env = e.GROW_ENV === 'production' ? 'production' : 'sandbox';
  const pageCode = e.GROW_PAGE_CODE ?? '';
  const userId = e.GROW_USER_ID ?? '';
  const apiKey = e.GROW_API_KEY ?? '';
  if (!pageCode || !userId) throw new Error('GROW_PAGE_CODE and GROW_USER_ID must be set');
  return { env, pageCode, userId, apiKey };
}

/** Builds the form body for createPaymentProcess. Exported for tests. */
export function buildCreatePaymentForm(cfg: GrowConfig, input: CreatePaymentInput): URLSearchParams {
  const form = new URLSearchParams();
  form.set('pageCode', cfg.pageCode);
  form.set('userId', cfg.userId);
  form.set('sum', formatSum(input.sum));
  form.set('description', input.description);
  form.set('paymentNum', String(input.paymentNum));
  form.set('successUrl', input.successUrl);
  form.set('cancelUrl', input.cancelUrl);
  form.set('notifyUrl', input.notifyUrl);
  form.set('pageField[fullName]', input.fullName);
  form.set('pageField[email]', input.email);
  if (input.phone) form.set('pageField[phone]', input.phone);
  const [c1, c2, c3] = input.customFields ?? [];
  if (c1) form.set('cField1', c1);
  if (c2) form.set('cField2', c2);
  if (c3) form.set('cField3', c3);
  return form;
}

export function formatSum(sum: number): string {
  if (!Number.isFinite(sum) || sum <= 0) throw new Error('sum must be a positive number');
  return (Math.round(sum * 100) / 100).toString();
}

type GrowResponse = { status?: number | string; err?: unknown; data?: Record<string, unknown> };

async function post(cfg: GrowConfig, method: string, form: URLSearchParams, fetchImpl: typeof fetch = fetch): Promise<GrowResponse> {
  const res = await fetchImpl(baseUrl(cfg.env) + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  });
  const text = await res.text();
  let json: GrowResponse;
  try {
    json = JSON.parse(text) as GrowResponse;
  } catch {
    throw new Error(`Grow ${method}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Grow ${method}: HTTP ${res.status}: ${describeErr(json.err)}`);
  return json;
}

export function describeErr(err: unknown): string {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const msg = o.message ?? o.msg ?? o.text;
    const id = o.id ?? o.code;
    return [id, msg].filter(Boolean).join(': ') || JSON.stringify(err);
  }
  return String(err);
}

export function isOk(json: GrowResponse): boolean {
  return json.status === 1 || json.status === '1';
}

export async function createPaymentProcess(
  cfg: GrowConfig,
  input: CreatePaymentInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatePaymentResult> {
  const json = await post(cfg, 'createPaymentProcess', buildCreatePaymentForm(cfg, input), fetchImpl);
  if (!isOk(json) || !json.data) throw new Error('Grow createPaymentProcess failed: ' + describeErr(json.err));
  const { url, processId, processToken } = json.data;
  if (typeof url !== 'string' || !url) throw new Error('Grow createPaymentProcess: missing payment url');
  return { url, processId: String(processId ?? ''), processToken: String(processToken ?? '') };
}

/** Acknowledge a callback. Grow processes the charge even if this call fails. */
export async function approveTransaction(
  cfg: GrowConfig,
  transactionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const form = new URLSearchParams();
  form.set('pageCode', cfg.pageCode);
  form.set('userId', cfg.userId);
  if (cfg.apiKey) form.set('apiKey', cfg.apiKey);
  form.set('transactionId', transactionId);
  const json = await post(cfg, 'approveTransaction', form, fetchImpl);
  return isOk(json);
}

export type RecurringAction = 'cancel' | 'pause' | 'resume';

/**
 * Cancel / pause / resume a recurring order. The exact parameter names for
 * this endpoint are not in Grow's public snippets; confirm them against the
 * "updateRecurringPayment" reference in your Grow dashboard docs.
 */
export async function updateRecurringPayment(
  cfg: GrowConfig,
  recurringId: string,
  action: RecurringAction,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const form = new URLSearchParams();
  form.set('pageCode', cfg.pageCode);
  form.set('userId', cfg.userId);
  if (cfg.apiKey) form.set('apiKey', cfg.apiKey);
  form.set('recurringDebitId', recurringId);
  form.set('action', action);
  const json = await post(cfg, 'updateRecurringPayment', form, fetchImpl);
  return isOk(json);
}

/** Normalizes the form-encoded callback Grow posts to notifyUrl. */
export function parseCallback(params: URLSearchParams | Record<string, string>): GrowCallback {
  const raw: Record<string, string> = {};
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => { raw[k] = v; });
  } else {
    Object.assign(raw, params);
  }
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k] ?? raw[`data[${k}]`];
      if (v !== undefined && v !== '') return String(v);
    }
    return '';
  };
  const sumStr = get('sum');
  const sum = sumStr ? Number(sumStr) : null;
  return {
    processId: get('processId'),
    processToken: get('processToken'),
    transactionId: get('transactionId'),
    transactionToken: get('transactionToken'),
    asmachta: get('asmachta'),
    statusCode: get('statusCode', 'status'),
    sum: sum !== null && Number.isFinite(sum) ? sum : null,
    paymentType: get('paymentType'),
    fullName: get('fullName'),
    payerEmail: get('payerEmail', 'email'),
    payerPhone: get('payerPhone', 'phone'),
    recurringId: get('recurringDebitId', 'directDebitId', 'recurringId'),
    cField1: get('cField1'),
    cField2: get('cField2'),
    cField3: get('cField3'),
    raw,
  };
}

export function successStatusCodes(e: NodeJS.ProcessEnv = process.env): string[] {
  return (e.GROW_SUCCESS_STATUS_CODES ?? '2').split(',').map((s) => s.trim()).filter(Boolean);
}

export function isSuccessfulCharge(cb: GrowCallback, codes: string[] = successStatusCodes()): boolean {
  return codes.includes(cb.statusCode);
}
