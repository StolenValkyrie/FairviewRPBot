const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Makes the bot say something')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message for the bot to send')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    await interaction.reply({ content: 'Sent.', ephemeral: true });
    await interaction.channel.send(message);
  },
};