const fetch = require('node-fetch');
const profileSettings = require("../settings.json").profile;



async function getProfile(userId) {
    var url = new URL(profileSettings.url + profileSettings.get);
    url.search = new URLSearchParams({ userId });

    const headers = {
        'Content-Type': 'application/json'  
    };
    
    headers[profileSettings.apiKeyName] = profileSettings.apiKeyValue;

    var response = await fetch(url, {
        method: 'GET',
        headers
    });

    return response.json();
}

async function setProfile(userId, friendcode) {
    var url = new URL(profileSettings.url + profileSettings.save);

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'  
    };
    
    headers[profileSettings.apiKeyName] = profileSettings.apiKeyValue;

    var data = new URLSearchParams();
    data.append("userId", userId);
    data.append("friendcode", friendcode);

    var response = await fetch(url, {
        method: 'POST',
        body: data,
        headers
    });

    return response.json();
}

module.exports = {
    getProfile,
    setProfile
};