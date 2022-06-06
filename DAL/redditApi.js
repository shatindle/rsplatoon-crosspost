const RedditApi = require("snoowrap");
const oauth_info = require("../oauth_info.json");
const { redditColors } = require("../settings.json");

const reddit = new RedditApi(oauth_info);

/** @description Details about an individual Reddit post */
class RedditPost {
    /** @description The title of the Reddit post*/
    title;

    /** @description The image URL if there is an image on this post */
    image;

    /** @description The direct link to this post */
    link;

    /** @description The UTC epoc date this was posted */
    postedOn;

    /** @description The Reddit user that made the post */
    author;

    /** @description The author's profile picture */
    authorIcon;

    /** @description The ID of the Reddit post */
    id;

    /** @description The post text if there is text on this post */
    text;

    /** @description The CSS class name for this flair */
    flairId;

    /** @description The flair text */
    flairText;

    /** @description The color of the flair */
    color;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

// TODO: make this dynamic and based on the subreddit
let supportedColors = {};

if (redditColors) {
    Object.keys(redditColors).forEach(redditColor => {
        try {
            supportedColors[redditColor] = parseInt(redditColors[redditColor], 16);
        } catch (err) {
            console.log(`Could not parse color: ${err.toString()}`);
        }
    });
}

/**
 * @description Processes posts and converts them to the standard format other functions expect
 * @param {RedditApi.Listing<RedditApi.Submission>} newPosts 
 * @returns {Promise<Array<RedditPost>>} A list of new Reddit posts
 */
async function ProcessPosts(newPosts) {
    var posts = [];

    // cache users so we don't call this API excessively
    var users = [];

    await asyncForEach(newPosts, async (submission) => {
        var user;

        for (var i = 0; i < users.length; i++) {
            if (users[i] && users[i].name === submission.author.name) {
                user = users[i];
                break;
            }
        }

        if (!user) {
            // @ts-ignore
            try {
                user = await reddit.getUser(submission.author.name).fetch();
            } catch {
                user = null;
            }
            
            if (user)
                users.push(user);
        }

        var post = new RedditPost();

        post.title = submission.title;

        if (submission.spoiler) {
            if (submission.selftext) {
                post.text = submission.selftext;
            } else {
                post.text = "[Image with spoiler]";
            }

        } else {
            post.image = submission.url || null;
            post.text = submission.selftext;
        }

        if (post.text.length > 1500) {
            post.text = post.text.substring(0, 1497) + "...";
        }

        // handle image redirect links to other posts
        if (post.image && post.image.indexOf("/") === 0) {
            post.text += "https://reddit.com" + post.image;
            post.image = null;
        }

        if (submission.media_metadata) {
            for (var item in submission.media_metadata) {
                if (submission.media_metadata[item] 
                    && submission.media_metadata[item].e === "Image" 
                    && submission.gallery_data 
                    && submission.gallery_data.items
                    && submission.gallery_data.items.length > 0) {
                    if (submission.media_metadata[item].m === "image/png") {
                        post.image = "https://i.redd.it/" + submission.gallery_data.items[0].media_id + ".png";
                        break;
                    }

                    if (submission.media_metadata[item].m === "image/gif") {
                        post.image = "https://i.redd.it/" + submission.gallery_data.items[0].media_id + ".gif";
                        break;
                    }

                    if (submission.media_metadata[item].m === "image/jpg"
                        || submission.media_metadata[item].m === "image/jpeg") {
                        post.image = "https://i.redd.it/" + submission.gallery_data.items[0].media_id + ".jpg";
                        break;
                    }
                }
            }
        }

        // if this is a video with a preview, pull in the preview image
        if (submission.post_hint === "hosted:video"
            && submission.preview
            && submission.preview.images
            && submission.preview.images.length > 0
            && submission.preview.images[0].source
            && submission.preview.images[0].source.url) {
            post.image = submission.preview.images[0].source.url;
        }

        post.link = "https://reddit.com" + submission.permalink;
        post.postedOn = submission.created_utc;
        post.author = "u/" + submission.author.name;
        if (user !== null) 
            post.authorIcon = user.icon_img;
            
        post.id = submission.id;

        post.flairId = submission.link_flair_css_class;
        post.flairText = submission.link_flair_text;

        if (supportedColors[post.flairText]) {
            post.color = supportedColors[post.flairText];
        } else {
            post.color = 5427530;
        }

        posts.push(post);
    });

    return posts.reverse();
}

/** @description Gets new posts from the r/Splatoon subreddit
 * 
 * @param {string} sub The subreddit to get new posts from
 * @returns {Promise<Array<RedditPost>>} A list of new Reddit posts
 */
async function getNewPosts(sub = "r/Splatoon") {
    var newPosts = await reddit.getSubreddit(sub)
        .getNew({ limit: 10 });

    return ProcessPosts(newPosts);
}

async function getPostById(id) {
    var post = await reddit.getSubmission(id).fetch();

    return ProcessPosts([post]);
}

// timeframes for random posts
const timeframes = [
    "hour", // 5% chance
    "day", // 5% chance
    "week", // 10% chance
    "week",
    "month", // 20% chance
    "month",
    "month",
    "month",
    "year", // 40% chance
    "year",
    "year",
    "year",
    "year",
    "year",
    "year",
    "year",
    "all", // 20% chance
    "all",
    "all",
    "all"
];

/** @description Gets a random post from the r/Splatoon subreddit
 * 
 * @param {string} sub The subreddit to get new posts from
 * @returns {Promise<Array<RedditPost>>} A list of new Reddit posts
 */
async function getRandomPost(sub = "r/Splatoon") {
    var randomPost;
    var randomPosts;

    var subreddit = reddit.getSubreddit(sub);

    var randomCategory = Math.floor(Math.random() * 4);
    var randomTimeframe = timeframes[Math.floor(Math.random() * timeframes.length)];

    switch (randomCategory) {
        case 0: // new
            randomPosts = await subreddit.getNew();

            randomPost = randomPosts[Math.floor(Math.random() * randomPosts.length)];
            break;
        case 1: // hot
            randomPosts = await subreddit.getHot();

            randomPost = randomPosts[Math.floor(Math.random() * randomPosts.length)];
            break;
        case 2: // top
            randomPosts = await subreddit.getTop({ time: randomTimeframe });

            randomPost = randomPosts[Math.floor(Math.random() * randomPosts.length)];
            break;
        case 3: // controversial
            randomPosts = await subreddit.getControversial({ time: randomTimeframe });

            randomPost = randomPosts[Math.floor(Math.random() * randomPosts.length)];
            break;
        default: // if we ever forget to increase it
            randomPost = await reddit.getSubreddit(sub).getRandomSubmission();
            break;
    }

    var postWrapper = [randomPost];

    return ProcessPosts(postWrapper);
}

/** @description Reports a post to the Sub Reddit mods on Reddit
 * 
 * @param {string} id 
 * @param {string} removedBy 
 */
async function reportPost(id, removedBy) {
    // @ts-ignore
    var post = await reddit.getSubmission(id);

    await post.report({
        reason: "This post was removed from the Discord Server by " + removedBy
    });
}

module.exports = {
    getNewPosts: getNewPosts,
    reportPost: reportPost,
    getRandomPost: getRandomPost,
    getPostById
};