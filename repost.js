const discordApi = require("./DAL/discordApi");
const redditApi = require("./DAL/redditApi");
const database = require("./DAL/databaseApi");
const settings = require("./settings.json");

const roles = settings.colorRoles;
const inkRoles = settings.inkColorRoles;
const unmanagedRoles = settings.unmanagedColorRoles;

const allRoles = roles.concat(inkRoles);
const everyRole = allRoles.concat(unmanagedRoles);

// test subreddit
const subReddit = settings.subReddit;

// #reddit-posts in Gardevoir's Mansion
const artChannel = settings.discord.art;
const generalChannel = settings.discord.general;
const artContestChannel = settings.discord.artcontest;

const urlRegex = /(https?:\/\/[^ ]*)/g;

const artFlair = settings.specialFlairs.art;

const artContestFlair = settings.specialFlairs.contest;

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
async function repost(redditId) {
    var posts = await redditApi.getPostById(redditId);

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
                redditPost.flairText);

            database.associateIds(redditPost.id, discordId);
        }
    }
}

repost("");