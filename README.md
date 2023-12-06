# rsplatoon-crosspost
A Reddit and Discord bot that posts Reddit posts to Discord, specifically for r/Splatoon. The bot is also capable of reporting Reddit posts when they are deleted from Discord by a mod.

# files not included:
- node_modules
- oauth_info.json
- package-lock.json
- .vscode
- discord.json
- firebase.json
- settings.json

# setup
- ensure you have node installed
- run npm install
- add a oauth_info.json (reddit config) file with your configs (use oauth_info.sample.json as an example)
- add a discord.json (discord config) file with your bot token (use discord.sample.json as an example)
- add firebase.json (google firebase config and cert) file with your firebase connection config
- add settings.json (which reddit to use and which discord to channels to post to) (settings.sample.json is the example)
- run npm start
- you can wrap this in foreverjs if you want it to re-start itself automatically if it fails for any reason

# using a different datastore
If you want to use a different datastore or move to an in-memory only model, the only thing you need to modify is DAL/databaseApi.js.  This file is wholely responsible for tracking the reddit post IDs that have already been sent to discord.  If you intend to change the datastore to something else, you will need to ensure the most recent (usually 20) post IDs are retained in memory so you don't re-post something the bot has already sent to discord.

# info for getting your OAuth2 token for reddit
[https://github.com/reddit-archive/reddit/wiki/OAuth2](https://github.com/reddit-archive/reddit/wiki/OAuth2)
You will also need to acquire a refresh token using your client ID and secret.  Helpful script to do this: [https://github.com/not-an-aardvark/reddit-oauth-helper](https://github.com/not-an-aardvark/reddit-oauth-helper)

# info for getting your discord bot token
[https://discord.com/developers/applications](https://discord.com/developers/applications)
