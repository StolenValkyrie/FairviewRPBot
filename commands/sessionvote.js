const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { SESSION_PING_ROLE_ID } = require('../lib/ssuAnnouncement');
const { activeBoosts } = require('../lib/state');

const DEFAULT_GOAL = 4;

// Builds the vote-tracking card. Exported so index.js can reuse it to
// update the vote count in place after each click, without duplicating
// the layout in two files.
function buildVoteContainer(message, voteCount, goal) {
  return new ContainerBuilder()
    .setAccentColor(0xf1c40f)

    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(
          'https://cdn.phototourl.com/free/2026-08-31-c14f4690-c811-42a8-bcc1-5733c64cc960.png'
        )
      )
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# <:logo:1533740178030723192> Session Vote'),
      new TextDisplayBuilder().setContent(message),
      new TextDisplayBuilder().setContent(`<@&${SESSION_PING_ROLE_ID}>`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Votes:** ${voteCount}/${goal}`)
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('session_vote')
          .setLabel('Vote')
          .setStyle(ButtonStyle.Success)
      )
    )

    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(
          'https://cdn.phototourl.com/free/2026-08-30-1c0da88b-36b4-4a71-945e-cbd73f745df1.png'
        )
      )
    );
}

module.exports = {
  buildVoteContainer,
  data: new SlashCommandBuilder()
    .setName('sessionvote')
    .setDescription('Start a vote to begin a new session')
    .addStringOption((option) =>
      option.setName('message').setDescription('Optional custom message').setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('goal')
        .setDescription(`Votes needed before High Ranking is asked to confirm (default ${DEFAULT_GOAL})`)
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Only staff can use this command.', flags: MessageFlags.Ephemeral });
    }

    const message = interaction.options.getString('message') || 'Vote below if you want a session to start!';
    const goal = interaction.options.getInteger('goal') || DEFAULT_GOAL;

    await interaction.reply({
      components: [buildVoteContainer(message, 0, goal)],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { roles: [SESSION_PING_ROLE_ID] },
    });

    const sentMessage = await interaction.fetchReply();
    activeBoosts.set(sentMessage.id, { votes: new Set(), goal, message });
  },
};