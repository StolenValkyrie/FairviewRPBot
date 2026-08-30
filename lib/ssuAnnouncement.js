const {
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

// Role pinged when an SSU (Server Start Up) or session boost goes out.
const SESSION_PING_ROLE_ID = process.env.SESSION_PING_ROLE_ID;

// Builds the SSU announcement payload. Shared by /ssu and the session boost
// confirmation flow so both produce the exact same announcement layout.
async function buildSsuAnnouncement(message) {
  const container = new ContainerBuilder()
    .setAccentColor(0x2ecc71)

    // Top media gallery
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(
          'https://cdn.phototourl.com/free/2026-08-30-0810dfe0-b851-4057-9edf-401c1a3d0c5a.png'
        )
      )
    )

    // Title
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# <:logo:1533740178030723192> Server Start Up'
      )
    )

    // Role mention + body text
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${SESSION_PING_ROLE_ID ? `<@&${SESSION_PING_ROLE_ID}>\n` : ''}${message}`
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )

    // Bottom media gallery
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(
          'https://cdn.phototourl.com/free/2026-08-30-1c0da88b-36b4-4a71-945e-cbd73f745df1.png'
        )
      )
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: SESSION_PING_ROLE_ID
      ? { roles: [SESSION_PING_ROLE_ID] }
      : undefined,
  };
}

module.exports = { buildSsuAnnouncement, SESSION_PING_ROLE_ID };