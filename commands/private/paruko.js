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
		.setName('paruko')
		.setDescription('The Paruko Fan gumball machine! Use it to get a Paruko color. Color changes daily.')
        .addStringOption(option =>
            option.setName("action")
                .setDescription("Use the gumball machine or remove the role")
                .setRequired(true)
                .addChoices(
                    { name: "Gumball", value: "gumball" },
                    { name: "Remove", value: "remove" }
                )),
	async execute(interaction) {
        var action = interaction.options.getString("action");

        switch (action) {
            case "gumball":
                await discordApi.addColorRoles(roles, interaction.member.id, everyRole);
                interaction.reply({ content: "You've got a new Paruko Fan role!" });
                break;
            case "remove":
                await discordApi.removeColorRoles(allRoles, interaction.member.id);
                interaction.reply({ content: "You are no longer a Paruko Fan." });
                break;
        }
	},
};