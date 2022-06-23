const { SlashCommandBuilder } = require('@discordjs/builders');
const discordApi = require("../../DAL/discordApi");
const settings = require("../../settings.json");

const roles = settings.colorRoles ?? [];
const inkRoles = settings.inkColorRoles ?? [];
const unmanagedRoles = settings.unmanagedColorRoles ?? [];

const allRoles = roles.concat(inkRoles);
const everyRole = allRoles.concat(unmanagedRoles);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('choose')
		.setDescription('Join Team Alpha, Team Bravo, or leave the team.  Role colors change daily.')
        .addStringOption(option =>
            option.setName("team")
                .setDescription("Pick a team or remove the role")
                .setRequired(true)
                .addChoices(
                    { name: "Alpha", value: "alpha" },
                    { name: "Bravo", value: "bravo" },
                    { name: "Leave", value: "leave" }
                )),
	async execute(interaction) {
        var team = interaction.options.getString("team");

        switch (team) {
            case "alpha":
                await discordApi.addColorRoles([inkRoles[0]], interaction.member.id, everyRole);
                await interaction.reply({ content: "You've joined the Alpha Team!" });
                break;
            case "bravo":
                await discordApi.addColorRoles([inkRoles[1]], interaction.member.id, everyRole);
                await interaction.reply({ content: "You've joined the Bravo Team!" });
                break;
            case "leave":
                await discordApi.removeColorRoles(allRoles, interaction.member.id);
                await interaction.reply({ content: "You've left the team!" });
                break;
        }
	},
};