const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Posts the ticket panel in this channel'),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setURL('https://cdn.phototourl.com/free/2026-08-30-030f26f4-1853-4fa1-bcfe-5d949778c5f6.png')
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# <:logo:1533740178030723192> Support Tickets')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'Click the button below that best matches why you need a ticket. Our team will assist you shortly.'
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_general_support')
            .setLabel('General Support')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: '1533740178030723192' }),
          new ButtonBuilder()
            .setCustomId('ticket_high_ranking')
            .setLabel('High Ranking')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: '1533740178030723192' }),
          new ButtonBuilder()
            .setCustomId('ticket_directors_board')
            .setLabel('Directors Board')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: '1533740178030723192' }),
          new ButtonBuilder()
            .setCustomId('ticket_ia')
            .setLabel('IA')
            .setStyle(ButtonStyle.Primary)
            .setEmoji({ id: '1533740178030723192' })
        )
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setURL('https://cdn.phototourl.com/free/2026-08-30-1c0da88b-36b4-4a71-945e-cbd73f745df1.png')
        )
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};