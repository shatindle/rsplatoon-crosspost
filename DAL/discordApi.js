const DiscordApi = require('discord.js');
const discord = new DiscordApi.Client();
const token = require('../discord.json').token;

// login to discord - we should auto reconnect automatically
discord.login(token);

// the list of callback to run through when a message is deleted
var callbacks = [];

/** @description The callback function to execute for a deleted post
 * 
 * @param {*} id The Discord ID that was deleted
 * @param {*} deletedBy The Discord handle of the user that deleted the post in Discord
 */
function onDeleteCallback(messageId = "", guildId = "", deletedBy = "") {}

/** @description Add a function to ondelete callback
 * 
 * @param {onDeleteCallback} callback A function that will execute when a message is deleted.  MessageId, GuildId, and DeletedBy will be provided.
 */
function onDelete(callback = onDeleteCallback) {
    callbacks.push(callback);
}

/** @description Post a message to discord
 * 
 * @param {string} channelId The channel ID to post this message to
 * @param {string} title The title of the post
 * @param {string} text The text of the post (if any)
 * @param {string} imageUrl The image link (if any)
 * @param {string} link The link to the post in Reddit
 * @param {string} author The author of the post on Reddit (in the form of u/author)
 * 
 * @returns {string} The discord ID of the post
 */
async function postRedditToDiscord(channelId = "", title = "", text = "", imageUrl = "", link = "", author = "u/", authorIcon = "", color = 0) {
    // handle spoilers
    var reg = /(?<start>\>\!)(?<mid>[^<]+)(?<end><)/g;
    text = text.replace(reg, "||$<mid>||");
    
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
                author: {
                    name: author,
                    url: "https://reddit.com/user/" + author.substring(2),
                    icon_url: authorIcon
                }
            }
          });
    
        return message.id;
    } catch {
        console.log("offending link: " + imageUrl);
    }
    
}

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
    if (!deletionLog) 
    {
        for (var i = 0; i < callbacks.length; i++) {
            try {
                callbacks[i](message.id, message.guild.id, null);
            } catch {}
        }
    }

    // We now grab the user object of the person who deleted the message
    // Let us also grab the target of this action to double check things
    const { executor, target } = deletionLog;

    // And now we can update our output with a bit more information
    // We will also run a check to make sure the log we got was for the same author's message
    if (target.id === message.author.id) {
        for (var i = 0; i < callbacks.length; i++) {
            try {
                callbacks[i](message.id, message.guild.id, executor.tag);
            } catch {}
        }
    } else {
        for (var i = 0; i < callbacks.length; i++) {
            try {
                callbacks[i](message.id, message.guild.id, null);
            } catch {}
        }
    }
});

module.exports = {
    onDelete: onDelete,
    postRedditToDiscord: postRedditToDiscord
};