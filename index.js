const discordApi = require("./DAL/discordApi");
const redditApi = require("./DAL/redditApi");
const database = require("./DAL/databaseApi");
const databaseApi = require("./DAL/databaseApi");
const profileApi = require("./DAL/profileApi");
const settings = require("./settings.json");
const { MessageActionRow, MessageButton } = require("discord.js");

const roles = settings.colorRoles;
const roleColors = settings.colors;
const inkRoles = settings.inkColorRoles;
const inkRoleColors = settings.inkColors;
const unmanagedRoles = settings.unmanagedColorRoles;

const allRoles = roles.concat(inkRoles);
const everyRole = allRoles.concat(unmanagedRoles);

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

var lastMessageTimestamp = null;

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

if (settings.upvote) {
    discordApi.onReaction(async function(reaction, user) {
        if (reaction.message.channel.id === settings.discord.art) {
            if (reaction.emoji.id !== settings.upvote) return;
            if (reaction.message.author.bot) return;
            if (reaction.count > 4) {
                var message = reaction.message;
    
                if (await databaseApi.getArtFromFridge(message.id, message.guild.id))
                    // it's already on the fridge
                    return; 
    
                // create the art fridge entry
                var attachments = [];
    
                message.attachments.forEach(function(a) {
                    attachments.push(a.url);
                });
                
                // create the links entry
                var links = "";
                
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
                        settings.discord.artfridge,
                        "Source",
                        message.content,
                        "",
                        message.url,
                        message.author.tag,
                        message.author.avatarURL(),
                        parseInt("ffd635", 16),
                        message.createdTimestamp / 1000,
                        "",
                        ""
                    );
        
                    if (attachments.length > 0) {
                        await discordApi.postAttachments(
                            settings.discord.artfridge,
                            attachments
                        );
                    }
                    
                    if (links !== "") {
                        await discordApi.postText(
                            settings.discord.artfridge,
                            links
                        );
                    }
                } catch (err) { }

                try {
                    await databaseApi.postToFridge(message.id, message.guild.id);
                } catch (err) { console.log(err); }
                
            }
        }
    });
}

discordApi.onReady(() => {
    discordApi.addSlashCommand(
        "random", 
        "Pulls in a random submission from the subreddit.", 
        [],
        async (interaction) => {
            // check for ratelimit
            var postedOn = new Date();
    
            if (lastMessageTimestamp !== null && Math.abs(postedOn - lastMessageTimestamp) < 5000) {
                return await discordApi.rateLimit(interaction.channel_id, interaction);
            }
    
            lastMessageTimestamp = postedOn;
    
            // get a random post
            var posts = await redditApi.getRandomPost(subReddit);
    
            var redditPost = posts[0];
    
            await discordApi.postRedditToDiscord(
                interaction.channel_id, 
                redditPost.title, 
                redditPost.text, 
                redditPost.image, 
                redditPost.link, 
                redditPost.author, 
                redditPost.authorIcon,
                redditPost.color,
                redditPost.postedOn,
                redditPost.flairText,
                redditPost.flairIcon,
                interaction);
        }
    );

    discordApi.addSlashCommand(
        "paruko",
        "The Paruko Fan gumball machine! Use it to get a Paruko color. Color changes daily.",
        [{
            name: "action",
            type: "string",
            description: "Use the gumball machine or remove the role",
            choices: [
                {
                    name: "Gumball",
                    value: "gumball"
                }, {
                    name: "Remove",
                    value: "remove"
                }
            ],
            required: true
        }],
        async (interaction) => {
            var action = interaction.options.getString("action");

            switch (action) {
                case "gumball":
                    await discordApi.addColorRoles(roles, interaction.member.id, everyRole);
                    interaction.editReply("You've got a new Paruko Fan role!");
                    break;
                case "remove":
                    await discordApi.removeColorRoles(allRoles, interaction.member.id);
                    interaction.editReply("You are no longer a Paruko Fan.");
                    break;
            }
        }
    );

    discordApi.addSlashCommand(
        "choose",
        "Join Team Alpha, Team Bravo, or leave the team.  Role colors change daily.",
        [{
            name: "team",
            type: "string",
            description: "Pick a team or remove the role",
            choices: [
                {
                    name: "Alpha",
                    value: "alpha"
                }, {
                    name: "Bravo",
                    value: "bravo"
                }, {
                    name: "Leave",
                    value: "leave"
                }
            ],
            required: true
        }],
        async (interaction) => {
            var team = interaction.options.getString("team");

            switch (team) {
                case "alpha":
                    await discordApi.addColorRoles([inkRoles[0]], interaction.member.id, everyRole);
                    await interaction.editReply("You've joined the Alpha Team!");
                    break;
                case "bravo":
                    await discordApi.addColorRoles([inkRoles[1]], interaction.member.id, everyRole);
                    await interaction.editReply("You've joined the Bravo Team!");
                    break;
                case "leave":
                    await discordApi.removeColorRoles(allRoles, interaction.member.id);
                    await interaction.editReply("You've left the team!");
                    break;
            }
        }
    );

    discordApi.addSlashCommand(
        "profile",
        "Manage your profile!  Take your link with you wherever you go!  It even works outside of Discord.",
        [{
            subcommand: true,
            name: "edit",
            description: "Edit your profile",
            parameters: [{
                name: "part",
                type: "string",
                description: "Change a part of your profile",
                choices: [
                    {
                        name: "Friend Code",
                        value: "friendcode"
                    },
                ],
                required: true
            }, {
                name: "value",
                type: "string",
                description: "The updated value",
                required: true
            }]
        }, {
            name: "get",
            description: "Get another user's profile",
            subcommand: true,
            parameters: [{
                name: "user",
                type: "user",
                description: "The user for the profile lookup",
                required: true
            }]
        }, {
            name: "me",
            description: "Get your own profile",
            subcommand: true
        }], 
        async (interaction) => {
            var subcommand = interaction.options._subcommand;

            if (subcommand === "edit") {
                const part = interaction.options.getString("part");
                const value = interaction.options.getString("value");

                if (part === "friendcode") {
                    var response = await profileApi.setProfile(interaction.member.id, value);

                    if (response.result === "updated")
                        await interaction.editReply("Updated friend code");
                    else if (response.result)
                        await interaction.editReply("Error updating friend code: " + response.result);
                    else 
                        await interaction.editReply("Error updating friend code: unknown error");
                }
            } else {
                var userToLookup = interaction.member;

                var otherUser = interaction.options.getUser("user");

                if (otherUser)
                    userToLookup = otherUser;

                var response = await profileApi.getProfile(userToLookup.id);

                if (response.friendCode) {
                    if (response.profileId) {
                        var row = new MessageActionRow()
                            .addComponents(
                                new MessageButton()
                                    .setURL(settings.profile.url + settings.profile.get + "/" + response.profileId + "?_v=" + new Date().valueOf())
                                    .setLabel("Full Profile")
                                    .setStyle("LINK")
                            );
                        await interaction.editReply({ content: "<@" + userToLookup.id + ">\n**Friend code:** \n" + response.friendCode, components: [row] });
                    } else {
                        await interaction.editReply("<@" + userToLookup.id + ">\n**Friend code:** \n" + response.friendCode);
                    }
                } else {
                    await interaction.editReply("Friend code not set");
                }
            }
        }
    )

    discordApi.registerSlashCommands();
});

const artFlair = [
    "Fan Art"
];

const artContestFlair = [
    "Art Contest"
];

/** @description Gets the correct channel this post should go in
 * 
 * @param {string} flairText The text of the flair
 * @returns {string} The correct channel ID
 */
function getChannel(flairText) {
    if (artFlair.indexOf(flairText) > -1)
        return artChannel;

    if (artContestFlair.indexOf(flairText) > -1)
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

function colorOffset() {
    var now = new Date();
    var fullDaysSinceEpoch = Math.floor(now/8.64e7);

    if (inkRoleColors && inkRoleColors.length)
        return fullDaysSinceEpoch % (inkRoleColors.length * 2);

    return 0;
}

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
                redditPost.flairText,
                redditPost.flairIcon);

            database.associateIds(redditPost.id, discordId);
        }
    }
}

async function cleanUp() {
    try {
        await databaseApi.cleanupOldAssociations();
    } catch (err) {
        console.log("Error cleaning up: " + err);
    }
}

// // run on startup, then run once per minute
// setTimeout(getNewPosts, 6000);
// var interval = setInterval(getNewPosts, 60000);

// // changeRoleColors();
// setTimeout(changeRoleColors, 5000);
// var interval2 = setInterval(changeRoleColors, 86400000);

// setTimeout(cleanUp, 5000);
// var interval3 = setInterval(cleanUp, 86400000);