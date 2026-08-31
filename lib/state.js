// Shared in-memory state, read/written by both command files and
// index.js's interaction/message handling — lives here so every file
// sees the same data instead of each holding its own copy.

// Session vote -> SSU confirmation flow (sessionvote.js + index.js)
// messageId -> { votes: Set<userId>, goal: number, message: string }
const activeBoosts = new Map();
// messageId -> { message: string }
const pendingSsuConfirmations = new Map();

// Honeypot channels — channel IDs currently flagged as honeypots. A channel
// becomes one by having its topic set to exactly "honeypot"; the registry is
// rebuilt from channel topics on every bot startup since this Set itself is
// memory-only (see rebuildHoneypotRegistry in index.js).
const honeypotChannels = new Set();

module.exports = { activeBoosts, pendingSsuConfirmations, honeypotChannels };