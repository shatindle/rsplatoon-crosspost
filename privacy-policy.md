# Privacy Policy

The use of the r/Splatoon Bot application ("Application") in a server requires the collection of some user data ("Data").  The Data collected includes, but is not limited to:
- Discord User IDs
- Discord Guild IDs
- Discord Channel IDs
- Discord Message IDs
- User reactions to other user's messages
- The content of other user's messages for the purposes of cross posting to a starboard channel
- The deletion of some of the bot's messages by a moderator

All other data is data sent by the user via slash commands to control the bot.

Use of the Application is considered an agreement to the terms of this Policy.

## Access to Data

Access to Data is only permitted to the Application's developers, and only in the scope required for the development, testing, and implementation of features for Application. Data is not sold, provided to, or shared with any third party, except where required by law or a Terms of Service agreement. You can view the data upon request from `shane#1353` on Discord.

## Storage of Data

Configuration and suspected malicious message data is stored in Google Cloud Firestore.  Google Cloud Firestore is [encrypted at rest](https://cloud.google.com/firestore/docs/server-side-encryption). The database is secured to prevent external access, however no guarantee is provided and the Application owners assume no liability for the unintentional or malicious breach of Data. In the event of an unauthorised Data access, users will be notified through the Discord client application.

The data recorded in Firestore includes:
- User IDs
- Guild IDs
- Reddit post IDs and the associated Message ID crosspost
- Configuration Creation datetime stamps
- Emoji IDs for the starboard reactions
- Twitter post IDs and the associated Message ID crosspost
- Message IDs and the associated Message ID crosspost to another channel in the same server

The bot does not store message content, only the associated IDs.  The message content permission is only required to accomplish two things:
- Crossposting a message from one channel to another in the same server for it's starboard (fridge) feature.
- Reporting a subreddit post on Reddit when a moderator deletes the associated crossposted subreddit post in Discord.

## User Rights

At any time, you have the right to request to view the Data pertaining to your Discord account. You may submit a request through the [Discord Server](https://discord.gg/8ykjyQ8wJw). You have the right to request the removal of relevant Data.

## Underage Users

The use of the Application is not permitted for minors under the age of 13, or under the age of legal consent for their country. This is in compliance with the [Discord Terms of Service](https://discord.com/terms). No information will be knowingly stored from an underage user. If it is found out that a user is underage we will take all necessary action to delete the stored data.

## Questions

If you have any questions or are concerned about what data might be being stored from your account contact `shane#1353` on Discord. For more information check the [Discord Terms Of Service](https://discord.com/terms).