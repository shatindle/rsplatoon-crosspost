const RedditApi = require("snoowrap");
const oauth_info = require("../oauth_info.json");

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
const supportedColors = {
    "Image": parseInt("ffd635", 16),
    "Video": parseInt("f08f44", 16),
    "Stream": parseInt("f08f44", 16),
    "Official Tumblr": parseInt("445fff", 16),
    "Splatfest": parseInt("e549a8", 16),
    //"Spoiler": parseInt("")
    "Discussion": parseInt("ff88bd", 16),
    "Data": parseInt("349e48", 16),
    "News": parseInt("5a0be6", 16),
    "PSA": parseInt("00d5f9", 16),
    "Satire": parseInt("738491", 16),
    "Competitive": parseInt("cc0000", 16),
    "Strategy": parseInt("cc0000", 16),
    "Fan Art": parseInt("ffd635", 16),
    "Meme": parseInt("738491", 16),
    "Event": parseInt("5a0be6", 16),
    "Salmon Run": parseInt("ff6a00", 16),
    "Art Contest": parseInt("0bd598", 16)
}

/** @description Gets new posts from the r/Splatoon subreddit
 * 
 * @param {string} sub The subreddit to get new posts from
 * @returns {Array<RedditPost>} A list of new Reddit posts
 */
async function getNewPosts(sub = "r/Splatoon") {
    var newPosts = await reddit.getSubreddit(sub)
        .getNew();

    var posts = [];

    // cache users so we don't call this API excessively
    var users = [];

    await asyncForEach(newPosts, async (submission) => {
        var user;

        for (var i = 0; i < users.length; i++) {
            if (users[i].name === submission.author.name) {
                user = users[i];
                break;
            }
        }

        if (!user) {
            user = await reddit.getUser(submission.author.name).fetch();
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

        if (post.text.length > 1000) {
            post.text = post.text.substring(0, 997) + "...";
        }

        // handle image redirect links to other posts
        if (post.image && post.image.indexOf("/") === 0) {
            post.text += "https://reddit.com" + post.image;
            post.image = null;
        }
        
        post.link = "https://reddit.com" + submission.permalink;
        post.postedOn = submission.created_utc;
        post.author = "u/" + submission.author.name;
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

/** @description Reports a post to the Sub Reddit mods on Reddit
 * 
 * @param {string} id 
 * @param {string} removedBy 
 */
async function reportPost(id, removedBy) {
    var post = await reddit.getSubmission(id);
    
    await post.report({ 
        reason: "This post was removed from r/Splatoon Discord by " + removedBy 
    });
}

module.exports = {
    getNewPosts: getNewPosts,
    reportPost: reportPost
};