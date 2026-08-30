const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MessageFlags,
} = require('discord.js');

// ---------------------------------------------------------------------------
// CONFIG: edit this to add/remove/change your marketplace categories.
// Each entry needs a unique `value` (used internally), a `label` (shown in
// the dropdown), and whatever `content` you want shown when it's picked.
// ---------------------------------------------------------------------------
const MARKETPLACE_ITEMS = [
  {
    value: 'paid_ads',
    label: 'Paid Advertisements',
    description: 'Everyone/here pings, sponsored giveaways, instant postage',
    emoji: '📢',
    content: `**Paid Advertisements**
\`@everyone Paid Advertisement\`
[450 Robux](https://www.roblox.com/game-pass/1963807218/Everyone-Ping)

\`@here Paid Advertisement\`
[250 Robux](https://www.roblox.com/game-pass/1962067180/Here-Ping)

\`Sponsored Giveaway\`
[300 Robux](https://www.roblox.com/game-pass/1964113217/SPGW)

**Instant Postage**
\`Instant Postage\`
[1000 Robux](https://www.roblox.com/game-pass/1964065208/Instant-Postage)`,
  },
  {
    value: 'premium_membership',
    label: 'Fairview Premium Membership',
    description: 'Top-tier perks: electric & prestige cars, premium role, and more',
    emoji: '💎',
    content: `**Fairview Plus Membership**
Take your Fairview Roleplay experience to the next level with Plus Membership! Enjoy exclusive perks, additional benefits, and special features as a thank-you for supporting our community. Check out everything included with your Plus Membership below and see what extra benefits await you. Regular purchasing terms and conditions apply.
--------------------------------------------------------------------------------------------------------------------------------------------------------------
**Fairview Premium Perks**
Hoisted @𝐗 | Fairview Premium
• Access to Electric & Prestige Cars!
• No Slowmode in any channel!
• GIF & File Perms anywhere!
• Premium Chat!
• Premium Giveaways!
• Special Premuim Events!
• Fairview Premium Role!
• Add 2 emojis of Your Choice!
• Add 1 Sticker of Your Choice!
• Shout out upon purchasing!
• Luke's Office Key!
• $150,000 In Economy upon purchase!
• VC Streaming & Soundboard Perms
• Permission to send external emojis and stickers anywhere!`,
  },
  {
    value: 'plus_membership',
    label: 'Fairview Plus Membership',
    description: 'Mid-tier perks: electric cars, no slowmode, plus giveaways',
    emoji: '⭐',
    content: `**Fairview Plus Membership**
Take your Fairview Roleplay experience to the next level with Plus Membership! Enjoy exclusive perks, additional benefits, and special features as a thank-you for supporting our community. Check out everything included with your Plus Membership below and see what extra benefits await you. Regular purchasing terms and conditions apply.
--------------------------------------------------------------------------------------------------------------------------------------------------------------
**Fairview Premium Perks**
Hoisted @𝐗 | Fairview Plus
• Access to Electric Cars!
• No Slowmode in any channel!
• GIF & File Perms anywhere!
• Premium Chat!
• Plus Giveaways!
• Add 1 Sticker of Your Choice!
• Shout out upon purchasing!
• $75,000 In Economy upon purchase!
• VC Streaming & Soundboard Perms
• Permission to send external emojis and stickers anywhere!`,
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marketplace')
    .setDescription('Post the marketplace browser (visible to everyone in the channel)'),

  async execute(interaction) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('marketplace_select')
      .setPlaceholder('Choose a category...')
      .addOptions(
        MARKETPLACE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          value: item.value,
          emoji: item.emoji,
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    // Components V2: everything (title, description, dropdown) is built as
    // components inside a Container — there's no separate `embeds` field.
    const container = new ContainerBuilder()
      .setAccentColor(0x5865f2)
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems({
          media: { url: 'https://cdn.phototourl.com/free/2026-08-30-bd68f618-74fa-4d03-8ab7-47ecc70d8b9b.png' },
        })
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(2) // 2 = Large spacing
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 🛒 Marketplace'),
        new TextDisplayBuilder().setContent('Select a category below to browse items.')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(2) // 2 = Large spacing
      )
      .addActionRowComponents(row)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(2) // 2 = Large spacing
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems({
          media: { url: 'https://cdn.phototourl.com/free/2026-08-30-1c0da88b-36b4-4a71-945e-cbd73f745df1.png' },
        })
      );

    // Posted PUBLICLY (no Ephemeral flag) so it stays in the channel and
    // anyone can use the dropdown — not tied to whoever ran the command.
    // IsComponentsV2 is still required whenever sending Container/TextDisplay
    // components, ephemeral or not.
    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

// ---------------------------------------------------------------------------
// HANDLING THE DROPDOWN SELECTION
// This part goes in your main bot file (e.g. index.js), inside your existing
// InteractionCreate listener. Since the marketplace message itself is public,
// this listens for ANY user selecting an option and replies ephemerally to
// THAT user only — so everyone can browse independently off the same message.
// ---------------------------------------------------------------------------
//
// client.on('interactionCreate', async (interaction) => {
//   if (interaction.isStringSelectMenu() && interaction.customId === 'marketplace_select') {
//     const chosenValue = interaction.values[0];
//     const item = MARKETPLACE_ITEMS.find((i) => i.value === chosenValue);
//
//     const replyContainer = new ContainerBuilder().addTextDisplayComponents(
//       new TextDisplayBuilder().setContent(item ? item.content : 'Category not found.')
//     );
//
//     await interaction.reply({
//       components: [replyContainer],
//       flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
//     });
//   }
// });