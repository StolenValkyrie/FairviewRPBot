const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');
const { sendCommand } = require('./erlc');

// Role pinged on SSU/SSD/session vote announcements.
const SESSION_PING_ROLE_ID = '1526164856921919543';

// Builds the SSU message payload and fires off the in-game announcement.
// Used by both /ssu directly and the session-vote confirm button, so both
// paths always produce the exact same result.
async function buildSsuAnnouncement(message) {
  try {
    await sendCommand(`:h ${message}`);
  } catch (error) {
    console.error('ER:LC API error while sending SSU announcement:', error);
  }

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

    // Server Start Up title
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# <:logo:1533740178030723192> Server Start Up'
      )
    )

    // Body text with session ping at the bottom
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${message}${SESSION_PING_ROLE_ID ? `\n\n<@&${SESSION_PING_ROLE_ID}>` : ''}`
      )
    )

    // Separator
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