const discordApi = require("./DAL/discordApi");
const redditApi = require("./DAL/redditApi");
const database = require("./DAL/databaseApi");
const databaseApi = require("./DAL/databaseApi");
const settings = require("./settings.json");

// test subreddit
const subReddit = settings.subReddit;

// #reddit-posts in Gardevoir's Mansion
const artChannel = settings.discord.art;
const generalChannel = settings.discord.general;
const artContestChannel = settings.discord.artcontest;

/** @description When a mod deletes our post in Discord, report the post in r/Splatoon reddit
 * 
 */
discordApi.onDelete(async (messageId, guild, deletedBy) => {
    var associatedId = await database.findByDiscordId(messageId);

    if (associatedId) {
        await redditApi.reportPost(associatedId.redditId, deletedBy);
        await databaseApi.markReported(associatedId.redditId, deletedBy);
    }
});

var lastMessageTimestamp = null;

/** @description When a user posts a message in Discord that pings the bot, respond.
 * 
 */
discordApi.onMessage(async (message) => { 
    var text = message.content.toLocaleLowerCase();

    if (text.indexOf("get random") > -1) {
        // check for ratelimit
        var postedOn = new Date(message.createdTimestamp);

        if (lastMessageTimestamp !== null && Math.abs(postedOn - lastMessageTimestamp) < 5000)
            return await discordApi.rateLimit(message.channel.id);

        lastMessageTimestamp = postedOn;

        // get a random post
        var posts = await redditApi.getRandomPost(subReddit);

        var redditPost = posts[0];

        await discordApi.postRedditToDiscord(
            message.channel.id, 
            redditPost.title, 
            redditPost.text, 
            redditPost.image, 
            redditPost.link, 
            redditPost.author, 
            redditPost.authorIcon,
            redditPost.color,
            redditPost.postedOn,
            redditPost.flairText,
            redditPost.flairIcon);
    } else {
        await discordApi.postHelp(message.channel.id);
    }
});

if (settings.upvote) {
    discordApi.onReaction(async function(reaction, user) {
        if (reaction.message.channel.id === settings.discord.art) {
            if (reaction.emoji.id !== settings.upvote) return;
            if (reaction.message.author.bot) return;
            if (reaction.count > 4) {
                var message = reaction.message;
    
                if (await databaseApi.getArtFromFridge(message.id, message.guild.id))
                    // it's already on the fridge
                    return; 
    
                // create the art fridge entry
                var attachments = [];
    
                message.attachments.forEach(function(a) {
                    attachments.push(a.url);
                });
    
                await discordApi.postRedditToDiscord(
                    settings.discord.artfridge,
                    "Source",
                    message.content,
                    "",
                    message.url,
                    message.author.tag,
                    message.author.avatarURL(),
                    parseInt("ffd635", 16),
                    message.createdTimestamp / 1000,
                    "",
                    ""
                );
    
                await discordApi.postAttachments(
                    settings.discord.artfridge,
                    attachments
                );
    
                await databaseApi.postToFridge(message.id, message.guild.id);
            }
        }
    });
}

discordApi.onReady(() => {
    discordApi.registerSlashCommand(
        "random", 
        "Pulls in a random submission from the subreddit.", 
        async (interaction) => {
            // check for ratelimit
            var postedOn = new Date();
    
            if (lastMessageTimestamp !== null && Math.abs(postedOn - lastMessageTimestamp) < 5000)
                return await discordApi.rateLimit(interaction.channel_id);
    
            lastMessageTimestamp = postedOn;
    
            // get a random post
            var posts = await redditApi.getRandomPost(subReddit);
    
            var redditPost = posts[0];
    
            await discordApi.postRedditToDiscord(
                interaction.channel_id, 
                redditPost.title, 
                redditPost.text, 
                redditPost.image, 
                redditPost.link, 
                redditPost.author, 
                redditPost.authorIcon,
                redditPost.color,
                redditPost.postedOn,
                redditPost.flairText,
                redditPost.flairIcon);
        }
    );
});

const artFlair = [
    "Fan Art"
];

const artContestFlair = [
    "Art Contest"
];

/** @description Gets the correct channel this post should go in
 * 
 * @param {string} flairText The text of the flair
 * @returns {string} The correct channel ID
 */
function getChannel(flairText) {
    if (artFlair.indexOf(flairText) > -1)
        return artChannel;

    if (artContestFlair.indexOf(flairText) > -1)
        return artContestChannel;

    return generalChannel;
}

/** @description Gets the number of minutes between two dates
 * 
 * @param {*} earlyDate The earlier date
 * @param {*} lateDate The later date
 * @returns {number} Number of minutes between dates
 */
function timeDiffMinutes(earlyDate, lateDate) {
    var diff =(lateDate.getTime() - earlyDate.getTime()) / 1000;
    diff /= 60;

    return Math.abs(Math.round(diff));
}

/** @description Get process the subreddit and post new posts to Discord
 * 
 */
async function getNewPosts() {
    var posts = await redditApi.getNewPosts(subReddit);

    var conversationOngoing = false, 
        useSubredditInstead = false;

    // in the event something goes wrong, skip this step
    // TODO: remove this empty try/catch once we build confidence
    try {
        // check if we should post in #art or #subreddit
        var history = await discordApi.getMessageHistory(artChannel, 3);

        var currentTime = new Date(),
            botId = discordApi.getBotId();
        
        if (history.length) {
            if (history[0].authorId !== botId) {
                // previous post was not by the bot   

                if (timeDiffMinutes(history[0].createdOn, currentTime) < 10) {
                    // conversation is ongoing, hold off posting art for now
                    conversationOngoing = true;
                }

                var userIds = [];
                var messageCount = 0;

                for (var i = 0; i < history.length; i++) {
                    if (history[i].authorId === botId)
                        continue;
                    
                    if (userIds.indexOf(history[i].authorId) === -1)
                        userIds.push(history[i].authorId);

                    if (timeDiffMinutes(history[i].createdOn, currentTime) < (10 * (i + 1)))
                        messageCount++;
                }

                if (userIds.length > 1 && messageCount === 3) {
                    useSubredditInstead = true;
                }
            }
        }
    } catch { 
        // don't care for now, just keep going
    } 

    for (var i = 0; i < posts.length; i++) {
        var redditPost = posts[i];

        var entry = await database.findByRedditId(redditPost.id);

        if (!entry) { 
            var channelToUse = getChannel(redditPost.flairText);

            // check to see if we should use #subreddit if a conversation is going on in #art
            if (channelToUse === artChannel) {
                if (useSubredditInstead) {
                    channelToUse = generalChannel;
                } else if (conversationOngoing) {
                    // skip this post since a conversation is going on in #art, but hasn't been
                    // going on long enough to warrant posting in #subreddit (the backup plan)
                    continue;
                }
            }

            var discordId = await discordApi.postRedditToDiscord(
                channelToUse, 
                redditPost.title, 
                redditPost.text, 
                redditPost.image, 
                redditPost.link, 
                redditPost.author, 
                redditPost.authorIcon,
                redditPost.color,
                redditPost.postedOn,
                redditPost.flairText,
                redditPost.flairIcon);

            database.associateIds(redditPost.id, discordId);
        }
    }
}

// run on startup, then run once per minute
getNewPosts();
var interval = setInterval(getNewPosts, 60000);