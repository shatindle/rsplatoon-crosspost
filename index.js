const discordApi = require("./DAL/discordApi");
const redditApi = require("./DAL/redditApi");
const database = require("./DAL/databaseApi");
const databaseApi = require("./DAL/databaseApi");
const settings = require("./settings.json");
const twitterApi = require("./DAL/twitterApi");
const languageApi = require("./DAL/languageApi");
const japaneseToEnglishSplatoonApi = require("./DAL/japaneseToEnglishSplatoonApi");
const { Collection } = require("discord.js");
const { token } = require("./discord.json");
const { fridges } = require("./DAL/fridgeApi");

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
const artChannel = settings.discord.art;
const generalChannel = settings.discord.general;
const artContestChannel = settings.discord.artcontest;

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
                    }

                    // if we're here, exit because the emoji matched
                    return;
                }
            }
        }
    }
});

const artFlair = settings.specialFlairs.art;
const artContestFlair = settings.specialFlairs.contest;

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

// get the twitter filters into memory so we don't need to rebuild the regex objects
if (settings.twitters) {
    settings.twitters.map(twitter => {
        if (twitter.filter) twitter.filter.map(filter => {
            twitterFilters[filter.name] = new RegExp(filter.pattern, filter.ignoreCase ? "i" : "");
        });
    });
}

// this is just for the main server
async function crossPostTweets() {
    try {
        if (!settings.twitters) return;

        for (let twitter of settings.twitters) {
            for (let userId of twitter.accounts) {
                let { tweets, user } = await twitterApi.getRecentTweets(userId);

                for (let i = 0; i < tweets.length; i++) {
                    let tweet = tweets[i];
                    
                    if (!(await databaseApi.findByTwitterId(tweet.id))) {
                        let text = tweet.text;

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
                            tweetReactions
                        );
            
                        await databaseApi.saveTweet(tweet, discordId);
                    }
                }
            }
        }
    } catch (err) {
        console.log("Error getting tweets: " + err);
    }
}



discordApi.client.once("ready", async () => {
    // run on startup, then run once per minute
    await getNewPosts();
    setInterval(getNewPosts, 60000);

    // changeRoleColors();
    await changeRoleColors();
    setInterval(changeRoleColors, 86400000);

    // clean up database
    await cleanUp();
    setInterval(cleanUp, 86400000);

    // cross post tweets once per minute
    await crossPostTweets();
    setInterval(crossPostTweets, 60000);
});

discordApi.client.login(token);