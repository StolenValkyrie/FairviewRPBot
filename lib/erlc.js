// Small helper around the ER:LC (Emergency Response: Liberty City) v2 API.
// Docs: https://apidocs.erlc.gg/
//
// Requires ERLC_API_KEY in your .env — get it from your private server's
// Settings > API key (under the ER:LC API section; requires the ERLC API
// server pack to be purchased in-game).

const BASE_URL = 'https://api.erlc.gg/v2';

function getApiKey() {
  const key = process.env.ERLC_API_KEY;
  if (!key) {
    throw new Error('ERLC_API_KEY is not set in your .env file.');
  }
  return key;
}

// Fetches live server status. Pass { players: true, staff: true, queue: true }
// to include those fields — omitting them keeps the request lighter.
async function getServerStatus({ players = false, staff = false, queue = false } = {}) {
  const params = new URLSearchParams();
  if (players) params.set('players', 'true');
  if (staff) params.set('staff', 'true');
  if (queue) params.set('queue', 'true');

  const url = `${BASE_URL}/server${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    headers: { 'server-key': getApiKey() },
  });

  if (!response.ok) {
    throw new Error(`ER:LC API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// Sends an in-game command, e.g. sendCommand(':h Hello everyone!') to
// broadcast a server-wide announcement. Rate limited to 1 request per 5s
// by the ER:LC API itself.
async function sendCommand(command) {
  const response = await fetch(`${BASE_URL}/server/command`, {
    method: 'POST',
    headers: {
      'server-key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command }),
  });

  if (!response.ok) {
    throw new Error(`ER:LC API returned ${response.status}: ${await response.text()}`);
  }
}

module.exports = { getServerStatus, sendCommand };
