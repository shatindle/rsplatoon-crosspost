const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, token, localDev, guildId } = require('./discord.json');



if (localDev) {
    const commands = [];
    const commandFiles = fs.readdirSync('./commands/private').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/private/${file}`);
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '9' }).setToken(token);

	rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
} else {
    const commands = [];
    const commandFiles = fs.readdirSync('./commands/public').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/public/${file}`);
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '9' }).setToken(token);

	rest.put(Routes.applicationCommands(clientId), { body: commands })
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
}