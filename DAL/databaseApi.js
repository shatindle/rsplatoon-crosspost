const Firestore = require('@google-cloud/firestore');
const { project_id } = require("../firebase.json");

const db = new Firestore({
    projectId: project_id,
    keyFilename: './firebase.json',
});

const postCache = [];
const tweetCache = [];
const patchNotesCache = [];

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

function checkPatchNotesCache(item) {
    for (var i = 0; i < patchNotesCache.length; i++) {
        if (patchNotesCache[i].id == item.id) {
            var first = patchNotesCache[i];

            patchNotesCache.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });
            
            return first;
        }
    }
}

async function findByPatchNotes(id) {
    const inCacheValue = checkPatchNotesCache({ id });

    if (inCacheValue)
        return inCacheValue;

    const response = await db.collection("patchnotes").doc(id).get();

    if (!response.exists)
        return null;

    let result = response.data();

    addToCache(result, patchNotesCache);

    return result;
}

async function savePatchNotes(version, content, discordId) {
    var record = {
        id: version,
        content,
        discordId,
        createdOn: Firestore.Timestamp.now()
    };
    
    await db.collection("patchnotes").doc(version).set(record);

    addToCache(record, patchNotesCache);
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

async function cleanupTheFridge() {
    // delete documents older than 31 days
    const date = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const firestoreDate = Firestore.Timestamp.fromDate(date);

    const docsToDelete = await db.collection("artfridge").where("createdOn", "<", firestoreDate).get();

    docsToDelete.forEach(element => {
        element.ref.delete();
    });
}

async function createFridge(guildId, source, target, upvote, count, color, createdBy) {
    const createdOn = Firestore.Timestamp.now();

    const record = {
        sources: [source],
        target, 
        upvote,
        count,
        color,
        createdBy,
        createdOn
    };

    const doc = await db.collection("fridges").doc(guildId).get();

    if (doc.exists) {
        const data = doc.data();
        data.fridges = [
            ...data.fridges,
            record
        ];

        await db.collection("fridges").doc(guildId).set(data);
    } else {
        await db.collection("fridges").doc(guildId).set({
            fridges: [record],
            guildId,
            createdOn
        });
    }
}

async function removeFridge(guildId, index) {
    const doc = await db.collection("fridges").doc(guildId).get();

    const data = doc.data();
    data.fridges.splice(index, 1);

    if (data.fridges.length === 0) {
        // delete the full record
        await doc.ref.delete();
    } else {
        await db.collection("fridges").doc(guildId).set(data);
    }
}

async function addFridgeSource(guildId, index, source) {
    const doc = await db.collection("fridges").doc(guildId).get();

    const data = doc.data();
    data.fridges[index].sources.push(source);

    await db.collection("fridges").doc(guildId).set(data);
}

async function removeFridgeSource(guildId, index, source) {
    const doc = await db.collection("fridges").doc(guildId).get();

    const data = doc.data();
    data.fridges[index].sources.splice(data.fridges[index].sources.indexOf(source), 1);

    await db.collection("fridges").doc(guildId).set(data);
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

async function getItemFromFridge(messageId, guildId) {
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

const callbacks = {};

function monitor(type, callback) {
    if (!callbacks[type]) callbacks[type] = [];

    callbacks[type].push(callback);

    setupObservers();
}

const observers = {};

function setupObservers() {
    for (let observer of Object.keys(callbacks)) {
        if (!observers[observer] && callbacks[observer] && callbacks[observer].length > 0)
            observers[observer] = configureObserver(observer, callbacks[observer]);
    }
}

function configureObserver(type, callbackGroup) {
    return db.collection(type).onSnapshot(async querySnapshot => {
        let changes = {
            added: [],
            modified: [],
            removed: []
        };
    
        querySnapshot.docChanges().forEach(change => {
            changes[change.type].push({...change.doc.data(), _id:change.doc.id});
        });
    
        for (let i = 0; i < callbackGroup.length; i++) {
            try {
                await callbackGroup[i].call(null, changes);
            } catch (err) {
                console.log(`Error in callback ${i} of ${type}: ${err.toString()}`);
            }
        }
    });
}

module.exports = {
    findByRedditId,
    findByDiscordId,
    associateIds,
    markReported,
    postToFridge,
    getItemFromFridge,
    cleanupOldAssociations,
    cleanupTheFridge,
    findByTwitterId,
    saveTweet,

    monitor,
    createFridge,
    removeFridge,
    addFridgeSource,
    removeFridgeSource,

    findByPatchNotes,
    savePatchNotes
};