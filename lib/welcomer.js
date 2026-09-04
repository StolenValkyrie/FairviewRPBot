/**
 * lib/welcomer.js — greets new members in a welcome channel
 *
 * Sends a classic embed (not Components V2) styled like:
 *   "G'day @user! Welcome to Fairview Roleplay! Hope you enjoy your stay!"
 * with a member-count button and a Dashboard link button underneath,
 * matching the second reference screenshot's button row.
 *
 * SETUP (in your main index.js):
 *
 *   const { initWelcomer } = require('./lib/welcomer');
 *
 *   // Inside your Events.ClientReady handler:
 *   initWelcomer(client);
 *
 * ENV:
 *   WELCOME_CHANNEL_ID=1234567890123456789
 *   DASHBOARD_URL=https://your-dashboard-url.example.com
 */

const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

function initWelcomer(client) {
  const channelId = process.env.WELCOME_CHANNEL_ID;
  if (!channelId) {
    console.log('[welcomer] WELCOME_CHANNEL_ID is not set — welcomer is disabled.');
    return;
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error('[welcomer] Could not fetch WELCOME_CHANNEL_ID channel.');
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('welcome_member_count')
        .setLabel(`${member.guild.memberCount}`)
        .setEmoji('👤')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    if (process.env.DASHBOARD_URL) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(process.env.DASHBOARD_URL)
      );
    }

    await channel
      .send({
        content: `G'day ${member} ! Welcome to **${member.guild.name}**! Hope you enjoy your stay!`,
        components: [row],
        allowedMentions: { users: [member.id] },
      })
      .catch((error) => console.error('[welcomer] Failed to send welcome message:', error));
  });
}

module.exports = { initWelcomer };