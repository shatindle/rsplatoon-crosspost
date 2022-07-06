const { Client, Intents, Message, MessageReaction, User} = require('discord.js');
const fetchWithTimeout = require("./fetchWithTimeout");

const discord = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_MEMBERS
    ], 
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'] 
});

const settings = require("../settings.json");
const thisGuild = settings.guild;


// the list of callback to run through when a message is deleted
var deleteCallbacks = [];

// the list of callbacks to run through when a message is reacted to
var reactionCallbacks = [];

// the list of callbacks to run through when a message is seen
var messageCallbacks = [];

// the list of interactions we support via slash commands
var interactionCallbacks = {};

/** 
 * @description The callback function to execute for a deleted post
 * @param {string} messageId The Discord ID that was deleted
 * @param {string} guildId The ID of the guild this message was deleted from
 * @param {string} deletedBy The Discord handle of the user that deleted the post in Discord
 */
function onDeleteCallback(messageId = "", guildId = "", deletedBy = "") { }

/**
 * @description The callback function to execute for a reaction to a post
 * @param {MessageReaction} reaction An unfetched message the user reacted to
 * @param {User} user The user that reacted
 */
async function onReactionCallback(reaction, user) { }

/** 
 * @description The callback function to execute for a message post
 * @param {Message} message The Discord message
 */
function onMessageCallback(message) { }

/** 
 * @description Add a function to ondelete callback
 * @param {onDeleteCallback} callback A function that will execute when a message is deleted.  MessageId, GuildId, and DeletedBy will be provided.
 */
function onDelete(callback = onDeleteCallback) {
    deleteCallbacks.push(callback);
}

/** 
 * @description Add a function to onmessage callback
 * @param {onDeleteCallback} callback A function that will execute when a message is sent by a user.  Message will be provided.
 */
function onMessage(callback = onMessageCallback) {
    messageCallbacks.push(callback);
}

function onReaction(callback = onReactionCallback) {
    reactionCallbacks.push(callback);
}

/** 
 * @description Gets the message history for a channel, sorted by newest
 * @param {*} channelId The channel ID
 * @param {*} limit The maximum number of messages to retrieve
 * @returns {Array} List of messages
 */
async function getMessageHistory(
    channelId = "",
    limit = 10) {

    var channel = await discord.channels.fetch(channelId);
    
    var lastMessages = (await channel.messages.fetch({ limit: limit })).first(10);

    var list = [];

    for (var i = 0; i < lastMessages.length; i++) {
        list.push({
            text: lastMessages[i].content,
            authorId: lastMessages[i].author.id,
            embeds: lastMessages[i].embeds,
            createdOn: new Date(lastMessages[i].createdTimestamp),
            messageLink: lastMessages[i].url
        })
    }

    return list;
}

/** 
 * @description Gets the bot's ID
 * @returns {string} The bot ID
 */
function getBotId() {
    return discord.user.id;
}

/** 
 * @description Post a message to discord
 * @param {string} channelId The channel ID to post this message to
 * @param {string} title The title of the post
 * @param {string} text The text of the post (if any)
 * @param {string} imageUrl The image link (if any)
 * @param {string} link The link to the post in Reddit
 * @param {string} author The author of the post on Reddit (in the form of u/author)
 * @param {string} authorIcon The icon of the author on Reddit
 * @param {number} color The color of the flair
 * @param {number} timestamp The UTC epoch date the post was made
 * @param {string} flairText The text of the flair used in Reddit
 * 
 * @returns {Promise<string>} The discord ID of the post
 */
async function postRedditToDiscord(
    channelId = "", 
    title = "", 
    text = "", 
    imageUrl = "", 
    link = "", 
    author = "u/", 
    authorIcon = "", 
    color = 0, 
    timestamp = 0, 
    flairText = "", 
    interaction = null) {

    // handle discord links
    var discordLinkPattern = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li|com)|discordapp\.com\/invite)\/[a-zA-Z0-9_.-]+/g;
    text = text.replace(discordLinkPattern, "[discord link]");
    title = title.replace(discordLinkPattern, "[discord link]");

    // handle spoilers
    var spoilerPattern = /(?<start>\>\!)(?<mid>[^<]+)(?<end><)/g;
    text = text.replace(spoilerPattern, "||$<mid>||");

    if (title.length > 256)
        title = title.substring(0, 250) + "...";

    // post the content
    var contentToSend = {
        embeds: [{
            title: title,
            description: text,
            url: link,
            color: color,
            thumbnail: {
                url: (settings.specialFlairs.art.indexOf(flairText) > -1 || settings.specialFlairs.contest.indexOf(flairText) > -1) && imageUrl ? imageUrl : null
            },
            timestamp: new Date(timestamp * 1000).toISOString(),
            author: {
                name: author,
                url: author.substring(0, 2) === "u/" ? "https://reddit.com/user/" + author.substring(2) : null,
                icon_url: authorIcon ? authorIcon : null
            },
            footer: {
                text: flairText
            }
        }]
    };
    if (interaction === null) {
        // respond with a regular message
        try {
            var channel = await discord.channels.fetch(channelId);
            
            var message = await channel.send(contentToSend);

            try {
                let isImage = false;
                try {
                    var imgtest = await fetchWithTimeout(imageUrl, {
                        method: "HEAD", 
                        timeout: 1000
                    });

                    if (imgtest.headers.get("Content-Type").indexOf("image/") > -1)
                        isImage = true;
                } catch (fail_img_check) {
                    // nothing to do
                }

                if (isImage)
                    // don't wait for this...
                    postAttachments(
                        channelId,
                        [imageUrl]
                    );
            } catch (image_err) {
                console.log(`unable to post image: ${image_err.toString()}`);
            }
    
            // @ts-ignore
            return message.id;
        } catch (err) {
            console.log("offending link: " + err.toString());
        }
    } else {
        // this is sending an interaction
        // respond directly to the interaction
        await interaction.reply(contentToSend);
    }
}

async function postTwitterToDiscord(
    channelId = "",
    color = 0,
    username = "",
    text = "",
    translatedText = "",
    createdOn = "",
    url = "",
    attachments = [],
    tweetPingRole = null) {

    const contentToSend = {
        embeds: [{
            title: "News from @" + username,
            color,
            description: text !== translatedText ? text + "\n\n__Translation__\n" + translatedText : text,
            timestamp: createdOn
        }]
    };

    if (tweetPingRole)
        contentToSend.content = `<@&${tweetPingRole}>`;

    if (attachments && attachments.length > 0) {
        for (let i = 0; i < attachments.length; i++) {
            if (i !== 0) {
                contentToSend.embeds.push({
                    url,
                    image: {}
                });
            } else {
                contentToSend.embeds[0].url = url;
                contentToSend.embeds[0].image = {};
            }

            contentToSend.embeds[i].image.url = attachments[i].url;
        }
    }

    // respond with a regular message
    try {
        var channel = await discord.channels.fetch(channelId);
        
        var message = await channel.send(contentToSend);
        
        try {
            if (message.channel.type === "GUILD_NEWS")
                // do not wait for crosspost to finish
                message.crosspost().catch(e => console.log(e));
        } catch (cross_err) {
            console.log("Unable to crosspost: " + cross_err);
        }

        // @ts-ignore
        return message.id;
    } catch (err) {
        console.log("offending link: " + imageUrl);
    }
}

async function postAttachments(channelId = "", attachments = []) {
    // post the content
    try {
        var channel = await discord.channels.fetch(channelId);
        
        var message = await channel.send({
            files: attachments
        });

        // @ts-ignore
        return message.id;
    } catch (err) {
        console.log("attachments could not be sent: " + err);
    }
}

async function postText(channelId = "", text = "") {
    // post the content
    try {
        var channel = await discord.channels.fetch(channelId);
        
        var message = await channel.send(text);

        // @ts-ignore
        return message.id;
    } catch (err) {
        console.log("text could not be sent: " + err);
    }
}

const rateLimitMessages = [
    "You're killing me smalls! Wait a few seconds and try again.",
    "Let me catch my breath please. I'll be back shortly.",
    "Bruh.",
    "Dude, I'm salary. I don't get paid for overtime.",
    "Look. You seem nice. But you're pinging me too much. Give me a bit.",
    "I'm sorry, but I'm not here right now. Please leave your name and number at the beep. **BEEP**",
    "brb mom needs comp",
    "g2g bye",
    "brb hw",
    "I am unavailable because I'm playing a computer game that takes up the entire screen.",
    "brb shower",
    "brb 1 min",
    "I'm going to get grounded if you don't stop constantly pinging me!",
    "brb tornado"
];

/** 
 * @description Tells the user to slow down
 * @param {string} channelId 
 */
async function rateLimit(channelId = "", interaction = null) {
    try {
        var item = rateLimitMessages[Math.floor(Math.random() * rateLimitMessages.length)];

        if (interaction) {
            await interaction.reply(item);
        } else {
            var channel = await discord.channels.fetch(channelId);
        
            await channel.send(item);
        }
        
    } catch (err) {
        console.log("Error ratelimit to channel: " + channelId);
    }
}

/** 
 * @description Tells the user how to use this bot
 * @param {string} channelId 
 */
async function postHelp(channelId = "") {
    try {
        var channel = await discord.channels.fetch(channelId);
        
        await channel.send({
            embeds: [{
                title: "Commands and usage",
                description: 
                    "This bot is designed to pull in new posts from the subreddit automatically every minute. " +
                    "It can distinguish between art and general posts. Additionally, it has some commands you can invoke " +
                    "by mentioning the bot.\n\n" + 
                    "__**Commands**__\n" + 
                    "- **get random** Pulls in a random submission from the subreddit.\n\n" +
                    "- **paruko fan** Adds the Paruko Fan role (does not affect existing fan roles).\n\n" +
                    "[Source Code](https://github.com/shatindle/rsplatoon-crosspost)"
            }]
        });
    } catch (err) {
        console.log("Error sending help to channel: " + channelId);
    }
}

/**
 * @description Sets the color of a role by it's ID
 * @param {string} roleId 
 * @param {string} colorHex 
 */
async function changeRoleColor(roleId, colorHex) {
    var guild = discord.guilds.cache.get(thisGuild);
    var role = guild.roles.cache.get(roleId);
    await role.setColor("#" + colorHex);
}

/**
 * @description Toggle a set of roles (will only assign one randomly)
 * @param {Array<string>} roles 
 * @param {string} userId 
 */
async function toggleColorRoles(roles, userId) {
    var guild = discord.guilds.cache.get(thisGuild);
    var member = await guild.members.fetch({
        user: userId,
        force: true
    });

    var hasRole = member.roles.cache.some(t=> roles.includes(t.id));

    if (hasRole) {
        // remove the roles
        await member.roles.remove(roles);
        return false;
    } else {
        await member.roles.add(roles[Math.floor(Math.random()*roles.length)]);
        return true;
    }
}

/**
 * @description Add a role from a set of roles
 * @param {Array<string>} roles 
 * @param {string} userId 
 */
async function addColorRoles(roles, userId, rolesToRemove = null) {
    var guild = discord.guilds.cache.get(thisGuild);
    var member = await guild.members.fetch({
        user: userId,
        force: true
    });

    if (rolesToRemove)
        await member.roles.remove(rolesToRemove);

    await member.roles.add(roles[Math.floor(Math.random()*roles.length)]);
}

/**
 * @description Remove a set of roles
 * @param {Array<string>} roles 
 * @param {string} userId 
 * @returns 
 */
async function removeColorRoles(roles, userId) {
    var guild = discord.guilds.cache.get(thisGuild);
    var member = await guild.members.fetch({
        user: userId,
        force: true
    });

    await member.roles.remove(roles);
}

// TODO: delete when done
async function giveRole(memberId) {
    var guild = discord.guilds.cache.get(thisGuild);
    var member = await guild.members.fetch({
        user: memberId,
        force: true
    });
    let role = await guild.roles.fetch("959520277396590652");
    await member.roles.add(role);
}

/** 
 * @description Listens for messages it is mentioned in so it can respond
 */
discord.on('messageCreate', async message => {
    // ignore direct messages
    if (!message.guild) return;

    // ignore posts from bots
    if (message.author.bot) return;

    // ignore posts we were not mentioned in
    // if (!message.mentions.has(discord.user)) return;

    // ignore replies
    // if (message.content.indexOf('<@!' + discord.user.id + '>') < 0 && 
    //     message.content.indexOf('<@' + discord.user.id + '>') < 0) return;

    for (var i = 0; i < messageCallbacks.length; i++) {
        try {
            messageCallbacks[i](message);
        } catch { }
    }
    
    // TODO: delete when done
    if (message.channel.id === "959522337177346129")
        await giveRole(message.member.id);
});

discord.on('messageDelete', async message => {
    // ignore direct messages
    if (!message.guild) return;

    if (message.partial) {
        // skip partial messages since there's nothing to do with them
        return;
    }

    // ignore posts we did not make
    if (message.author.id !== discord.user.id) return;

    const fetchedLogs = await message.guild.fetchAuditLogs({
        limit: 1,
        type: 'MESSAGE_DELETE',
    });
    // Since we only have 1 audit log entry in this collection, we can simply grab the first one
    const deletionLog = fetchedLogs.entries.first();

    // Let's perform a coherence check here and make sure we got *something*
    if (!deletionLog) {
        for (var i = 0; i < deleteCallbacks.length; i++) {
            try {
                deleteCallbacks[i](message.id, message.guild.id, null);
            } catch { }
        }
    }

    // We now grab the user object of the person who deleted the message
    // Let us also grab the target of this action to double check things
    const { executor, target } = deletionLog;

    // And now we can update our output with a bit more information
    // We will also run a check to make sure the log we got was for the same author's message
    // @ts-ignore
    if (target.id === message.author.id) {
        for (var i = 0; i < deleteCallbacks.length; i++) {
            try {
                deleteCallbacks[i](message.id, message.guild.id, executor.tag);
            } catch { }
        }
    } else {
        for (var i = 0; i < deleteCallbacks.length; i++) {
            try {
                deleteCallbacks[i](message.id, message.guild.id, null);
            } catch { }
        }
    }
});

// handle reactions
discord.on("messageReactionAdd", async (reaction, user) => {
    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message: ', error);
            // Return as `reaction.message.author` may be undefined/null
            return;
        }
    }

    for (var i = 0; i < reactionCallbacks.length; i++) {
        try {
            await reactionCallbacks[i](reaction, user);
        } catch { }
    }
});

module.exports = {
    onDelete,
    postRedditToDiscord,
    getMessageHistory,
    getBotId,
    onMessage,
    postHelp,
    rateLimit,
    onReaction,
    postAttachments,
    postText,
    changeRoleColor,
    toggleColorRoles,
    removeColorRoles,
    addColorRoles,
    postTwitterToDiscord,
    client: discord
};
