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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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

// Tracks which ticket channels have been claimed: channelId -> userId
const claimedTickets = new Map();

// Helper: find the ticket type config for a given channel, based on its name prefix
function getTicketTypeForChannel(channel) {
  return Object.values(TICKET_TYPES).find(
    (t) => t.prefix && channel.name.startsWith(`${t.prefix}-`)
  );
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
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commandData }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
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
  await deployCommands();
  updatePresence();
});

// Text commands (f!)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('f!')) return;

  const args = message.content.slice(2).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    message.reply('Pong!');
    return;
  }

  if (command === 'rename') {
    const newName = args.join('-');

    if (!newName) {
      return message.reply('Usage: `f!rename [new-name]`');
    }

    const isTicketChannel = Object.values(TICKET_TYPES).some(
      (t) => t.prefix && message.channel.name.startsWith(`${t.prefix}-`)
    );

    if (!isTicketChannel) {
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

  // Claim ticket button
  if (interaction.customId === 'claim_ticket') {
    const ticketType = getTicketTypeForChannel(interaction.channel);
    if (!ticketType) return;

    if (!interaction.member.roles.cache.has(ticketType.roleId)) {
      return interaction.reply({
        content: `Only members of the ${ticketType.label} team can claim this ticket.`,
        ephemeral: true,
      });
    }

    const existingClaim = claimedTickets.get(interaction.channel.id);
    if (existingClaim) {
      return interaction.reply({
        content: `This ticket is already claimed by <@${existingClaim}>.`,
        ephemeral: true,
      });
    }

    claimedTickets.set(interaction.channel.id, interaction.user.id);
    await interaction.reply(`✋ Ticket claimed by ${interaction.user}.`);
    return;
  }

  // Close ticket button
  if (interaction.customId === 'close_ticket') {
    await interaction.reply('Closing this ticket in 5 seconds...');
    claimedTickets.delete(interaction.channel.id);
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
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

  const existing = interaction.guild.channels.cache.find(
    (c) => c.name === `${ticketType.prefix}-${interaction.user.username.toLowerCase()}`
  );
  if (existing) {
    return interaction.reply({ content: `You already have a ticket open: ${existing}`, ephemeral: true });
  }

  const channel = await interaction.guild.channels.create({
    name: `${ticketType.prefix}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: ticketType.categoryId || undefined,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: ticketType.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

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
          .setCustomId('claim_ticket')
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✋'),
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
