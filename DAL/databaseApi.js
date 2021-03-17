const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
    projectId: 'rsplatoon-discord',
    keyFilename: './rsplatoon-discord-firebase.json',
});

const localCache = [];

function addToCache(item) {
    localCache.unshift(item);

    while (localCache.length > 100)
        localCache.pop();
}

function checkCache(item) {
    for (var i = 0; i < localCache.length; i++) {
        if (localCache[i].redditId == item.redditId || localCache[i].discordId == item.discordId) {
            var first = localCache[i];

            localCache.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });
            
            return first;
        }
    }
}

async function findByRedditId(id) {
    var inCacheValue = checkCache({redditId: id});

    if (inCacheValue)
        return inCacheValue;

    var response = await db.collection("associations").where("redditId", "==", id).get();

    if (response.empty)
        return null;

    var result;

    response.forEach((doc) => {
        result = doc.data();
    });

    addToCache(result);
    
    return result;
}

async function findByDiscordId(id) {
    var inCacheValue = checkCache({discordId: id});

    if (inCacheValue)
        return inCacheValue;

    var response = await db.collection("associations").where("discordId", "==", id).get();

    if (response.empty)
        return null;

    var result;

    response.forEach((doc) => {
        result = doc.data();
    });

    addToCache(result);
    
    return result;
}

async function associateIds(redditId, discordId) {
    var record = {
        discordId: discordId,
        redditId: redditId
    };
    
    await db.collection("associations").add(record);

    addToCache(record);
}

async function markReported(redditId, deletedBy) {
    var response = await db.collection("associations").where("redditId", "==", redditId).get();

    await db.collection("associations").doc(response.docs[0].id).update({
        reportedBy: deletedBy
    });
}

module.exports = {
    findByRedditId: findByRedditId,
    findByDiscordId: findByDiscordId,
    associateIds: associateIds,
    markReported: markReported
};