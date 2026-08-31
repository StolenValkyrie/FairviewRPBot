const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');

// Shared help content, used by both f!help and /help so the two never
// drift out of sync — edit this one file when commands change.
function buildHelpContainer() {
  return new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📖 Command Help')
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**General**\n' +
        '`f!ping` — Check the bot is online\n' +
        '`/say` · `f!say [message]` — Make the bot say something\n' +
        '`/serverstats` — Show live ER:LC server stats\n' +
        '`/help` · `f!help` — Show this menu'
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Tickets** *(used inside a ticket channel)*\n' +
        '`f!rename [name]` — Rename the ticket\n' +
        '`f!addmember @user` — Add a user to the ticket\n' +
        '`f!closerequest` — Ask to close *(opener only)*\n' +
        '`f!claim` / `f!unclaim` — Claim or release *(matching team role)*\n' +
        '`f!forceclose` / `f!forceunclaim` — Staff override'
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Staff**\n' +
        '`/ticketsetup` — Post the ticket panel\n' +
        '`/marketplace` — Post the marketplace browser\n' +
        '`/ssu` · `/ssd` — SSU / SSD announcements\n' +
        '`/sessionvote` — Vote to start a session, escalates to a High Ranking SSU confirmation'
      )
    );
}

module.exports = { buildHelpContainer };