const { TwitterApi } = require("twitter-api-v2");
const { token } = require("../twitter.json");

// Instanciate with desired auth type (here's Bearer v2 auth)
const twitterClient = new TwitterApi(token);

// Tell typescript it's a readonly app
const roClient = twitterClient.readOnly;

async function getRecentTweets(userId, start_date = null, ignore_replies = false) {
    const userDetails = await roClient.v2.user(userId);

    let date;

    if (start_date) date = start_date;
    else date = new Date();

    if (!start_date) {
        date.setMinutes(date.getMinutes() - 60);
        date.setHours(0, 0, 0, 0);
    }

    // const searchResults = await roClient.search("from:2888006497", { 
    const { tweets, includes } = await roClient.search(`from:${userId} -is:retweet${ignore_replies ? " -is:reply" : ""}`, { 
        "tweet.fields": [
            "id",
            "text",
            "attachments",
            "author_id",
            "conversation_id",
            "created_at"
        ],
        "expansions": [
            "attachments.media_keys"
        ],
        "media.fields": [
            "media_key",
            "type",
            "url"
        ],
        start_time: date.toISOString()
    });

    const result = tweets.map(t => {
        let data = {
            text: t.text,
            id: t.id,
            author_id: t.author_id,
            conversation_id: t.conversation_id,
            created_at: t.created_at
        };

        if (t.attachments && t.attachments.media_keys && t.attachments.media_keys.length > 0) {
            data.attachments = [];

            for (const media_key of t.attachments.media_keys) {
                const media = includes.media.filter(m => m.media_key === media_key)[0];
                data.attachments.push({
                    url: media.url,
                    type: media.type
                });
            }
        }

        return data;
    });

    result.reverse();

    return {
        user: userDetails.data,
        tweets: result
    };
}

module.exports = {
    getRecentTweets
};