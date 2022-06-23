const { SlashCommandBuilder } = require('@discordjs/builders');
const discordApi = require("../../DAL/discordApi");
const redditApi = require("../../DAL/redditApi");
const settings = require("../../settings.json");
const subReddit = settings.subReddit;

let lastMessageTimestamp = null;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('random')
		.setDescription('Pulls in a random submission from the subreddit.'),
	async execute(interaction) {
        // check for ratelimit
        const postedOn = new Date();
    
        if (lastMessageTimestamp !== null && Math.abs(postedOn - lastMessageTimestamp) < 5000) {
            return await discordApi.rateLimit(interaction.channel_id, interaction);
        }

        lastMessageTimestamp = postedOn;

        // get a random post
        const posts = await redditApi.getRandomPost(subReddit);

        const redditPost = posts[0];

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
            interaction);
	},
};