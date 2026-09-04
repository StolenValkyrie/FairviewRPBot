require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, Events, ActivityType, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  PermissionFlagsBits, ChannelType, Collection,
  REST, Routes,
} = require('discord.js');
const { buildHelpContainer } = require('./lib/helpContent');
const { buildSsuAnnouncement } = require('./lib/ssuAnnouncement');
const { activeBoosts, pendingSsuConfirmations, honeypotChannels } = require('./lib/state');
const { createVerificationSession, getSessionStatus } = require('./lib/docksys');
const { initWelcomer } = require('./lib/welcomer');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Ticket type config — one entry per button, keyed by its customId
// Anyone can open any ticket type; only the matching role + opener can view it
const TICKET_TYPES = {
  ticket_general_support: {
    label: 'General Support',
    prefix: 'support',
    roleId: process.env.SUPPORT_STAFF_ROLE,
    categoryId: '1540904527744729189',
  },
  ticket_high_ranking: {
    label: 'High Ranking',
    prefix: 'highranking',
    roleId: process.env.HIGH_RANKING_TEAM,
    categoryId: '1543499607047278713',
  },
  ticket_directors_board: {
    label: 'Directors Board',
    prefix: 'directors',
    roleId: process.env.DIRECTORS_BOARD,
    categoryId: '1540904690127216661',
  },
  ticket_ia: {
    label: 'IA',
    prefix: 'ia',
    roleId: process.env.IA_ROLE,
    categoryId: '1540904579292471336',
  },
};

// User IDs blocked from opening any ticket. Add/remove IDs as needed.
const TICKET_BANNED_USERS = new Set([
  '1323398308562993270',
]);

// Tracks which ticket channels have been claimed: channelId -> userId
const claimedTickets = new Map();

// Tracks which channels are tickets and who opened them: channelId -> { ...ticketType, openerId }
// Set once when the ticket channel is created (see the ticket-open button
// handler below). f!rename, f!addmember, f!forceclose, and the close-confirm
// flow all rely on this — using channel ID instead of name prefix means
// renaming a ticket channel never breaks its identification.
const ticketChannels = new Map();

// Helper: find the ticket type config for a given channel, based on the
// channelId -> ticketType registry above (populated at ticket creation).
function getTicketTypeForChannel(channel) {
  return ticketChannels.get(channel.id);
}

// Tracks pending close-confirmation prompts: confirmMessageId -> { ticketType, triggerMessage }
// triggerMessage is the f!closerequest message that started this prompt, if
// any (button-triggered requests have no trigger message) — cancel deletes
// both the confirm prompt and this trigger message.
const pendingCloseRequests = new Map();

async function sendCloseRequest(channel, ticketType, triggerMessage = null) {
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_confirm')
      .setLabel('Yes, close it')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('close_cancel')
      .setLabel('No, keep it open')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMessage = await channel.send({
    content: `<@${ticketType.openerId}>, would you like to close this ticket?`,
    components: [confirmRow],
  });

  pendingCloseRequests.set(confirmMessage.id, { ticketType, triggerMessage });
}

// Bans (then auto-unbans a few seconds later) anyone who posts in a
// honeypot channel — this purges their recent messages via
// deleteMessageSeconds and effectively softbans them, without leaving a
// permanent ban. Requires the bot to have the Ban Members permission.
async function handleHoneypotTrigger(message) {
  const member = message.member;
  if (!member) return;

  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete honeypot trigger message:', error);
  }

  try {
    await message.guild.members.ban(member.id, {
      deleteMessageSeconds: 3600,
      reason: 'Honeypot channel trigger (auto softban)',
    });

    setTimeout(async () => {
      try {
        await message.guild.members.unban(member.id, 'Honeypot softban — auto unban');
      } catch (error) {
        console.error('Failed to auto-unban after honeypot softban:', error);
      }
    }, 5000);

    console.log(`🍯 Honeypot triggered by ${member.user.tag} (${member.id}) — softbanned.`);

    if (process.env.HONEYPOT_LOG_CHANNEL_ID) {
      const logChannel = message.guild.channels.cache.get(process.env.HONEYPOT_LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel
          .send(`🍯 **Honeypot triggered** — ${member.user.tag} (\`${member.id}\`) posted in <#${message.channel.id}> and was softbanned.`)
          .catch(() => {});
      }
    }
  } catch (error) {
    console.error('Failed to softban honeypot trigger:', error);
  }
}

// Load slash commands from the commands folder
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] ${file} is missing "data" or "execute".`);
  }
}

// Registers all loaded slash commands with Discord's API.
// Reuses client.commands (already loaded above) instead of re-reading the
// commands folder — keeps this in sync automatically whenever a command
// file is added, edited, or removed.
async function deployCommands() {
  const commandData = client.commands.map((command) => command.data.toJSON());
  const rest = new REST().setToken(process.env.TOKEN);

  try {
    console.log(`Registering ${commandData.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandData }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

// Rebuilds the in-memory ticketChannels registry from each channel's topic
// (set at creation as "ticket|<typeKey>|<openerId>"). Needed because
// ticketChannels itself is memory-only and gets wiped on every bot restart —
// without this, any ticket that was already open before a restart (renamed
// or not) would stop being recognized by f!claim, f!closerequest, etc.
function rebuildTicketRegistry() {
  let restored = 0;
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildText || !channel.topic) continue;

      const match = channel.topic.match(/^ticket\|([^|]+)\|(\d+)$/);
      if (!match) continue;

      const [, typeKey, openerId] = match;
      const ticketType = TICKET_TYPES[typeKey];
      if (!ticketType) continue;

      ticketChannels.set(channel.id, { ...ticketType, openerId });
      restored++;
    }
  }
  if (restored > 0) {
    console.log(`Restored ${restored} ticket channel(s) from their topics.`);
  }
}

// Rebuilds the honeypot channel registry from each channel's topic, the
// same pattern as rebuildTicketRegistry — memory-only state gets wiped on
// every restart, so this restores it from the topic marker. To make a
// channel a honeypot, set its topic to exactly "honeypot".
function rebuildHoneypotRegistry() {
  let restored = 0;
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildText || channel.topic !== 'honeypot') continue;
      honeypotChannels.add(channel.id);
      restored++;
    }
  }
  if (restored > 0) {
    console.log(`Restored ${restored} honeypot channel(s) from their topics.`);
  }
}

function updatePresence() {
  const memberCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

  const statuses = [
    { name: 'Managing Fairview Roleplay', type: ActivityType.Playing },
    { name: `over ${memberCount} members`, type: ActivityType.Watching },
  ];

  let index = 0;
  client.user.setActivity(statuses[index].name, { type: statuses[index].type });

  setInterval(() => {
    index = (index + 1) % statuses.length;
    const currentCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    statuses[1].name = `over ${currentCount} members`;
    client.user.setActivity(statuses[index].name, { type: statuses[index].type });
  }, 15000);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  rebuildTicketRegistry();
  rebuildHoneypotRegistry();
  initWelcomer(client);
  await deployCommands();
  updatePresence();
});

// Text commands (f!)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (honeypotChannels.has(message.channel.id)) {
    await handleHoneypotTrigger(message);
    return;
  }

  if (!message.content.startsWith('f!')) return;

  const args = message.content.slice(2).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    message.reply('Pong!');
    return;
  }

  if (command === 'help') {
    await message.reply({
      components: [buildHelpContainer()],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (command === 'rename') {
    const newName = args.join('-');

    if (!newName) {
      return message.reply('Usage: `f!rename [new-name]`');
    }

    const ticketType = getTicketTypeForChannel(message.channel);

    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    try {
      const oldName = message.channel.name;
      await message.channel.setName(newName.toLowerCase());
      await message.reply(
        `✅ Renamed \`${oldName}\` → \`${newName.toLowerCase()}\`.\n` +
        `⚠️ **Heads up for staff:** Discord only allows **2 channel renames per 10 minutes** per channel. ` +
        `If you rename again too soon it will fail temporarily — wait a bit before trying again.`
      );
    } catch (error) {
      console.error(error);
      message.reply(
        `⚠️ Failed to rename the channel — this is likely Discord's rate limit ` +
        `(**2 renames per 10 minutes** per channel). Wait a few minutes and try again.`
      );
    }
  }
  if (command === 'say') {
    const text = args.join(' ');

    if (!text) {
      return message.reply('Usage: `f!say [message]`');
    }

    try {
      await message.delete();
    } catch (error) {
      console.error('Failed to delete f!say trigger message:', error);
    }

    message.channel.send(text);
    return;
  }

  if (command === 'forceclose') {
    const ticketType = getTicketTypeForChannel(message.channel);
    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return message.reply('Only staff can use this command.');
    }

    await message.reply('🔒 Force closing this ticket in 5 seconds...');
    ticketChannels.delete(message.channel.id);
    claimedTickets.delete(message.channel.id);
    setTimeout(() => {
      message.channel.delete().catch(() => {});
    }, 5000);
    return;
  }

  if (command === 'closerequest') {
    const ticketType = getTicketTypeForChannel(message.channel);
    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return message.reply('Only staff can use this command.');
    }

    await sendCloseRequest(message.channel, ticketType, message);
    return;
  }

  if (command === 'claim') {
    const ticketType = getTicketTypeForChannel(message.channel);
    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    if (!message.member.roles.cache.has(ticketType.roleId)) {
      return message.reply(`Only members of the ${ticketType.label} team can claim this ticket.`);
    }

    const existingClaim = claimedTickets.get(message.channel.id);
    if (existingClaim) {
      return message.reply(`This ticket is already claimed by <@${existingClaim}>.`);
    }

    claimedTickets.set(message.channel.id, message.author.id);
    await message.reply(`✋ Ticket claimed by ${message.author}.`);
    return;
  }

  if (command === 'unclaim') {
    const ticketType = getTicketTypeForChannel(message.channel);
    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    const existingClaim = claimedTickets.get(message.channel.id);
    if (!existingClaim) {
      return message.reply('This ticket is not currently claimed.');
    }

    if (existingClaim !== message.author.id) {
      return message.reply(`This ticket is claimed by <@${existingClaim}> — only they can unclaim it. Staff can use \`f!forceunclaim\`.`);
    }

    claimedTickets.delete(message.channel.id);
    await message.reply('Ticket unclaimed.');
    return;
  }

  if (command === 'forceunclaim') {
    const ticketType = getTicketTypeForChannel(message.channel);
    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return message.reply('Only staff can use this command.');
    }

    if (!claimedTickets.has(message.channel.id)) {
      return message.reply('This ticket is not currently claimed.');
    }

    claimedTickets.delete(message.channel.id);
    await message.reply('🔓 Ticket forcibly unclaimed.');
    return;
  }

  if (command === 'addmember') {
    const ticketType = getTicketTypeForChannel(message.channel);
    if (!ticketType) {
      return message.reply('This command can only be used inside a ticket channel.');
    }

    const member = message.mentions.members?.first();
    if (!member) {
      return message.reply('Usage: `f!addmember @user`');
    }

    try {
      await message.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      await message.reply(`✅ Added ${member} to this ticket.`);
    } catch (error) {
      console.error(error);
      message.reply('⚠️ Failed to add that member — check the bot has Manage Channels permission here.');
    }
  }
});

// Slash commands + buttons
client.on(Events.InteractionCreate, async (interaction) => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const errorMessage = { content: 'There was an error running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'marketplace_select') {
      const marketplaceCommand = client.commands.get('marketplace');
      const item = marketplaceCommand?.MARKETPLACE_ITEMS.find(
        (i) => i.value === interaction.values[0]
      );

      const replyContainer = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(item ? item.content : 'Category not found.')
      );

      await interaction.reply({
        components: [replyContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (!interaction.isButton()) return;

  // Docksys Roblox verification flow — starts a session, sends the user a
  // link, then long-polls for completion and assigns the verified role(s).
  if (interaction.customId === 'dock_verify_start') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let session;
    try {
      session = await createVerificationSession(interaction.user.id, interaction.guild.id);
    } catch (error) {
      console.error('Failed to create Dock verification session:', error);
      return interaction.editReply('⚠️ Could not start verification right now. Try again in a moment.');
    }

    const verifyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Open Verification Link').setStyle(ButtonStyle.Link).setURL(session.verifyUrl)
    );

    await interaction.editReply({
      content: '🔗 Click below to verify with Dock. This message will update automatically once you finish.',
      components: [verifyRow],
    });

    // Long-poll for up to ~2 minutes (5 rounds of 25s waits) until the
    // session resolves, then update the reply and assign the role.
    for (let i = 0; i < 5; i++) {
      let status;
      try {
        status = await getSessionStatus(session.sid, 25);
      } catch (error) {
        console.error('Failed to poll Dock verification session:', error);
        break;
      }

      if (status.result) {
        try {
          if (process.env.DOCKSYS_VERIFIED_ROLE_ID) {
            await interaction.member.roles.add(process.env.DOCKSYS_VERIFIED_ROLE_ID);
            await interaction.member.roles.add(process.env.DOCKSYS_VERIFIED_ROLE_ID_2);
          }
        } catch (error) {
          console.error('Failed to assign verified role:', error);
        }

        await interaction.editReply({
          content: `✅ Verified! Your Roblox account (ID \`${status.result.robloxId}\`) is now linked.`,
          components: [],
        });
        return;
      }

      if (status.status === 'expired' || status.status === 'cancelled') {
        await interaction.editReply({
          content: `❌ Verification ${status.status}. Click **Verify** again to retry.`,
          components: [],
        });
        return;
      }
      // still pending — loop continues to the next long-poll
    }

    await interaction.editReply({
      content: '⏱️ Verification timed out waiting for completion. Click **Verify** again if you\'re still trying.',
      components: [],
    });
    return;
  }

  // Session vote button — one vote per user; hitting the goal locks voting
  // and asks High Ranking to confirm before the SSU actually goes out.
  if (interaction.customId === 'session_vote') {
    const vote = activeBoosts.get(interaction.message.id);
    if (!vote) {
      return interaction.reply({ content: 'This vote is no longer active.', ephemeral: true });
    }
    if (vote.votes.has(interaction.user.id)) {
      return interaction.reply({ content: 'You already voted.', ephemeral: true });
    }

    vote.votes.add(interaction.user.id);

    if (vote.votes.size >= vote.goal) {
      activeBoosts.delete(interaction.message.id);

      const sessionvoteCommand = client.commands.get('sessionvote');
      const doneContainer = sessionvoteCommand.buildVoteContainer(
        `${vote.message}\n\n✅ **Goal reached!**`,
        vote.votes.size,
        vote.goal
      );
      await interaction.update({ components: [doneContainer], flags: MessageFlags.IsComponentsV2 });

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ssu_confirm').setLabel('Confirm SSU').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ssu_decline').setLabel('Decline').setStyle(ButtonStyle.Secondary)
      );

      const confirmMessage = await interaction.channel.send({
        content: `<@&${process.env.HIGH_RANKING_TEAM}> The session vote goal was reached — start the session?`,
        components: [confirmRow],
        allowedMentions: { roles: [process.env.HIGH_RANKING_TEAM] },
      });

      pendingSsuConfirmations.set(confirmMessage.id, { message: vote.message });
    } else {
      const sessionvoteCommand = client.commands.get('sessionvote');
      const updatedContainer = sessionvoteCommand.buildVoteContainer(vote.message, vote.votes.size, vote.goal);
      await interaction.update({ components: [updatedContainer], flags: MessageFlags.IsComponentsV2 });
    }
    return;
  }

  // High Ranking confirms the session vote — sends the actual SSU panel
  if (interaction.customId === 'ssu_confirm') {
    const pending = pendingSsuConfirmations.get(interaction.message.id);
    if (!pending) return;

    if (!interaction.member.roles.cache.has(process.env.HIGH_RANKING_TEAM)) {
      return interaction.reply({ content: 'Only High Ranking Team can confirm this.', ephemeral: true });
    }

    pendingSsuConfirmations.delete(interaction.message.id);
    await interaction.update({ content: `✅ Confirmed by ${interaction.user}. Sending SSU...`, components: [] });

    const payload = await buildSsuAnnouncement(pending.message);
    await interaction.channel.send(payload);
    return;
  }

  // High Ranking declines the session vote
  if (interaction.customId === 'ssu_decline') {
    const pending = pendingSsuConfirmations.get(interaction.message.id);
    if (!pending) return;

    if (!interaction.member.roles.cache.has(process.env.HIGH_RANKING_TEAM)) {
      return interaction.reply({ content: 'Only High Ranking Team can respond to this.', ephemeral: true });
    }

    pendingSsuConfirmations.delete(interaction.message.id);
    await interaction.update({ content: `❌ SSU declined by ${interaction.user}.`, components: [] });
    return;
  }

  // Close ticket button — pings the opener to confirm instead of closing immediately
  if (interaction.customId === 'close_ticket') {
    const ticketType = getTicketTypeForChannel(interaction.channel);
    if (!ticketType) return;

    if (interaction.user.id !== ticketType.openerId) {
      return interaction.reply({
        content: 'Only the ticket opener can close this ticket. Staff can use `f!forceclose` if needed.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();
    await sendCloseRequest(interaction.channel, ticketType);
    return;
  }

   // Opener confirms the close
  if (interaction.customId === 'close_confirm') {
    const ticketType = getTicketTypeForChannel(interaction.channel);
    if (!ticketType) return;

    if (interaction.user.id !== ticketType.openerId) {
      return interaction.reply({
        content: 'Only the ticket opener can respond to this.',
        ephemeral: true,
      });
    }

    pendingCloseRequests.delete(interaction.message.id);

    await interaction.reply('Closing this ticket in 5 seconds...');
    ticketChannels.delete(interaction.channel.id);
    claimedTickets.delete(interaction.channel.id);
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
    return;
  }

  // Opener declines the close — deletes both the close-request trigger
  // message (if this was started via f!closerequest) and the confirm prompt
  // itself, instead of leaving a reply behind.
  if (interaction.customId === 'close_cancel') {
    const ticketType = getTicketTypeForChannel(interaction.channel);
    if (!ticketType) return;

    if (interaction.user.id !== ticketType.openerId) {
      return interaction.reply({
        content: 'Only the ticket opener can respond to this.',
        ephemeral: true,
      });
    }

    const pending = pendingCloseRequests.get(interaction.message.id);
    pendingCloseRequests.delete(interaction.message.id);

    await interaction.deferUpdate();

    if (pending?.triggerMessage) {
      await pending.triggerMessage.delete().catch(() => {});
    }
    await interaction.message.delete().catch(() => {});
    return;
  }

  // One of the 4 ticket-open buttons
  const ticketType = TICKET_TYPES[interaction.customId];
  if (!ticketType) return;

  if (!ticketType.roleId) {
    return interaction.reply({
      content: `The role for "${ticketType.label}" isn't configured yet. Ask an admin to set it up.`,
      ephemeral: true,
    });
  }

  if (TICKET_BANNED_USERS.has(interaction.user.id)) {
    return interaction.reply({
      content: 'You are not permitted to open tickets.',
      ephemeral: true,
    });
  }

  const existing = interaction.guild.channels.cache.find(
    (c) => c.name === `${ticketType.prefix}-${interaction.user.username.toLowerCase()}`
  );
  if (existing) {
    return interaction.reply({ content: `You already have a ticket open: ${existing}`, ephemeral: true });
  }

  // The ticket's type key + opener ID are stored in the channel topic (not
  // just in memory) so they survive bot restarts — f!rename only changes the
  // name, never the topic, so this stays intact no matter how the channel
  // gets renamed later.
  const ticketTopic = `ticket|${interaction.customId}|${interaction.user.id}`;

  const channel = await interaction.guild.channels.create({
    name: `${ticketType.prefix}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: ticketType.categoryId || undefined,
    topic: ticketTopic,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: ticketType.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

  // Register this channel as a ticket by ID (plus who opened it), so it's
  // still recognized as one even after being renamed with f!rename.
  ticketChannels.set(channel.id, { ...ticketType, openerId: interaction.user.id });

  const ticketContainer = new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${ticketType.label} Ticket`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Hey ${interaction.user}, welcome to your ticket! <@&${ticketType.roleId}> will be with you shortly.`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      )
    );

  await channel.send({
    components: [ticketContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
});

client.login(process.env.TOKEN);