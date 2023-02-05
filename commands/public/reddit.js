const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageAttachment, Permissions } = require("discord.js");
const settings = require("../../settings.json");
const redditApi = require("../../DAL/redditApi");
const { ChannelTypes } = require('discord.js/typings/enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reddit')
		.setDescription('Configure a subreddit to follow')
        .addSubcommand(subcommand => 
            subcommand.setName("follow")
                .setDescription("Subscribe to a subreddit")
                .addStringOption(option =>
                    option.setName("name")
                        .setDescription("The name of the subreddit")
                        .setRequired(true))
                .addChannelOption(option => 
                    option.setName("channel")
                        .setDescription("The channel to crosspost to")
                        .addChannelTypes(ChannelTypes.GUILD_TEXT)
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName("flair")
                        .setDescription("Filter to only this flair")))
        .addSubcommand(subcommand => 
            subcommand.setName("unfollow")
                .setDescription("Stop following a subreddit in a channel")
                .addStringOption(option =>
                    option.setName("name")
                        .setDescription("The name of the subreddit")
                        .setRequired(true))
                .addChannelOption(option => 
                    option.setName("channel")
                        .setDescription("The channel to stop following in")
                        .setRequired(true))),
	async execute(interaction) {
        if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) {
            await interaction.reply({ content: "You need the MANAGE_CHANNELS permission to run this command" });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        let name = interaction.options.getString("name");
        const channel = interaction.options.getChannel("channel");

        name = name.toLowerCase().trim();

        if (name.indexOf("r/") !== 0) {
            if (/\s/g.test(name)) {
                await interaction.reply({ content: "Subreddit names cannot contain whitespace" });
                return;
            }
        }

        switch (subcommand) {
            case "follow":
                const flair = interaction.options.getString("flair");

                // verify we can access the subreddit
                const posts = await redditApi.getNewPosts(name, 1);

                if (!posts || posts.length === 0) {
                    await interaction.reply({ content: "Either this subreddit has no posts or it is private" });
                    return;
                }

                return;
            case "unfollow":

                return;
        }

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