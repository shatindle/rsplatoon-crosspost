const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('splatfest')
		.setDescription('Pick a side, and participate in a cross-server splatfest!')
        .addSubcommand(subcommand => 
            subcommand.setName("join")
                .setDescription("Join a splatfest team!  Note that you cannot change it.")
                .addStringOption(option =>
                    option.setName("team")
                        .setDescription("The team you want to join")
                        .addChoices(
                            { name: "squidsisters", value: "alpha" },
                            { name: "offthehook", value: "bravo" }
                        )
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName("enable")
                .setDescription("Setup your server for a splatfest!")
                .addRoleOption(option =>
                    option.setName("squidsisters")
                        .setDescription("The role for the Squid Sisters")
                        .setRequired(true))
                .addRoleOption(option => 
                    option.setName("offthehook")
                        .setDescription("The role for Off the Hook")
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName("disable")
                .setDescription("Turn off splatfests for this server.")),
	async execute(interaction) {
        await interaction.reply({ content: "These commands are still being setup for the Custom Splatfest.  Check back again in a few days for when these commands are enabled!" });
        return;
	},
};