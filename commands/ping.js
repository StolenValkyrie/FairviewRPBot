const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  async execute(interaction) {
    await interaction.reply(`Pong! Luke is a retard! ${interaction.user.id}, The latency is ${interaction.client.ws.ping}ms!`);
  },
};