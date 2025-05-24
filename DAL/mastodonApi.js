const fetch = require("node-fetch");

async function getPostsFromMastodon(url, name, details) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": details
        }
    });

    if (!response.ok) throw "Unable to get mastodon data";

    let data = await response.json();

    const results = [];

    for (let record of data) {
        results.push({
            "id": `${name}:${record.id}`,
            "tweet_url": record.url,
            "username": record.account.username,
            "is_retweet": false, // TODO: come up with the equivalent
            "is_pinned": record.pinned,
            "created_at": record.created_at,
            "text": record.akkoma.source.content,
            "replies": record.replies_count,
            "retweets": 0, // TODO: come up with the equivalent
            "likes": record.favourites_count,
            "entries": {
                "hashtags": record.tags ? record.tags.map(t => t.name) : [],
                "urls": [],
                "photos": record.media_attachments ? record.media_attachments.filter(t => typeof t.type === "string" && t.type.toLowerCase().includes("image")).map(t => t.url) : [],
                "videos": record.media_attachments ? record.media_attachments.filter(t => typeof t.type === "string" && t.type.toLowerCase().includes("video")).map(t => t.url) : []
            },
            "is_reply": !!record.in_reply_to_id,

            // new to this API
            "avatar": record.account.avatar,
            "userdetails": record.account.url
        });
    }

    results.forEach(tweet => {
        tweet.attachments = [];

        for (let photo of tweet.entries.photos) {
            tweet.attachments.push({
                url: photo,
                type: "photo"
            });
        }

        for (let video of tweet.entries.videos) {
            tweet.attachments.push({
                url: video,
                type: "video"
            });

            tweet.hasVideo = true;
        }

        tweet.created_at = new Date(tweet.created_at);
    });

    // put oldest first
    results.reverse();

    return results;
}

module.exports = {
    getPostsFromMastodon
};