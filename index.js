const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { clientId, guildId, token } = require('./config.json');
client.login(token);
const commands = [];
client.commands = new Collection();
const commandFiles = fs.readdirSync('./comandos').filter(file => file.endsWith('.js'));

for (const file of commandFiles){
	const command = require(`./comandos/${file}`);
	commands.push(command.data.toJSON());
  client.commands.set(command.data.name, command);
}

const rest = new REST({ version: '9' }).setToken(token);
(async () => {
	try {
    await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);
	}
    catch (error){
		console.error(error);
	}
})();

client.on('ready', ()=> {
    console.log(`Iniciado como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
	const command = client.commands.get(interaction.commandName);
	if (!command) return;
	try {
		await command.execute(interaction, client);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});