const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require('discord.js');
const { getServerStatus, sendCommand } = require('../lib/erlc');

// Role pinged when SSU/SSD/session boost commands are run.
const SESSION_PING_ROLE_ID = '1526164856921919543';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sessionboost')
    .setDescription('Ask everyone to hop in and boost the current session')
    .addStringOption((option) =>
      option.setName('message').setDescription('Optional custom message').setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Only staff can use this command.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    const message = interaction.options.getString('message') || 'We need more players — invite your friends and join now!';

    let status = null;
    try {
      status = await getServerStatus();
      await sendCommand(`:h ${message}`);
    } catch (error) {
      console.error('ER:LC API error during /sessionboost:', error);
    }

    const container = new ContainerBuilder()
      .setAccentColor(0xf1c40f)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`<@&${SESSION_PING_ROLE_ID}>`),
        new TextDisplayBuilder().setContent('# 🚀 Session Boost'),
        new TextDisplayBuilder().setContent(message)
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    if (status) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Join Code:** \`${status.JoinKey}\`\n**Players:** ${status.CurrentPlayers}/${status.MaxPlayers}`
        )
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('⚠️ Could not reach the ER:LC API — the in-game announcement may not have sent.')
      );
    }

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { roles: [SESSION_PING_ROLE_ID] },
    });
  },
};
