
// poor man's database
var db = [];

async function findByRedditId(id) {
    for (var i = 0; i < db.length; i++) {
        if (db[i].redditId === id)
            return db[i];
    }

    return null;
}

async function findByDiscordId(id) {
    for (var i = 0; i < db.length; i++) {
        if (db[i].discordId === id)
            return db[i];
    }

    return null;
}

async function associateIds(redditId, discordId) {
    db.push({
        discordId: discordId,
        redditId: redditId
    });
}

module.exports = {
    findByRedditId: findByRedditId,
    findByDiscordId: findByDiscordId,
    associateIds: associateIds
};