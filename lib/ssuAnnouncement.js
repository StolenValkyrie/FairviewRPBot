const {
  MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require('discord.js');

// Role pinged when an SSU (Server Start Up) or session boost goes out.
const SESSION_PING_ROLE_ID = process.env.SESSION_PING_ROLE_ID;

// Builds the SSU announcement payload. Shared by /ssu and the session boost
// confirmation flow so both produce the exact same announcement layout.
async function buildSsuAnnouncement(message) {
  const container = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 🟢 Server Start Up')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

  return {
    content: SESSION_PING_ROLE_ID ? `<@&${SESSION_PING_ROLE_ID}>` : undefined,
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: SESSION_PING_ROLE_ID ? { roles: [SESSION_PING_ROLE_ID] } : undefined,
  };
}

module.exports = { buildSsuAnnouncement, SESSION_PING_ROLE_ID };
