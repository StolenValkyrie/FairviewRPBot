// Thin wrapper around Dock's verification API.
// Docs: https://docs.docksys.xyz/api/v1/overview

const BASE_URL = 'https://api.docksys.xyz';

function getHeaders() {
  const key = process.env.DOCKSYS_API_KEY;
  if (!key) {
    throw new Error('DOCKSYS_API_KEY is not set in your .env file.');
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function getPid() {
  const pid = process.env.DOCKSYS_PID;
  if (!pid) {
    throw new Error('DOCKSYS_PID is not set in your .env file.');
  }
  return pid;
}

// Creates a PID-scoped verification session for a given Discord user.
// clientId is your own identifier for mapping completion back to the user —
// we use their Discord ID here.
async function createVerificationSession(discordUserId, guildId) {
  const response = await fetch(`${BASE_URL}/api/v1/verify/session`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      pid: getPid(),
      clientId: discordUserId,
      guildId: guildId || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Dock API returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  return body.data; // { sid, pid, clientId, expiresAt, reusedExisting, verifyUrl }
}

// Fetches session status. Pass waitSeconds (1-25) to long-poll instead of
// returning immediately — the API holds the request open until the status
// changes or the wait expires.
async function getSessionStatus(sid, waitSeconds) {
  const url = new URL(`${BASE_URL}/api/v1/verify/session/${sid}`);
  if (waitSeconds) url.searchParams.set('wait', String(waitSeconds));

  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    throw new Error(`Dock API returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  return body.data; // { sid, pid, status: 'pending'|'expired'|'cancelled' } OR { sid, pid, result: {...} }
}

module.exports = { createVerificationSession, getSessionStatus };