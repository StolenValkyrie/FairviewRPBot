/**
 * /promote command — discord.js v14 (Components V2)
 *
 * Requires discord.js v14.22.0 or newer (that's when Components V2 —
 * ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, etc. — landed).
 * Check with: npm ls discord.js
 *
 * Drop this file in your commands folder (e.g. ./commands/promote.js) the
 * same way you load your other slash commands.
 */

const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

// ---- Config -----------------------------------------------------------
const HIGH_RANKING_TEAM_ROLE_ID = 'HIGH_RANKING_TEAM';
const LOGO_EMOJI = '<:logo:1533740178030723192>';
const TOP_BANNER_URL =
  'https://cdn.phototourl.com/free/2026-09-03-5dc96ab9-5ea9-4f01-b902-a5dbbdb7a24e.png';
const BOTTOM_FOOTER_URL =
  'https://cdn.phototourl.com/free/2026-08-30-1c0da88b-36b4-4a71-945e-cbd73f745df1.png';
const ACCENT_COLOR = 0x5865f2; // container side-bar color, change if you want
const PROMOTION_CHANNEL_ID = '1526164859576651893';
// -------------------------------------------------------------------------

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a staff member!')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The staff member to promote').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the promotion')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('The role/rank they are being promoted to').setRequired(true)
    ),

  async execute(interaction) {
    const member = interaction.member;

    const hasPermission = member.roles.cache.has(HIGH_RANKING_TEAM_ROLE_ID);

    if (!hasPermission) {
      return interaction.reply({
        content: "You don't have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const role = interaction.options.getRole('role', true);

    const container = new ContainerBuilder()
      .setAccentColor(ACCENT_COLOR)
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(TOP_BANNER_URL))
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## Staff Promotion'),
        new TextDisplayBuilder().setContent(
          `The High Ranking Team has noticed your outstanding performance during this week and would like to formally congratulate <@${target.id}> on their recent promotion to <@&${role.id}>.`
        ),
        new TextDisplayBuilder().setContent(
          'This is visibility of your dedication and works towards the server thanks and keep up the amazing work!'
        ),
        new TextDisplayBuilder().setContent(
          `${LOGO_EMOJI} \\\\ **User:** <@${target.id}>\n` +
            `${LOGO_EMOJI} \\\\ **Rank:** <@&${role.id}>\n` +
            `${LOGO_EMOJI} \\\\ **Reason:** ${reason}`
        ),
        new TextDisplayBuilder().setContent(
          `Signed,\n${LOGO_EMOJI} | LVRP High Rank Team\nIssued by: <@${interaction.user.id}>`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(BOTTOM_FOOTER_URL))
      );

    const promotionChannel = await interaction.client.channels.fetch(PROMOTION_CHANNEL_ID).catch(() => null);

    if (!promotionChannel) {
      return interaction.reply({
        content: `Couldn't find the promotion channel (\`${PROMOTION_CHANNEL_ID}\`). Check the bot can see it and the ID is correct.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await promotionChannel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      // Components V2 messages can't use "content" or legacy "embeds" —
      // everything has to live inside the container's components.
      allowedMentions: { users: [target.id], roles: [role.id] },
    });

    await interaction.reply({
      content: `✅ Promotion posted in <#${PROMOTION_CHANNEL_ID}>.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};