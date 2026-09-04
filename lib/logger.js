/**
 * lib/logger.js — server-wide activity + command-usage logger
 *
 * Sends everything to a single log channel (LOG_CHANNEL_ID in your .env):
 *   - Messages: deleted, edited
 *   - Members: joined, left, banned, unbanned, nickname/role changes
 *   - Channels: created, deleted
 *   - Roles: created, deleted
 *   - Voice: joined/left/moved voice channels
 *   - Slash commands: who ran what, where, with which options
 *
 * SETUP (in your main index.js):
 *
 *   const { initLogger, logCommandUsage } = require('./lib/logger');
 *
 *   // Inside your Events.ClientReady handler, after the client is ready:
 *   initLogger(client);
 *
 *   // Inside your Events.InteractionCreate handler, right before you call
 *   // command.execute(interaction), add one line:
 *   if (interaction.isChatInputCommand()) {
 *     const command = client.commands.get(interaction.commandName);
 *     if (!command) return;
 *     logCommandUsage(interaction);          // <-- add this line
 *     try {
 *       await command.execute(interaction);
 *       ...
 *
 * ENV:
 *   LOG_CHANNEL_ID=1234567890123456789
 */

const { EmbedBuilder, Events, ChannelType } = require('discord.js');

const COLORS = {
  delete: 0xed4245,
  edit: 0xfaa61a,
  join: 0x57f287,
  leave: 0xed4245,
  ban: 0xed4245,
  unban: 0x57f287,
  update: 0x5865f2,
  create: 0x57f287,
  voice: 0x5865f2,
  command: 0x99aab5,
};

let logChannel = null;

function initLogger(client) {
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId) {
    console.log('[logger] LOG_CHANNEL_ID is not set — logger is disabled.');
    return;
  }

  client.channels
    .fetch(channelId)
    .then((channel) => {
      logChannel = channel;
      console.log(`[logger] Logging to #${channel.name}`);
    })
    .catch((error) => {
      console.error('[logger] Could not fetch LOG_CHANNEL_ID channel:', error);
    });

  registerEventListeners(client);
}

function send(embed) {
  if (!logChannel) return;
  logChannel.send({ embeds: [embed] }).catch((error) => {
    console.error('[logger] Failed to send log message:', error);
  });
}

function baseEmbed(color) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

// ---- Slash command usage -------------------------------------------------
// Call this manually from your InteractionCreate handler, right before
// command.execute(interaction).
function logCommandUsage(interaction) {
  const options = interaction.options?.data
    ?.map((opt) => `\`${opt.name}\`: ${formatOptionValue(opt)}`)
    .join('\n') || '*No options*';

  const embed = baseEmbed(COLORS.command)
    .setAuthor({
      name: `${interaction.user.tag} used /${interaction.commandName}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .addFields(
      { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
      { name: 'User ID', value: interaction.user.id, inline: true },
      { name: 'Options', value: options }
    );

  send(embed);
}

function formatOptionValue(opt) {
  if (opt.user) return `<@${opt.user.id}>`;
  if (opt.role) return `<@&${opt.role.id}>`;
  if (opt.channel) return `<#${opt.channel.id}>`;
  return String(opt.value);
}

// ---- Everything else — wired up automatically ----------------------------
function registerEventListeners(client) {
  // Messages
  client.on(Events.MessageDelete, (message) => {
    if (message.partial || message.author?.bot) return;
    const embed = baseEmbed(COLORS.delete)
      .setAuthor({ name: `${message.author.tag} — Message deleted`, iconURL: message.author.displayAvatarURL() })
      .addFields(
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
        { name: 'Author ID', value: message.author.id, inline: true },
        { name: 'Content', value: message.content?.slice(0, 1024) || '*No text content (embed/attachment)*' }
      );
    send(embed);
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (oldMessage.partial || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // ignore embed-only updates
    const embed = baseEmbed(COLORS.edit)
      .setAuthor({ name: `${newMessage.author.tag} — Message edited`, iconURL: newMessage.author.displayAvatarURL() })
      .addFields(
        { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
        { name: 'Author ID', value: newMessage.author.id, inline: true },
        { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '*empty*' },
        { name: 'After', value: newMessage.content?.slice(0, 1024) || '*empty*' }
      );
    send(embed);
  });

  // Members
  client.on(Events.GuildMemberAdd, (member) => {
    const embed = baseEmbed(COLORS.join)
      .setAuthor({ name: `${member.user.tag} joined`, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: 'User ID', value: member.id, inline: true },
        { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
      );
    send(embed);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    const embed = baseEmbed(COLORS.leave)
      .setAuthor({ name: `${member.user.tag} left`, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: 'User ID', value: member.id, inline: true },
        { name: 'Roles', value: member.roles?.cache?.map((r) => `<@&${r.id}>`).join(', ') || 'None' }
      );
    send(embed);
  });

  client.on(Events.GuildBanAdd, (ban) => {
    const embed = baseEmbed(COLORS.ban)
      .setAuthor({ name: `${ban.user.tag} was banned`, iconURL: ban.user.displayAvatarURL() })
      .addFields({ name: 'User ID', value: ban.user.id });
    send(embed);
  });

  client.on(Events.GuildBanRemove, (ban) => {
    const embed = baseEmbed(COLORS.unban)
      .setAuthor({ name: `${ban.user.tag} was unbanned`, iconURL: ban.user.displayAvatarURL() })
      .addFields({ name: 'User ID', value: ban.user.id });
    send(embed);
  });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const embed = baseEmbed(COLORS.update)
        .setAuthor({ name: `${newMember.user.tag} — Nickname changed`, iconURL: newMember.user.displayAvatarURL() })
        .addFields(
          { name: 'Before', value: oldMember.nickname || '*none*', inline: true },
          { name: 'After', value: newMember.nickname || '*none*', inline: true }
        );
      send(embed);
    }

    // Role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const added = newRoles.filter((r) => !oldRoles.has(r.id));
    const removed = oldRoles.filter((r) => !newRoles.has(r.id));

    if (added.size > 0 || removed.size > 0) {
      const embed = baseEmbed(COLORS.update)
        .setAuthor({ name: `${newMember.user.tag} — Roles updated`, iconURL: newMember.user.displayAvatarURL() });
      if (added.size > 0) embed.addFields({ name: 'Added', value: added.map((r) => `<@&${r.id}>`).join(', ') });
      if (removed.size > 0) embed.addFields({ name: 'Removed', value: removed.map((r) => `<@&${r.id}>`).join(', ') });
      send(embed);
    }
  });

  // Channels
  client.on(Events.ChannelCreate, (channel) => {
    if (channel.type === ChannelType.DM) return;
    const embed = baseEmbed(COLORS.create).setAuthor({ name: `Channel created: #${channel.name}` }).addFields({
      name: 'Channel ID',
      value: channel.id,
    });
    send(embed);
  });

  client.on(Events.ChannelDelete, (channel) => {
    if (channel.type === ChannelType.DM) return;
    const embed = baseEmbed(COLORS.delete).setAuthor({ name: `Channel deleted: #${channel.name}` }).addFields({
      name: 'Channel ID',
      value: channel.id,
    });
    send(embed);
  });

  // Roles
  client.on(Events.GuildRoleCreate, (role) => {
    const embed = baseEmbed(COLORS.create).setAuthor({ name: `Role created: @${role.name}` }).addFields({
      name: 'Role ID',
      value: role.id,
    });
    send(embed);
  });

  client.on(Events.GuildRoleDelete, (role) => {
    const embed = baseEmbed(COLORS.delete).setAuthor({ name: `Role deleted: @${role.name}` }).addFields({
      name: 'Role ID',
      value: role.id,
    });
    send(embed);
  });

  // Voice
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member) return;

    if (!oldState.channelId && newState.channelId) {
      const embed = baseEmbed(COLORS.voice)
        .setAuthor({ name: `${member.user.tag} joined voice`, iconURL: member.user.displayAvatarURL() })
        .addFields({ name: 'Channel', value: `<#${newState.channelId}>` });
      send(embed);
    } else if (oldState.channelId && !newState.channelId) {
      const embed = baseEmbed(COLORS.voice)
        .setAuthor({ name: `${member.user.tag} left voice`, iconURL: member.user.displayAvatarURL() })
        .addFields({ name: 'Channel', value: `<#${oldState.channelId}>` });
      send(embed);
    } else if (oldState.channelId !== newState.channelId) {
      const embed = baseEmbed(COLORS.voice)
        .setAuthor({ name: `${member.user.tag} moved voice channels`, iconURL: member.user.displayAvatarURL() })
        .addFields(
          { name: 'From', value: `<#${oldState.channelId}>`, inline: true },
          { name: 'To', value: `<#${newState.channelId}>`, inline: true }
        );
      send(embed);
    }   
  });
}

module.exports = { initLogger, logCommandUsage };