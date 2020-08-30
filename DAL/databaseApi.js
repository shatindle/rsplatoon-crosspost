const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
    projectId: 'rsplatoon-discord',
    keyFilename: './rsplatoon-discord-firebase.json',
});

async function findByRedditId(id) {
    var response = await db.collection("associations").where("redditId", "==", id).get();

    if (response.empty)
        return null;

    var result;

    response.forEach((doc) => {
        result = doc.data();
    });
    
    return result;
}

async function findByDiscordId(id) {
    var response = await db.collection("associations").where("discordId", "==", id).get();

    if (response.empty)
        return null;

    var result;

    response.forEach((doc) => {
        result = doc.data();
    });
    
    return result;
}

async function associateIds(redditId, discordId) {
    await db.collection("associations").add({
        discordId: discordId,
        redditId: redditId
    });
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