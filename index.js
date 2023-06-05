const discordApi = require("./DAL/discordApi");
const redditApi = require("./DAL/redditApi");
const database = require("./DAL/databaseApi");
const databaseApi = require("./DAL/databaseApi");
const settings = require("./settings.json");
const twitterApi = require("./DAL/twitterApi");
const nitterApi = require("./DAL/nitterApi");
const mastodonApi = require("./DAL/mastodonApi");
const languageApi = require("./DAL/languageApi");
const japaneseToEnglishSplatoonApi = require("./DAL/japaneseToEnglishSplatoonApi");
const { Collection } = require("discord.js");
const { token } = require("./discord.json");
const { fridges } = require("./DAL/fridgeApi");
const { extractPatchNotes } = require("./DAL/patchnotesApi");
const uuid = require('uuid');

const fs = require('fs');

discordApi.client.commands = new Collection();
const publicCommandFiles = fs.readdirSync('./commands/public').filter(file => file.endsWith('.js'));
const privateCommandFiles = fs.readdirSync('./commands/private').filter(file => file.endsWith('.js'));

for (const file of publicCommandFiles) {
	const command = require(`./commands/public/${file}`);
	discordApi.client.commands.set(command.data.name, command);
}

for (const file of privateCommandFiles) {
	const command = require(`./commands/private/${file}`);
	discordApi.client.commands.set(command.data.name, command);
}

discordApi.client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = discordApi.client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

const roles = settings.colorRoles ?? [];
const roleColors = settings.colors ?? [];
const inkRoles = settings.inkColorRoles ?? [];
const inkRoleColors = settings.inkColors ?? [];
const unmanagedRoles = settings.unmanagedColorRoles ?? [];

const allRoles = roles.concat(inkRoles);

// test subreddit
const subReddit = settings.subReddit;

// #reddit-posts in Gardevoir's Mansion
const artChannel = settings.discord?.art;
const generalChannel = settings.discord?.general;
const artContestChannel = settings.discord?.artcontest;

const urlRegex = /(https?:\/\/[^ ]*)/g;

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

// TODO: remove this if we change how we manage colormes
discordApi.onMessage(async (message) => {
    if (!unmanagedRoles || unmanagedRoles.length === 0)
        return;

    var text = message.content.toLocaleLowerCase().trim();

    if (text.indexOf("+colorme ") === 0 || text.indexOf("+colourme ") === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await discordApi.removeColorRoles(allRoles, message.author.id);
    }
});

const DAYS_AGO = 30;

function getDateXDaysAgo(numOfDays, date = new Date()) {
    const daysAgo = new Date(date.getTime());
  
    daysAgo.setDate(date.getDate() - numOfDays);
  
    return daysAgo;
}

discordApi.onReaction(async function(reaction, user) {
    if (reaction.message.author.bot) return;

    // if the post is older than 30 days ago, ignore it
    if (reaction.message.createdTimestamp < getDateXDaysAgo(DAYS_AGO).valueOf()) return;

    const guildId = reaction.message.guild.id;

    if (fridges && fridges[guildId] && fridges[guildId].fridges) {
        for (let board of fridges[guildId].fridges) {
            if (board.sources && board.sources.indexOf(reaction.message.channel.id) > -1) {
                if (reaction.emoji.id === board.upvote) {
                    // the channel and emoji matched
                    if (reaction.count >= board.count) {
                        let message = reaction.message;

                        if (await databaseApi.getItemFromFridge(message.id, message.guild.id))
                            // it's already on the fridge
                            return; 

                        // create the fridge entry
                        let attachments = [];

                        message.attachments.forEach(function(a) {
                            attachments.push(a.url);
                        });

                        // create the links entry
                        let links = "";
                        
                        try {
                            if (message.content) {
                                message.content.match(urlRegex).forEach((urlMatch) => {
                                    // Do something with each element
                                    links += urlMatch + " ";
                                });
                            }
                        } catch (err) { 
                            console.log("problem extracting link: " + err); 
                        }

                        try {
                            await discordApi.postRedditToDiscord(
                                board.target,
                                "Source",
                                message.content,
                                "",
                                message.url,
                                message.author.tag,
                                message.author.avatarURL(),
                                parseInt(board.color, 16),
                                message.createdTimestamp / 1000,
                                ""
                            );
                
                            if (attachments.length > 0) {
                                // don't wait for this...
                                discordApi.postAttachments(
                                    board.target,
                                    attachments
                                );
                            }
                            
                            if (links !== "") {
                                await discordApi.postText(
                                    board.target,
                                    links
                                );
                            }
                        } catch (err) { }
        
                        try {
                            await databaseApi.postToFridge(message.id, message.guild.id);
                        } catch (err) { console.log(err); }

                        if (board.awardRoleId) {
                            try {
                                const member = await reaction.client.guilds.cache.get(message.guild.id).members.fetch(message.author.id);
                                if (member) {
                                    if (!member.roles.cache.has(board.awardRoleId)) {
                                        await member.roles.add(board.awardRoleId);
                                    }
                                } else {
                                    console.log(`NO MEMBER`);
                                }
                            } catch (err) { console.log(`Unable to assign award role: ${err.message}`); }
                        } else {
                            console.log(`NO ROLE ID: ${JSON.stringify(board.awardRoleId)}`);
                        }
                    }

                    // if we're here, exit because the emoji matched
                    return;
                }
            }
        }
    }
});

const artFlair = settings.specialFlairs?.art;
const artContestFlair = settings.specialFlairs?.contest;

/** @description Gets the correct channel this post should go in
 * 
 * @param {string} flairText The text of the flair
 * @returns {string} The correct channel ID
 */
function getChannel(flairText) {
    if (artFlair.indexOf(flairText) > -1)
        return artChannel;

    if (artContestFlair.indexOf(flairText) > -1 && artContestChannel)
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

// this is just for the main server
function colorOffset() {
    var now = new Date();
    var fullDaysSinceEpoch = Math.floor(now/8.64e7);

    if (inkRoleColors && inkRoleColors.length)
        return fullDaysSinceEpoch % (inkRoleColors.length * 2);

    return 0;
}

// this is just for the main server
async function changeRoleColors() {
    // change Paruko Fan role colors
    // only do this if it's setup and it's Sunday
    if (roles && roleColors && roles.length && roleColors.length && new Date().getDay() === 0) {
        // change all the role colors
        for (var i = 0; i < roles.length; i++) {
            try {
                var role = roles[i];
                var color =  roleColors[Math.floor(Math.random()*roleColors.length)];

                await discordApi.changeRoleColor(role, color);
            } catch (err) {
                // if this fails, keep going
            }
        }
    }

    // change ink role colors
    try {
        if (inkRoles && inkRoleColors && inkRoles.length === 2 && inkRoleColors.length) {
            var todaysColorPairs = colorOffset();
    
            if (inkRoleColors.length * 2 > todaysColorPairs) {
                if (todaysColorPairs < inkRoleColors.length) {
                    // do pairs in current order
                    await discordApi.changeRoleColor(inkRoles[0], inkRoleColors[todaysColorPairs][0]);
                    await discordApi.changeRoleColor(inkRoles[1], inkRoleColors[todaysColorPairs][1]);
                } else {
                    // reverse the order and subtract length
                    await discordApi.changeRoleColor(inkRoles[0], inkRoleColors[todaysColorPairs - inkRoleColors.length][1]);
                    await discordApi.changeRoleColor(inkRoles[1], inkRoleColors[todaysColorPairs - inkRoleColors.length][0]);
                }
            }
        }
    } catch (err) {
        // if this fails, keep going
    }
}

/** @description Get process the subreddit and post new posts to Discord
 * 
 */
async function getNewPosts() {
    var posts = await redditApi.getNewPosts(subReddit);

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

// database activity cleanup 
async function cleanUp() {
    try {
        await databaseApi.cleanupOldAssociations();
        await databaseApi.cleanupTheFridge();
    } catch (err) {
        console.log("Error cleaning up: " + err);
    }
}

// used in the twitter crosspost tweets
const splatoon3Colors = [
    15335227, // #e9ff3b
    6306787,  // #603be3
    7010253,  // #6af7cd
    16484158  // #fb873e
];

const twitterFilters = {};
const mastodonFilters = {};

// get the twitter filters into memory so we don't need to rebuild the regex objects
if (settings.twitters) {
    settings.twitters.map(twitter => {
        if (twitter.filter) twitter.filter.map(filter => {
            twitterFilters[filter.name] = new RegExp(filter.pattern, filter.ignoreCase ? "i" : "");
        });
    });
}

if (settings.mastodons && settings.mastodons.feeds) {
    settings.mastodons.feeds.map(t => {
        if (t.filter) t.filter.map(filter => {
            mastodonFilters[filter.name] = new RegExp(filter.pattern, filter.ignoreCase ? "i" : "");
        });
    });
}

let dates = {
    now: null,
    nitter: null,
    next: null,
    running: false
};

// this is just for the main server
async function crossPostTweets() {
    try {
        if (!settings.twitters) return;

        if (dates.running) return;

        dates.running = true;

        if (!dates.now) {
            dates.now = new Date();
            dates.now.setDate(dates.now.getDate() - 1);
            //dates.now.setMinutes(dates.now.getMinutes() - 60);
            dates.now.setHours(0, 0, 0, 0);
        }

        // nitter can pull last 24 hours always since we're not subject to rate limits
        dates.nitter = new Date();
        dates.nitter.setDate(dates.nitter.getDate() - 4); // TODO: change this back to -1
        dates.nitter.setHours(0, 0, 0, 0);

        // lower the scope of tweet queries since we don't need *that* much
        dates.next = new Date();

        for (let twitter of settings.twitters) {
            for (let userId of twitter.useNitter ? twitter.users : twitter.accounts) {
                let { tweets, user } = twitter.useNitter ? 
                    await nitterApi.getRecentTweets(userId, dates.nitter, twitter.ignore_replies) : 
                    await twitterApi.getRecentTweets(userId, dates.now, twitter.ignore_replies);

                for (let i = 0; i < tweets.length; i++) {
                    let tweet = tweets[i];
                    
                    if (!(await databaseApi.findByTwitterId(tweet.id))) {
                        let text = tweet.text;

                        if (text && text.indexOf("piped.video/") > -1) text = text.replace("piped.video/", "youtube.com/");

                        // check if this tweet has text filters
                        if (twitter.filter && twitter.filter.length > 0) {
                            let tweetFilterMatches = false;

                            for (let filter of twitter.filter) {
                                if (twitterFilters[filter.name]) {
                                    if (twitterFilters[filter.name].test(text)) {
                                        tweetFilterMatches = true;
                                        break;
                                    }
                                }
                            }

                            // the tweet doesn't match our current filter
                            if (!tweetFilterMatches) continue;
                        }

                        if (text.lastIndexOf("https:") > -1) {
                            text = text.substring(0, text.lastIndexOf("https:"));
                        }

                        let tweetReactions = null;

                        if (twitter.reactions && twitter.reactions.length) 
                            tweetReactions = twitter.reactions;

                        let videoData = null;

                        if (tweet.hasVideo && twitter.useNitter) {
                            try {
                                let mediaDetails = await nitterApi.getMediaDetails(userId, tweet.id, 1);

                                // get boost count to determine max size we can send
                                // 8MB for level 1 or 0, 50MB for level 2+
                                let boostCount = await discordApi.getBoostCount(twitter.target);

                                if (mediaDetails.mediaType === "gif") {
                                    let gifResponse = await nitterApi.getGif(userId, tweet.id, 1, 18, 300);

                                    if (
                                        (boostCount < 7 && gifResponse.length < 7900000) ||
                                        (boostCount >= 7 && gifResponse.length < 49000000)
                                    ) {
                                        videoData = {
                                            buffer: gifResponse,
                                            name: `${uuid.v4()}.gif`,
                                            type: "gif"
                                        }
                                    }
                                } else {
                                    let videoResponse = await nitterApi.getVideo(userId, tweet.id, 1, true);

                                    if (
                                        (boostCount < 7 && videoResponse.length < 7900000) ||
                                        (boostCount >= 7 && videoResponse.length < 49000000)
                                    ) {
                                        videoData = {
                                            buffer: videoResponse,
                                            name: `${uuid.v4()}.mp4`,
                                            type: "video"
                                        }
                                    }
                                }
                            } catch {}
                        }
    
                        // tweet hasn't been cross posted, cross post it
                        const discordId = await discordApi.postTwitterToDiscord(
                            twitter.target,
                            splatoon3Colors[Math.floor(Math.random()*splatoon3Colors.length)],
                            user.username,
                            text,
                            twitter.translate ? 
                                await languageApi.translateText(japaneseToEnglishSplatoonApi.swapAll(text)) :
                                text,
                            tweet.created_at,
                            "https://twitter.com/" + user.username + "/status/" + tweet.id,
                            tweet.attachments,
                            twitter.ping,
                            tweetReactions,
                            videoData,
                            tweet.entries.urls
                        );
            
                        await databaseApi.saveTweet(tweet, discordId);
                    }
                }
            }
        }
    } catch (err) {
        console.log("Error getting tweets: " + err);
    }

    dates.now = dates.next;
    dates.running = false;
}

async function crossPostMastodon() {
    try {
        if (!settings.mastodons) return;

        for (let connection of settings.mastodons.connections) {
            let feeds = settings.mastodons.feeds.filter(t => t.name === connection.name);

            // if no one uses this, keep going
            if (feeds.length === 0) continue;

            let tweets = await mastodonApi.getPostsFromMastodon(connection.url, connection.name, connection.details);

            for (let i = 0; i < tweets.length; i++) {
                let tweet = tweets[i];

                for (let feed of feeds) {
                    let text = tweet.text;

                    // check if this tweet has text filters
                    if (feed.filter && feed.filter.length > 0) {
                        let matchesFilter = false;

                        for (let filter of feed.filter) {
                            if (mastodonFilters[filter.name]) {
                                if (mastodonFilters[filter.name].test(text)) {
                                    matchesFilter = true;
                                    break;
                                }
                            }
                        }

                        // the tweet doesn't match our current filter
                        if (!matchesFilter) continue;
                    }

                    for (let target of feed.targets) {
                        let id = `${tweet.id}:${target.id}`;
                        let reactions = null;

                        if (target.reactions && target.reactions.length) reactions = target.reactions;

                        if (!(await databaseApi.findByTwitterId(id))) {
                            // we have not posted to this feed yet, post it now
                            let discordId = await discordApi.postMastodonToDiscord(
                                target.id,
                                splatoon3Colors[Math.floor(Math.random()*splatoon3Colors.length)],
                                tweet.username,
                                text,
                                feed.translate ? 
                                    await languageApi.translateText(japaneseToEnglishSplatoonApi.swapAll(text)) :
                                    text,
                                tweet.created_at,
                                tweet.tweet_url,
                                tweet.attachments,
                                target.ping,
                                reactions,
                                null // TODO: support videos
                            );
                
                            await databaseApi.saveTweet({
                                ...tweet,
                                id
                            }, discordId);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.log("Error getting mastodon posts: " + err);
    }
}

function chunkContent(content = "") {
    const lines = content.split("\n");

    let chunks = [];

    let currentChunk = "";

    for (let chunk of lines) {
        if (chunk.length + 1 + currentChunk.length > 2000) {
            chunks.push(currentChunk);
            currentChunk = "";
        }

        currentChunk += chunk + "\n";
    }

    chunks.push(currentChunk);

    return chunks;
}

async function patchNotes() {
    // check if version lookups are intended
    if (!settings.patchNotes) return;

    for (let language of Object.keys(settings.patchNotes)) {
        let url = settings.patchNotes[language].url;
        let channelId = settings.patchNotes[language].channelId;

        try {
            let versions = await extractPatchNotes(url);
    
            for (let data of versions) {
                // check if we've posted this version
                let chunks = chunkContent(data.content);
                let threadVersion = `${language}-${channelId}-${data.version}`;
                let mainThread = await databaseApi.findByPatchNotes(threadVersion);

                if (!mainThread) {
                    // create the thread post

                    let threadPost = await discordApi.postPatchNotesToDiscord(channelId, data.name, true, data.name);

                    await databaseApi.savePatchNotes(threadVersion, data.name, threadPost);

                    mainThread = await databaseApi.findByPatchNotes(threadVersion);
                }

                for (let i = 0; i < chunks.length; i++) {
                    let version = `${language}-${channelId}-${data.version}-${i}`;
                    if (!await databaseApi.findByPatchNotes(version)) {
                        let content = chunks[i];
    
                        let id = await discordApi.postPatchNotesToDiscord(mainThread.discordId, content);
    
                        await databaseApi.savePatchNotes(version, content, id);
                    }
                }
            }
        } catch (err) {
            console.log(`Error getting patch notes for ${language}: ${err.toString()}`);
        }
    }
    
}

discordApi.client.once("ready", async () => {
    if (subReddit) {
        // run on startup, then run once per minute
        await getNewPosts();
        setInterval(getNewPosts, 60000);
    }

    // changeRoleColors();
    await changeRoleColors();
    setInterval(changeRoleColors, 86400000);

    // clean up database
    await cleanUp();
    setInterval(cleanUp, 86400000);

    // cross post tweets once per minute
    await crossPostTweets();
    setInterval(crossPostTweets, 60000);

    // because check once per minute
    await crossPostMastodon();
    setInterval(crossPostMastodon, 60000);

    // poll for patches once per hour
    if (settings.patchNotes) {
        await patchNotes();
        setInterval(patchNotes, 1000 * 60 * 60);
    }
});

discordApi.client.login(token);