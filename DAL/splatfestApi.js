const fetch = require("node-fetch");
const { splatfestApiKeyHeader, splatfestApiKey } = require("../settings.json");

async function pickSplatfestTeam(userId, teamChoice) {
    try {
        const response = await fetch("https://splatfest.rsplatoon.com/api/pickteam", {
            method: "PUT",
            headers: {
                [splatfestApiKeyHeader]: splatfestApiKey,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                teamChoice
            })
        });

        if (response.status === 201) return true;

        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function setServerRoles(server, team1, team2) {
    try {
        const response = await fetch(`https://splatfest.rsplatoon.com/api/config/${server}/roles`, {
            method: "PUT",
            headers: {
                [splatfestApiKeyHeader]: splatfestApiKey,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                team1,
                team2
            })
        });
    
        if (response.status === 201) return true;
    
        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function deleteServerRoles(server) {
    try {
        const response = await fetch(`https://splatfest.rsplatoon.com/api/config/${server}`, {
            method: "DELETE",
            headers: {
                [splatfestApiKeyHeader]: splatfestApiKey,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
    
        if (response.status === 202) return true;
    
        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports = {
    pickSplatfestTeam,
    setServerRoles,
    deleteServerRoles
};