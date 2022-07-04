const { 
    monitor, 
    createFridge,
    removeFridge,
    addFridgeSource,
    removeFridgeSource
} = require("./databaseApi");

const fridges = {};

function addressChanges(changes, list) {
    try {
        changes.added.forEach(item => list[item._id] = item);
        changes.modified.forEach(item => list[item._id] = item);
        changes.removed.forEach(item => delete list[item._id]);
    } catch (err) {
        console.log(`Failed to address changes: ${err.toString()}`);
    }
}

function init() {
    monitor("fridges", (changes) => addressChanges(changes, fridges));
}

module.exports = {
    fridges,
    init,
    createFridge,
    removeFridge,
    addFridgeSource,
    removeFridgeSource
};