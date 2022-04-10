const stages = require("./langageData/stages.json");
const mainWeapons = require("./langageData/weapons.json").main;

function stageSwap(text) {
    // stage transformation
    for (var [game, list] of Object.entries(stages)) {
        for (var [japanese, english] of Object.entries(list)) {
            try {
                text = text.replace(japanese, english);
            } catch { /* don't care */}
        }
    }

    // weapon transformation
    for (var weaponPair of mainWeapons) {
        var japanese = weaponPair[0];
        var english = weaponPair[1];

        try {
            text = text.replace(japanese, english);
        } catch { /* don't care */}
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