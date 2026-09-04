const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('What the bot should say?')
        .setRequired(true)
    ),

  async execute(interaction) {
    const message = interaction.options.getString('message');

    // Post the message publicly in the channel...
    await interaction.channel.send(message);

    // ...then confirm privately to whoever ran the command, so it's clear
    // it worked without a second visible message cluttering the channel.
    await interaction.reply({
      content: 'Sent!',
      flags: MessageFlags.Ephemeral,
    });
  },
};
