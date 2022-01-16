const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
    projectId: 'rsplatoon-discord',
    keyFilename: './rsplatoon-discord-firebase.json',
});

const postCache = [];
const fridgeCache = [];

function addToCache(item, cache) {
    cache.unshift(item);

    while (cache.length > 100)
        cache.pop();
}

function checkPostCache(item) {
    for (var i = 0; i < postCache.length; i++) {
        if (postCache[i].redditId == item.redditId || postCache[i].discordId == item.discordId) {
            var first = postCache[i];

            postCache.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });
            
            return first;
        }
    }
}

async function findByRedditId(id) {
    var inCacheValue = checkPostCache({redditId: id});

    if (inCacheValue)
        return inCacheValue;

    var response = await db.collection("associations").where("redditId", "==", id).get();

    if (response.empty)
        return null;

    var result;

    response.forEach((doc) => {
        result = doc.data();
    });

    addToCache(result, postCache);
    
    return result;
}

async function findByDiscordId(id) {
    var inCacheValue = checkPostCache({discordId: id});

    if (inCacheValue)
        return inCacheValue;

    var response = await db.collection("associations").where("discordId", "==", id).get();

    if (response.empty)
        return null;

    var result;

    response.forEach((doc) => {
        result = doc.data();
    });

    addToCache(result, postCache);
    
    return result;
}

async function associateIds(redditId, discordId) {
    var record = {
        discordId: discordId,
        redditId: redditId,
        createdOn: Firestore.Timestamp.now()
    };
    
    await db.collection("associations").add(record);

    addToCache(record, postCache);
}

async function cleanupOldAssociations() {
    // delete documents older than 3 days
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const firestoreDate = Firestore.Timestamp.fromDate(date);

    const docsToDelete = await db.collection("associations").where("createdOn", "<", firestoreDate).get();

    docsToDelete.forEach(element => {
        element.ref.delete();
    });
}

async function postToFridge(messageId, guildId) {
    var record = {
        messageId: messageId,
        guildId: guildId,
        createdOn: Firestore.Timestamp.now()
    };

    await db.collection("artfridge").doc(guildId + "-" + messageId).set(record);

    // TODO: add caching to avoid server wait
    //addToCache(record, fridgeCache);
}

async function getArtFromFridge(messageId, guildId) {
    // TODO: check fridge cache first

    var doc = await db.collection("artfridge").doc(guildId + "-" + messageId).get();

    if (doc.exists)
        return doc.data();

    return null;
}

async function markReported(redditId, deletedBy) {
    var response = await db.collection("associations").where("redditId", "==", redditId).get();

    await db.collection("associations").doc(response.docs[0].id).update({
        reportedBy: deletedBy
    });
}

const guildChannels = {};

async function setSubredditChannel(guildId, channelId) {
    var doc = await db.collection("crosspostchannels").doc(guildId).get();

    var now = Firestore.Timestamp.now();

    if (doc.exists) {
        await db.collection("crosspostchannels").doc(guildId).update({
            subreddit: channelId,
            updatedOn: now
        });

        guildChannels[guildId].subreddit = channelId;
    } else {
        await db.collection("crosspostchannels").doc(guild).set({
            guildId: guildId,
            subreddit: channelId,
            art: null,
            artfridge: null,
            updatedOn: now,
            createdOn: now
        });

        guildChannels[guildId] = {
            subreddit: channelId,
            art: null,
            artfridge: null
        };
    }
}

async function setArtChannel(guildId, channelId) {
    var doc = await db.collection("crosspostchannels").doc(guildId).get();

    var now = Firestore.Timestamp.now();

    if (doc.exists) {
        await db.collection("crosspostchannels").doc(guildId).update({
            art: channelId,
            updatedOn: now
        });

        guildChannels[guildId].art = channelId;
    } else {
        await db.collection("crosspostchannels").doc(guild).set({
            guildId: guildId,
            subreddit: null,
            art: channelId,
            artfridge: null,
            updatedOn: now,
            createdOn: now
        });

        guildChannels[guildId] = {
            subreddit: null,
            art: channelId,
            artfridge: null
        };
    }
}

async function setArtFridgeChannel(guildId, channelId) {
    var doc = await db.collection("crosspostchannels").doc(guildId).get();

    var now = Firestore.Timestamp.now();

    if (doc.exists) {
        await db.collection("crosspostchannels").doc(guildId).update({
            artfridge: channelId,
            updatedOn: now
        });

        guildChannels[guildId].artfridge = channelId;
    } else {
        await db.collection("crosspostchannels").doc(guild).set({
            guildId: guildId,
            subreddit: null,
            art: null,
            artfridge: channelId,
            updatedOn: now,
            createdOn: now
        });

        guildChannels[guildId] = {
            subreddit: null,
            art: null,
            artfridge: channelId
        };
    }
}

async function loadAllChannels() {
    const docs = await db.collection("crosspostchannels").get();

    Object.keys(guildChannels).forEach(key => delete guildChannels[key]);

    docs.forEach(element => {
        guildChannels[element.id] = element.data();
    });
}

async function deleteGuild(guildId) {
    await db.collection('crosspostchannels').doc(guildId).delete();

    if (guildChannels[guildId])
        delete guildChannels[guildId];
}

module.exports = {
    findByRedditId: findByRedditId,
    findByDiscordId: findByDiscordId,
    associateIds: associateIds,
    markReported: markReported,
    postToFridge: postToFridge,
    getArtFromFridge: getArtFromFridge,
    cleanupOldAssociations: cleanupOldAssociations
};