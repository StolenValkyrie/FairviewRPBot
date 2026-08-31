const {
  SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits,
} = require('discord.js');
const { honeypotChannels } = require('../lib/state');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Manage anti-raid honeypot channels')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Create a new honeypot channel — hidden from staff, visible to everyone else')
        .addStringOption((option) =>
          option.setName('name').setDescription('Channel name (default: important-announcement)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Delete a honeypot channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The honeypot channel to remove')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.HIGH_RANKING_TEAM)) {
      return interaction.reply({ content: 'Only High Ranking can manage honeypot channels.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const name = interaction.options.getString('name') || 'important-announcement';

      // Visible + postable by everyone by default. Staff roles are
      // explicitly denied ViewChannel so they don't see it (and can't
      // accidentally trigger it). Add more roles to this list if you
      // want other trusted roles hidden from it too.
      const overwrites = [
        { id: interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      ];

      if (process.env.STAFF_ROLE_ID) {
        overwrites.push({ id: process.env.STAFF_ROLE_ID, deny: [PermissionFlagsBits.ViewChannel] });
      }
      if (process.env.HIGH_RANKING_TEAM) {
        overwrites.push({ id: process.env.HIGH_RANKING_TEAM, deny: [PermissionFlagsBits.ViewChannel] });
      }

      const channel = await interaction.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        // Topic doubles as a persistence marker — rebuildHoneypotRegistry()
        // in index.js scans for this on every bot restart so honeypots
        // keep working without needing to be re-created.
        topic: 'honeypot',
        permissionOverwrites: overwrites,
      });

      honeypotChannels.add(channel.id);

      return interaction.reply({
        content: `🍯 Honeypot channel created: ${channel}. Anyone who posts there is automatically softbanned. Staff roles are hidden from it — make sure the bot has the **Ban Members** permission.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      honeypotChannels.delete(channel.id);
      await channel.delete().catch(() => {});
      return interaction.reply({ content: `🗑️ Removed honeypot channel #${channel.name}.`, flags: MessageFlags.Ephemeral });
    }
  },
};
