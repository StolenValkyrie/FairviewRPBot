// Tracks in-progress session boosts and pending SSU confirmations, plus the
// set of active honeypot channel IDs. Kept separate so index.js and the
// command files can share the same state.
const activeBoosts = new Map(); // messageId -> { votes: Set, goal, message, triggered }
const pendingSsu = new Map();   // confirmMessageId -> { boostMessageId, message, channelId }
const honeypotChannels = new Set(); // channelId set — posting here triggers an auto-softban

module.exports = { activeBoosts, pendingSsu, honeypotChannels };
