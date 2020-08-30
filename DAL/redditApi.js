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
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
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
        post.image = submission.url;
        post.link = "https://reddit.com" + submission.permalink;
        post.postedOn = submission.created_utc;
        post.author = "u/" + submission.author.name;
        post.authorIcon = user.icon_img;
        post.id = submission.id;
        post.text = submission.selftext;
        post.flairId = submission.link_flair_css_class;
        post.flairText = submission.link_flair_text;

        posts.push(post);
    });

    return posts;
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