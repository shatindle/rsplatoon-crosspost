const discordApi = require("./DAL/discordApi");
const redditApi = require("./DAL/redditApi");
const database = require("./DAL/databaseApi");

// test subreddit
const subReddit = "r/shanebug";

// #reddit-posts in Gardevoir's Mansion
const discordChannelId = "749486357558329365";

/** @description When a mod deletes our post in Discord, report the post in r/Splatoon reddit
 * 
 */
discordApi.onDelete(async (messageId, guild, deletedBy) => {
    var associatedId = await database.findByDiscordId(messageId);

    if (associatedId) {
        await redditApi.reportPost(associatedId.redditId, deletedBy);
    }
});

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
                discordChannelId, 
                redditPost.title, 
                redditPost.text, 
                redditPost.image, 
                redditPost.link, 
                redditPost.author, 
                redditPost.authorIcon);

            database.associateIds(redditPost.id, discordId);
        }
    }
}

// run on startup, then run once per minute
getNewPosts();
var interval = setInterval(getNewPosts, 60000);