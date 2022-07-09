const { SlashCommandBuilder } = require('@discordjs/builders');
const { Permissions } = require("discord.js");
const { pickSplatfestTeam, setServerRoles, deleteServerRoles } = require("../../DAL/splatfestApi");

/**
 * 
 * @param {CommandInteraction} interaction The user interaction
 */
async function join(interaction) {
    const team = interaction.options.getString("team");

    if (new Date().valueOf() <= 1657454340) {
        await interaction.reply({ content: `Team voting has not started yet!  Please try July 10 after 8AM ET!` });
        return;
    }

    if (await pickSplatfestTeam(interaction.member.user.id, team)) {
        // TODO: abstract this
        await interaction.reply({ content: `You've joined team ${team === "alpha" ? "Squid Sisters" : "Off The Hook"}!`});
    } else {
        await interaction.reply({ content: `Something went wrong. Did you already pick a team?`});
    }
}

/**
 * 
 * @param {CommandInteraction} interaction The user interaction
 */
async function enable(interaction) {
    if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) {
        await interaction.reply({ content: "You need the MANAGE_CHANNELS permission to run this command" });
        return;
    }
    const { id:squidsisters } = interaction.options.getRole("squidsisters");
    const { id:offthehook } = interaction.options.getRole("offthehook");

    if (await setServerRoles(interaction.guild.id, squidsisters, offthehook)) {
        await interaction.reply(`You're all set!\nSquid Sisters is set to <@&${squidsisters}>.\nOff the Hook is set to <@&${offthehook}>.`);
    }
}

/**
 * 
 * @param {CommandInteraction} interaction The user interaction
 */
async function disable(interaction) {
    if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) {
        await interaction.reply({ content: "You need the MANAGE_CHANNELS permission to run this command" });
        return;
    }

    await deleteServerRoles(interaction.guild.id);
}

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
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case "join":
                    return await join(interaction);
                case "enable":
                    return await enable(interaction);
                case "disable":
                    return await disable(interaction);
                default: 
                    return interaction.reply({ content: "Invalid request" });
            }
        } catch (err) {
            console.log(`Error in /splatfest: ${err.toString()}`);
        }
	},
};