const crypto = require('crypto');

function stripTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function computeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadStr =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  const toSign = `${timestamp}.${payloadStr}`;
  const signature = crypto
    .createHmac('sha512', secret)
    .update(toSign)
    .digest('hex');
  return { signature: `t=${timestamp},v1=${signature}`, payloadStr };
}

async function sendSignedRequest(baseUrl, path, payload, secret) {
  const { signature, payloadStr } = computeSignature(payload, secret);
  const url = `${stripTrailingSlash(baseUrl)}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-notifier-signature': signature,
    },
    body: payloadStr,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Request failed:', res.status, data);
    process.exit(1);
  }
  console.log('Success:', data);
}

module.exports = { computeSignature, sendSignedRequest, stripTrailingSlash };
