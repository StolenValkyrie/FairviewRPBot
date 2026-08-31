const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Post the member verification panel'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Only staff can use this command.', flags: MessageFlags.Ephemeral });
    }

    const container = new ContainerBuilder()
      .setAccentColor(0x0A1CEF6)

      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(
            ''
          )
        )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# <:logo:1533740178030723192> Verification')
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'To view the entire server, and be able to join the ERLC server, you must verify your account.'
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('dock_verify_start')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Success)
            .setEmoji(' id : 1533740178030723192 ')
        )
      );

    await interaction.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    return interaction.reply({ content: '✅ Verification panel posted.', flags: MessageFlags.Ephemeral });
  },
};