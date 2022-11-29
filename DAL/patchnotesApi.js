const fetch = require("node-fetch");
const cheerio = require("cheerio");
const TurndownService = require('turndown');
var turndownPluginGfm = require('turndown-plugin-gfm');

const turndownService = new TurndownService();
turndownService.use(turndownPluginGfm.gfm)

async function getSupportPage(url) {
    const result = await fetch(url);

    return await result.text();
}

/**
 * 
 * @param {string} version 
 * @param {cheerio.CheerioAPI} $ 
 */
function extractContent(version, $) {
    const content = $("section.update-versions").children();

    const start = content.find(`a[name=${version}]`).first().parent();

    let previous, current, next = start;

    let html = "";

    do {
        current = next;

        html += $.html(current);

        next = current.next();
    } while (next.find("a[name]").length === 0 && next.length !== 0);

    return turndownService.turndown(html);
}

async function extractPatchNotes(url) {
    const html = await getSupportPage(url);

    const $ = cheerio.load(html);

    const versions = [];
    $("a[name]").each((i, $this) => versions.push({
        version: $($this).attr("name"),
        name: $($this).text(),
        content: extractContent($($this).attr("name"), $)
    }));

    return versions.reverse();
}

module.exports = {
    extractPatchNotes
};