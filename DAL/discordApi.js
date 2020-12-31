const DiscordApi = require('discord.js');
const discord = new DiscordApi.Client();
const token = require('../discord.json').token;

// login to discord - we should auto reconnect automatically
discord.login(token);

// the list of callback to run through when a message is deleted
var deleteCallbacks = [];

// the list of callbacks to run through when a message is seen
var messageCallbacks = [];

/** @description The callback function to execute for a deleted post
 * 
 * @param {string} messageId The Discord ID that was deleted
 * @param {string} guildId The ID of the guild this message was deleted from
 * @param {string} deletedBy The Discord handle of the user that deleted the post in Discord
 */
function onDeleteCallback(messageId = "", guildId = "", deletedBy = "") { }

/** @description The callback function to execute for a message post
 * 
 * @param {DiscordApi.Message} message The Discord message
 */
function onMessageCallback(message) { }

/** @description Add a function to ondelete callback
 * 
 * @param {onDeleteCallback} callback A function that will execute when a message is deleted.  MessageId, GuildId, and DeletedBy will be provided.
 */
function onDelete(callback = onDeleteCallback) {
    deleteCallbacks.push(callback);
}

/** @description Add a function to onmessage callback
 * 
 * @param {onDeleteCallback} callback A function that will execute when a message is sent by a user.  Message will be provided.
 */
function onMessage(callback = onMessageCallback) {
    messageCallbacks.push(callback);
}

/** @description Gets the message history for a channel, sorted by newest
 * 
 * @param {*} channelId The channel ID
 * @param {*} limit The maximum number of messages to retrieve
 * @returns {Array} List of messages
 */
async function getMessageHistory(
    channelId = "",
    limit = 10) {

    var channel = discord.channels.cache.get(channelId);
    
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

/** @description Gets the bot's ID
 * @returns {string} The bot ID
 */
function getBotId() {
    return discord.user.id;
}

/** @description Post a message to discord
 * 
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
 * @param {string} flairIcon The flair icon image for this flair
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
    flairIcon = "") {

    // handle discord links
    var discordLinkPattern = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9_.-]+/g;
    text = text.replace(discordLinkPattern, "[discord link]");

    // handle spoilers
    var spoilerPattern = /(?<start>\>\!)(?<mid>[^<]+)(?<end><)/g;
    text = text.replace(spoilerPattern, "||$<mid>||");

    if (title.length > 256)
        title = title.substring(0, 250) + "...";

    // post the content
    try {
        var message = await discord.channels.cache.get(channelId).send({
            embed: {
                title: title,
                description: text,
                url: link,
                color: color,
                thumbnail: {
                    url: imageUrl
                },
                timestamp: new Date(timestamp * 1000).toISOString(),
                author: {
                    name: author,
                    url: "https://reddit.com/user/" + author.substring(2),
                    icon_url: authorIcon ? authorIcon : null
                },
                footer: {
                    //icon_url: flairIcon,
                    text: flairText
                  }
            }
        });

        // @ts-ignore
        return message.id;
    } catch (err) {
        console.log("offending link: " + imageUrl);
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

/** @description Tells the user to slow down
 * 
 * @param {string} channelId 
 */
async function rateLimit(channelId = "") {
    try {
        var item = rateLimitMessages[Math.floor(Math.random() * rateLimitMessages.length)];

        await discord.channels.cache.get(channelId).send(item);
    } catch (err) {
        console.log("Error ratelimit to channel: " + channelId);
    }
}

/** @description Tells the user how to use this bot
 * 
 * @param {string} channelId 
 */
async function postHelp(channelId = "") {
    try {
        await discord.channels.cache.get(channelId).send({
            embed: {
                title: "Commands and usage",
                description: 
                    "This bot is designed to pull in new posts from the subreddit automatically every minute. " +
                    "It can distinguish between art and general posts. Additionally, it has some commands you can invoke " +
                    "by mentioning the bot.\n\n" + 
                    "__**Commands**__\n" + 
                    "- **get random** Pulls in a random submission from the subreddit.\n\n" +
                    "[Source Code](https://github.com/shatindle/rsplatoon-crosspost)"
            }
        });
    } catch (err) {
        console.log("Error sending help to channel: " + channelId);
    }
}

/** @description Listens for messages it is mentioned in so it can respond
 * 
 */
discord.on('message', async message => {
    // ignore direct messages
    if (!message.guild) return;

    // ignore posts from bots
    if (message.author.bot) return;

    // ignore posts we were not mentioned in
    if (!message.mentions.has(discord.user)) return;

    for (var i = 0; i < messageCallbacks.length; i++) {
        try {
            messageCallbacks[i](message);
        } catch { }
    }
});

discord.on('messageDelete', async message => {
    // ignore direct messages
    if (!message.guild) return;

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

module.exports = {
    onDelete: onDelete,
    postRedditToDiscord: postRedditToDiscord,
    getMessageHistory: getMessageHistory,
    getBotId: getBotId,
    onMessage: onMessage,
    postHelp: postHelp,
    rateLimit: rateLimit
};