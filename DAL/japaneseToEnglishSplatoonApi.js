const stages = require("./langageData/stages.json");

function stageSwap(text) {
    for (const [game, list] of Object.entries(stages)) {
        for (const [japanese, english] of Object.entries(list)) {
            try {
                text = text.replace(japanese, english);
            } catch { /* don't care */}
        }
    }

    return text;
}

function swapAll(text) {
    text = stageSwap(text);

    return text;
}

module.exports = {
    stageSwap,
    swapAll
}