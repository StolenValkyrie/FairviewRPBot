const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require('discord.js');
const { getServerStatus } = require('../lib/erlc');

// Trims a list of names down for display, showing "+N more" past the cap
// so the message doesn't blow past Discord's length limits on full servers.
function formatNameList(names, cap = 15) {
  if (names.length === 0) return 'None';
  const shown = names.slice(0, cap).join(', ');
  const remaining = names.length - cap;
  return remaining > 0 ? `${shown}, +${remaining} more` : shown;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Show live ER:LC server stats'),

  async execute(interaction) {
    await interaction.deferReply();

    let status;
    try {
      status = await getServerStatus({ players: true, staff: true, queue: true });
    } catch (error) {
      console.error('ER:LC API error during /serverstats:', error);
      return interaction.editReply('⚠️ Could not reach the ER:LC API. Double check `ERLC_API_KEY` in `.env` and try again.');
    }

    const playerNames = (status.Players || []).map((p) => p.Player.split(':')[0]);
    const staffAll = {
      ...(status.Staff?.Admins || {}),
      ...(status.Staff?.Mods || {}),
      ...(status.Staff?.Helpers || {}),
    };
    const staffNames = Object.values(staffAll);
    const queueCount = (status.Queue || []).length;

    const container = new ContainerBuilder()
      .setAccentColor(0x5865f2)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# 📡 ${status.Name}`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Players:** ${status.CurrentPlayers}/${status.MaxPlayers}\n` +
          `**In Queue:** ${queueCount}\n` +
          `**Join Code:** \`${status.JoinKey}\`\n` +
          `**Account Verification:** ${status.AccVerifiedReq}\n` +
          `**Team Balance:** ${status.TeamBalance ? 'On' : 'Off'}`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Staff Online (${staffNames.length}):** ${formatNameList(staffNames)}`
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Players In-Game (${playerNames.length}):** ${formatNameList(playerNames)}`
        )
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
