const fetch = require("node-fetch");
const { nitter } = require("../settings.json");

async function getRecentTweets(username, start_date = null, ignore_replies = false) {
    const userResponse = await fetch(`${nitter.url}/user/${username}/profile`, { 
        method: "POST",
        headers: {
            [nitter.apiKey]: nitter.apiValue
        }
    });

    if (!userResponse.ok) throw "Unable to get user data";

    let user = await userResponse.json();

    let tweetsResponse = await fetch(`${nitter.url}/user/${username}/tweets?_=1${ignore_replies ? "" : "&include_replies=true"}${start_date ? `&start_date=${new Date(start_date).valueOf()}` : ""}`, { 
        method: "POST",
        headers: {
            [nitter.apiKey]: nitter.apiValue
        }
    });

    if (!tweetsResponse.ok) throw "Unable to get tweets";

    let tweets = await tweetsResponse.json();

    tweets.forEach(tweet => {
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
        }

        tweet.created_at = new Date(tweet.created_at);
    });

    tweets.sort((a, b) => a.created_at < b.created_at ? -1 : 1);

    start_date = new Date(start_date);

    if (ignore_replies) tweets = tweets.filter(tweet => !tweet.is_reply);
    if (start_date) tweets = tweets.filter(tweet => tweet.created_at > start_date);    

    // for this project, ignore retweets
    tweets = tweets.filter(tweet => !tweet.is_retweet);    

    return {
        user,
        tweets
    }
}

module.exports = {
    getRecentTweets
};