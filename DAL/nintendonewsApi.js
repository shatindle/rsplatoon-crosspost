const fetch = require("node-fetch");
const {
    nintendoNewsFeeds
} = require("../settings.json");

async function getPosts(url) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [nintendoNewsFeeds.apiKeyName]: nintendoNewsFeeds.apiKeyValue
        }
    });

    if (!response.ok) throw "Unable to get Nintendo news data";

    let data = await response.json();

    const results = [];

    for (let record of data) {
        results.push({
            id: record.id,
            articleId: record.articleId,
            image: record.image,
            startDate: new Date(record.startDate),
            content: record.content,
            url: record.url
        });
    }

    // put oldest first
    results.reverse();

    return results;
}

async function getDetails(url, articleId) {
    const response = await fetch(`${url}/${articleId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [nintendoNewsFeeds.apiKeyName]: nintendoNewsFeeds.apiKeyValue
        }
    });

    if (!response.ok) throw "Unable to get Nintendo news data";

    let data = await response.json();

    let results = "";

    for (let record of data) {
        results += record + "\n\n";
    }

    results.trim();

    return results;
}

module.exports = {
    getPosts,
    getDetails
};