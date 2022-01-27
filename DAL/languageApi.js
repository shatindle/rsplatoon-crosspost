const {Translate} = require('@google-cloud/translate').v2;

const translate = new Translate({
    projectId: "rsplatoon-discord",
    keyFilename: __dirname + "/../translate.json"
});

async function translateText(text, lang = "en") {
    try {
        // translate test from english into lang
        var [translation] = await translate.translate(text, lang);

        return translation;
    } catch (ex) {
        console.log("Something went wrong when attempting to translate");

        return null;
    }
}

module.exports = {
    translateText
}