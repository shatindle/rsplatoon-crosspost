const { SlashCommandBuilder } = require('@discordjs/builders');
const { CommandInteraction, Permissions } = require("discord.js");
const { fridges, createFridge, init, removeFridge, addFridgeSource, removeFridgeSource } = require("../../DAL/fridgeApi");

init();

const emoteRegex = /<a?:.+:(\d+)>/gmi

/**
 * 
 * @param {CommandInteraction} interaction The user interaction
 */
async function install(interaction) {
    const { id:fromId } = interaction.options.getChannel("from");
    const { id:toId } = interaction.options.getChannel("to");

    let upvote = interaction.options.getString("upvote");

    // look for static then animated emoji
    const regularEmoji = emoteRegex.exec(upvote);

    if (regularEmoji) {
        // second param is the ID
        upvote = regularEmoji[1];
    }

    let votes = interaction.options.getInteger("votes");
    let color = interaction.options.getString("color");
    const guildId = interaction.guild.id;

    try {
        // verify the upvote is just an emoji (either default or literal emoji)
        const serverEmoji = await interaction.guild.emojis.fetch(upvote);

        if (serverEmoji === null || serverEmoji.id !== upvote) {
            await interaction.reply({ content: "Error: The upvote emoji must be a custom emoji in this server." });
            return;
        }
    } catch {
        await interaction.reply({ content: "Error: The upvote emoji must be a custom emoji in this server." });
        return;
    }

    if (!votes || votes < 2) votes = 5;

    const formattedColor = color ? color.toLowerCase().replace(/[^0-9a-f]/g,'') : null;

    if (!color || !/^[0-9a-f]{6}$/i.test(formattedColor)) color = "ffd635";
    else color = formattedColor;

    // verify the to and from channels are not the same
    if (fromId === toId) {
        await interaction.reply({ content: "Error: The 'to' and 'from' channels must be different channels." });
        return;
    }

    // get current starboards
    let currentStarboard = fridges[guildId] ? fridges[guildId].fridges : null;

    // verify the target does not already have a starboard
    if (currentStarboard && currentStarboard.filter(t => t.target === toId).length > 0) {
        await interaction.reply({ content: "Error: The 'to' channel is already a starboard.  Each channel can only be 1 starboard target." });
        return;
    }

    // verify the source does not already have a starboard
    if (currentStarboard && currentStarboard.filter(t => t.sources.indexOf(fromId) > -1).length > 0) {
        await interaction.reply({ content: "Error: The 'from' channel is already a source for a starboard.  Each channel can only be 1 starboard source." });
        return;
    }

    // verify both channels are text channels
    if (interaction.guild.channels.cache.get(fromId).type !== "GUILD_TEXT") {
        await interaction.reply({ content: "Error: The 'from' channel is must be a text channel." });
        return;
    }

    if (interaction.guild.channels.cache.get(toId).type !== "GUILD_TEXT") {
        await interaction.reply({ content: "Error: The 'to' channel is must be a text channel." });
        return;
    }

    await createFridge(guildId, fromId, toId, upvote, votes, color, interaction.user.id);

    await interaction.reply({ content: `Your fridge <#${toId}> has been created!`});
}

/**
 * 
 * @param {CommandInteraction} interaction The user interaction
 */
async function uninstall(interaction) {
    const index = interaction.options.getInteger("id", false) ?? 0;
    const guildId = interaction.guild.id;

    // get current starboards
    let serverFridges = fridges[guildId] ? fridges[guildId] : null;

    // confirm fridge actually exists
    if (!serverFridges) {
        await interaction.reply({ content: "Error: This server does not have a fridge." });
        return;
    }

    if (!serverFridges.fridges[index]) {
        await interaction.reply({ content: "Error: The requested fridge index does not exist." });
        return;
    }

    await removeFridge(guildId, index);
    await interaction.reply({ content: `Your fridge has been removed!`});
}

/**
 * 
 * @param {CommandInteraction} interaction The user interaction
 */
async function list(interaction) {
    const guildId = interaction.guild.id;
    
    // get current starboards
    let serverFridges = fridges[guildId] ? fridges[guildId] : null;

    // confirm fridge actually exists
    if (!serverFridges) {
        await interaction.reply({ content: "This server does not have a fridge." });
        return;
    }

    let response = "__Current server fridges__";

    serverFridges.fridges.forEach((fridge, index) => {
        const emoji = interaction.client.emojis.cache.get(fridge.upvote).toString();
        const from = fridge.sources.map((source) => `<#${source}>`).join(', ');
        response += `
**ID:** ${index}
**From:** ${from}
**To:** <#${fridge.target}>
**Reaction:** ${emoji}
**Votes:** ${fridge.count}
**Border:** #${fridge.color}
`;
    });

    await interaction.reply({ content: response });
}

async function add(interaction) {
    const { id:fromId } = interaction.options.getChannel("from");
    const { id:toId } = interaction.options.getChannel("to");
    const guildId = interaction.guild.id;
    let targetIndex;
    
    // get current starboards
    let serverFridges = fridges[guildId] ? fridges[guildId] : null;

    // confirm fridge actually exists
    if (!serverFridges) {
        await interaction.reply({ content: "This server does not have a fridge." });
        return;
    }

    serverFridges.fridges.forEach((fridge, index) => fridge.target === toId ? targetIndex = index : null);

    if (typeof targetIndex !== "number") {
        await interaction.reply({ content: "Error: The requested fridge index does not exist." });
        return;
    }

    if (serverFridges.fridges[targetIndex].sources.filter((source) => source === fromId).length > 0) {
        await interaction.reply({ content: "Error: This channel is already a source for this fridge." });
        return;
    }

    // get current starboards
    let currentStarboard = serverFridges.fridges;

    // verify the source does not already have a starboard
    if (currentStarboard.filter(t => t.sources.indexOf(fromId).length > -1).length > 0) {
        await interaction.reply({ content: "Error: The 'from' channel is already a source for a starboard.  Each channel can only be 1 starboard source." });
        return;
    }

    await addFridgeSource(guildId, targetIndex, fromId);
    await interaction.reply({ content: `<#${fromId}> has been added as a source for the fridge <#${toId}>!`});
}

async function remove(interaction) {
    const { id:fromId } = interaction.options.getChannel("from");
    const { id:toId } = interaction.options.getChannel("to");
    const guildId = interaction.guild.id;
    let targetIndex;
    
    // get current starboards
    let serverFridges = fridges[guildId] ? fridges[guildId] : null;

    // confirm fridge actually exists
    if (!serverFridges) {
        await interaction.reply({ content: "This server does not have a fridge." });
        return;
    }

    serverFridges.fridges.forEach((fridge, index) => fridge.target === toId ? targetIndex = index : null);

    if (typeof targetIndex !== "number") {
        await interaction.reply({ content: "Error: The requested fridge index does not exist." });
        return;
    }

    if (serverFridges.fridges[targetIndex].sources.filter((source) => source === fromId).length === 0) {
        await interaction.reply({ content: "Error: This channel is not currently a source for this fridge." });
        return;
    }

    if (serverFridges.fridges[targetIndex].sources.length === 1) {
        await interaction.reply({ content: "Error: This fridge only has one source. All fridges must have at least one source. If you want to delete the fridge, use /fridge uninstall id:NUMBER" });
        return;
    }

    await removeFridgeSource(guildId, targetIndex, fromId);
    await interaction.reply({ content: `<#${fromId}> has been removed as a source for the fridge <#${toId}>!`});
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('fridge')
		.setDescription('Manage your server fridge!  Decide what emoji should be used to configure it.')
        .addSubcommand(subcommand => 
            subcommand.setName("install")
                .setDescription("Setup a basic fridge.  Messages with enough reactions will be cross posted to it.")
                .addChannelOption(option =>
                    option.setName("from")
                        .setDescription("The channel you want to cross-post from.")
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName("to")
                        .setDescription("The channel you want to cross-post to.")
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName("upvote")
                        .setDescription("The emoji you wish to use to upvote.")
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName("votes")
                        .setDescription("The number of votes it takes to cross-post.  Default is 5.  Minimum is 2."))
                .addStringOption(option =>
                    option.setName("color")
                        .setDescription("The border color.  Default is #ffd635.")))
        .addSubcommand(subcommand => 
            subcommand.setName("uninstall")
                .setDescription("Remove a fridge.")
                .addIntegerOption(option =>
                    option.setName("id")
                        .setDescription("The ID of the fridge to remove.")))
        .addSubcommand(subcommand => 
            subcommand.setName("list")
                .setDescription("List the fridges in your server."))
        .addSubcommand(subcommand => 
            subcommand.setName("add")
                .setDescription("Add an additional source to a fridge.")
                .addChannelOption(option =>
                    option.setName("from")
                        .setDescription("The additional channel you want to cross-post from.")
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName("to")
                        .setDescription("The channel you want to cross-post to.")
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName("remove")
                .setDescription("Remove a source to a fridge.  You must have at least 1 source.")
                .addChannelOption(option =>
                    option.setName("from")
                        .setDescription("The channel you no longer want to cross-post from.")
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName("to")
                        .setDescription("The channel you want to cross-post to.")
                        .setRequired(true))),
	async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) {
                await interaction.reply({ content: "You need the MANAGE_CHANNELS permission to run this command" });
                return;
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case "install":
                    return await install(interaction);
                case "uninstall":
                    return await uninstall(interaction);
                case "list":
                    return await list(interaction);
                case "add":
                    return await add(interaction);
                case "remove":
                    return await remove(interaction);
                default: 
                    return interaction.reply({ content: "Invalid request" });
            }
        } catch (err) {
            console.log(`Error in /fridge: ${err.toString()}`);
        }
	},
};