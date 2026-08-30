const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { SESSION_PING_ROLE_ID } = require('../lib/ssuAnnouncement');
const { activeBoosts } = require('../lib/state');

const DEFAULT_GOAL = 4;

function buildBoostContainer(message, voteCount, goal, { locked = false } = {}) {
  return new ContainerBuilder()
    .setAccentColor(locked ? 0x2ecc71 : 0xf1c40f)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 🚀 Session Boost'),
      new TextDisplayBuilder().setContent(message)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        locked
          ? `**Votes:** ${voteCount}/${goal} — Goal reached! Waiting on High Ranking confirmation.`
          : `**Votes:** ${voteCount}/${goal}`
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('boost_vote')
          .setLabel(locked ? 'Goal Reached' : 'Vote to Boost')
          .setStyle(locked ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setEmoji('🚀')
          .setDisabled(locked)
      )
    );
}

module.exports = {
  buildBoostContainer,
  data: new SlashCommandBuilder()
    .setName('sessionboost')
    .setDescription('Ask everyone to vote to boost the session')
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

    const message = interaction.options.getString('message') || 'We need more players — invite your friends and join now!';
    const goal = interaction.options.getInteger('goal') || DEFAULT_GOAL;

    await interaction.reply({
      content: `<@&${SESSION_PING_ROLE_ID}>`,
      components: [buildBoostContainer(message, 0, goal)],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { roles: [SESSION_PING_ROLE_ID] },
    });

    const sentMessage = await interaction.fetchReply();
    activeBoosts.set(sentMessage.id, { votes: new Set(), goal, message, triggered: false });
  },
};
