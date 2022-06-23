const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageAttachment } = require("discord.js");
const settings = require("../../settings.json");
const profileApi = require("../../DAL/profileApi");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('Manage your profile!  Take your link with you wherever you go!  It even works outside of Discord.')
        .addSubcommand(subcommand => 
            subcommand.setName("friendcode")
                .setDescription("Edit your friend code")
                .addStringOption(option =>
                    option.setName("value")
                        .setDescription("Your friend code")
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName("get")
                .setDescription("Get another user's profile")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user for the profile lookup")
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName("me")
                .setDescription("Get your own profile")),
	async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "friendcode") {
            const value = interaction.options.getString("value");

            const response = await profileApi.setProfile(interaction.member.id, value);

            if (response.result === "updated")
                await interaction.reply({ content: `Updated your friend code! To update your username or drip, visit https://profile.rsplatoon.com` });
            else if (response.result)
                await interaction.reply({ content: `Error updating friend code: ${response.result}` });
            else 
                await interaction.reply({ content: "Error updating friend code: unknown error" });
        } else {
            let userToLookup = interaction.member;

            const otherUser = interaction.options.getUser("user");

            if (otherUser)
                userToLookup = otherUser;

            const response = await profileApi.getProfile(userToLookup.id);

            if (response.friendCode) {
                if (response.profileId) {
                    const row = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setURL(settings.profile.url + settings.profile.get + "/" + response.profileId + "?_v=" + new Date().valueOf())
                                .setLabel("Full Profile")
                                .setStyle("LINK")
                        );

                    const attachments = [];

                    if (response.card && response.card !== "NONE") {
                        const profileCard = new MessageAttachment(response.card);
                        attachments.push(profileCard);
                    }

                    await interaction.reply({ 
                        content: `<@${userToLookup.id}>\n**Friend code:** \n${response.friendCode}`, 
                        components: [row], 
                        files: attachments 
                    });
                    

                } else {
                    await interaction.reply({ content: `<@${userToLookup.id}>\n**Friend code:** \n${response.friendCode}` });
                }
            } else {
                await interaction.reply({ content: "Friend code not set" });
            }
        }
	},
};