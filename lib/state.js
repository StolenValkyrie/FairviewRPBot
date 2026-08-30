// Tracks in-progress session boosts and pending SSU confirmations.
// Kept separate so both sessionboost.js and index.js can share the same state.
const activeBoosts = new Map(); // messageId -> { votes: Set, goal, message, triggered }
const pendingSsu = new Map();   // confirmMessageId -> { boostMessageId, message, channelId }

module.exports = { activeBoosts, pendingSsu };