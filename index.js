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

const artFlair = [
    "Fan Art",
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

    return generalChannel;
}

/** @description Get process the subreddit and post new posts to Discord
 * 
 */
async function getNewPosts() {
    var posts = await redditApi.getNewPosts(subReddit);

    for (var i = 0; i < posts.length; i++) {
        var redditPost = posts[i];

        var entry = await database.findByRedditId(redditPost.id);

        if (!entry) { 
            var discordId = await discordApi.postRedditToDiscord(
                getChannel(redditPost.flairText), 
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