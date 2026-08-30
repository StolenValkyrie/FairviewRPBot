const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildSsuAnnouncement } = require('../lib/ssuAnnouncement');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ssu')
    .setDescription('Announce a Server Start Up (SSU)')
    .addStringOption((option) =>
      option.setName('message').setDescription('Optional custom message').setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Only staff can use this command.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    const message = interaction.options.getString('message') || 'The Fairview High Ranking Team have initiated a Server Start Up (SSU)! Join the server using the code: FVRPJ';
    const payload = await buildSsuAnnouncement(message);

    await interaction.editReply(payload);
  },
};
