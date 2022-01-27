const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
    projectId: 'rsplatoon-discord',
    keyFilename: './rsplatoon-discord-firebase.json',
});

const postCache = [];
const tweetCache = [];

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

function checkTweetCache(item) {
    for (var i = 0; i < tweetCache.length; i++) {
        if (tweetCache[i].id == item.id) {
            var first = tweetCache[i];

            tweetCache.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });
            
            return first;
        }
    }
}

async function findByTwitterId(id) {
    const inCacheValue = checkTweetCache({ id });

    if (inCacheValue)
        return inCacheValue;

    const response = await db.collection("tweets").doc(id).get();

    if (!response.exists)
        return null;

    let result = response.data();

    addToCache(result, tweetCache);

    return result;
}

async function saveTweet(tweet, discordId) {
    var record = {
        id: tweet.id,
        discordId,
        createdOn: Firestore.Timestamp.now()
    };
    
    await db.collection("tweets").doc(tweet.id).set(record);

    addToCache(record, tweetCache);
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

module.exports = {
    findByRedditId,
    findByDiscordId,
    associateIds,
    markReported,
    postToFridge,
    getArtFromFridge,
    cleanupOldAssociations,
    findByTwitterId,
    saveTweet
};