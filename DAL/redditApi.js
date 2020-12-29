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

    /** @description The flair icon to display for this type */
    flairIcon;
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

const flairIcons = {
    "Image": "https://cdn.discordapp.com/attachments/752615708709617796/752629013704343562/image.png",
    "Video": "https://cdn.discordapp.com/attachments/752615708709617796/752629017064243280/video.png",
    "Stream": "https://cdn.discordapp.com/attachments/752615708709617796/752629021753475253/stream.png",
    "Official Tumblr": "https://cdn.discordapp.com/attachments/752615708709617796/752629023749963876/tumblr.png",
    "Splatfest": "https://cdn.discordapp.com/attachments/752615708709617796/752629026035728484/splatfest.png",
    "Spoiler": "https://cdn.discordapp.com/attachments/752615708709617796/752629013704343562/image.png",
    "Discussion": "https://cdn.discordapp.com/attachments/752615708709617796/752629019689877606/discussion.png",
    "Data": "https://cdn.discordapp.com/attachments/752615708709617796/752629028095000777/data.png",
    "News": "https://cdn.discordapp.com/attachments/752615708709617796/752629030032769125/news.png",
    "PSA": "https://cdn.discordapp.com/attachments/752615708709617796/752629032272658442/psa.png",
    "Satire": "https://cdn.discordapp.com/attachments/752615708709617796/752629034491576330/satire.png",
    "Competitive": "https://cdn.discordapp.com/attachments/752615708709617796/752629959176224768/competitive.png",
    "Strategy": "https://cdn.discordapp.com/attachments/752615708709617796/752629962527473726/strategy.png",
    "Fan Art": "https://cdn.discordapp.com/attachments/752615708709617796/752630088456994866/fanart.png",
    "Meme": "https://cdn.discordapp.com/attachments/752615708709617796/752629068503056445/meme.png",
    "Event": "https://cdn.discordapp.com/attachments/752615708709617796/752629079450058872/event.png",
    "Salmon Run": "https://cdn.discordapp.com/attachments/752615708709617796/752629074488459433/salmonrun.png",
    "Art Contest": "https://cdn.discordapp.com/attachments/752615708709617796/752629013704343562/image.png"
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

        if (flairIcons[post.flairText]) {
            post.flairIcon = flairIcons[post.flairText];
        } else {
            post.flairIcon = "https://cdn.discordapp.com/attachments/752615708709617796/752629013704343562/image.png";
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
        .getNew();

    return ProcessPosts(newPosts);
}

/** @description Gets a random post from the r/Splatoon subreddit
 * 
 * @param {string} sub The subreddit to get new posts from
 * @returns {Promise<Array<RedditPost>>} A list of new Reddit posts
 */
async function getRandomPost(sub = "r/Splatoon") {
    var randomPost = await reddit.getSubreddit(sub)
        .getRandomSubmission();

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
        reason: "This post was removed from r/Splatoon Discord by " + removedBy
    });
}

module.exports = {
    getNewPosts: getNewPosts,
    reportPost: reportPost,
    getRandomPost: getRandomPost
};