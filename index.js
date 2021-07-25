const { Message, Client, MessageEmbed, Collection } = require("discord.js");
const { Sequelize, DataTypes } = require('sequelize');


const prefix = "+"
const token = "dein token hier rein"
const color = "RANDOM"
const client = new Client();

const serversql = new Sequelize('server_tabelle', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'server.sqlite',
});

const Server = serversql.define('server_tabelle', {
    guild_id: {
        type: DataTypes.TEXT,
        primaryKey: true,
        unique: true
    },
    channel: {
        type: DataTypes.TEXT,
        defaultValue: "0"
    }

});
var server_cache = new Collection();
const syncDatabase = async() => {
    try {
        await serversql.sync();
        console.log(' > 🗸 Server Configs');
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

Reflect.defineProperty(server_cache, "getServer", {
    value: async function(id) {
        var guild = server_cache.get(id);
        if (!guild) guild = await Server.findOne({ where: { guild_id: id } });
        if (!guild) {
            guild = await Server.create({ guild_id: id });
            server_cache.set(id, guild);
        }
        return guild;
    }
});

Reflect.defineProperty(server_cache, "getChannels", {
    value: async function() {
        channels = await Server.findAll({});
        return channels;
    }
});

const initDatabase = async() => {
    await syncDatabase();

    try {
        for (let entr of(await Server.findAll())) server_cache.set(entr.guild_id, entr);
        console.log(" > 🗸 Die Datenbank Einträge wurden erfolgreich Geladen  ");
    } catch (e) {
        console.log(" > ❌ Es gab einen Fehler bei den Einträgen der Datenbank")
        console.log(e);
    }
}
client.database = { server_cache };
const start = async() => {
    try {
        console.log("Login");
        await client.login(token).catch(e => {
            switch (e.code) {
                case 500:
                    console.log(" > ❌ Fetch Fehler");
                    break;
                default:
                    console.log(" > ❌ Unbekannter Fehler");
                    break;
            }
            setTimeout(() => { throw e }, 5000); 
        });

        console.log("Datenbank wird gestartet");
        await initDatabase();
    } catch (e) {
        console.log(e);
    }
}
start();

client.on("ready", async() => {
    console.log(" >  Eingeloggt als: " + client.user.tag);
    client.user.setPresence({ activity: { name: "+help", type: "Watching" }, status: 'online' });
});

client.on("message", async message => {
    if (message.author.bot) return;
    let config = (await client.database.server_cache.getServer(message.guild.id)).channel

    if (config == message.channel.id) {
        sendGlobal(message, createGlobalMsg(message, message.content))
        try { await message.delete() } catch (e) {
            message.channel.send('Fehlende Berechtigung! \n' + e)
        }
    }
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift();

    if (command == "help") message.channel.send(createEmbed(message, "**+add #channel**\n Um den Global Channel zu setzen\n\n **remove**\n Um ihn zu entfernen."))
    if (command == "add") {
        let channel = message.mentions.channels.first()
        if (!channel) return message.channel.send("Bitte gebe einen Channel an")
        let config = await client.database.server_cache.getServer(message.guild.id)
        config.channel = channel.id
        await config.save()
        message.channel.send(createEmbed(message, `Dein channel [<#${channel.id}>] ist nun der Global Channel!`))
    }
    if (command == "remove") {
        let config = await client.database.server_cache.getServer(message.guild.id)
        let chan = config.channel
        config.channel = 0
        await config.save()
        message.channel.send(createEmbed(message, `Dein Channel  [<#${chan}>] wurde als Global Channel entfernt!`))
    }
    if (command == "info") {
        let config = await client.database.server_cache.getServer(message.guild.id)
        let GuildGlobalChannel = config.channel
        if (GuildGlobalChannel !== 0) { message.channel.send(`Der Global Chat dieses Servers ist <#${GuildGlobalChannel}>`) } else {
            message.channel.send('Es gibt zurzeit noch keine Global Channel')
        }
    }
});

function createGlobalMsg(msg, text) {
    let emb = new MessageEmbed()
        .setColor(color)
        .setAuthor(msg.author.tag, msg.author.avatarURL())
        .setDescription(text)
        .setFooter(msg.guild.name)
        .setTimestamp()
        .setThumbnail(msg.guild.iconURL())
    return emb
}


function createEmbed(msg, text) {
    let emb = new MessageEmbed()
        .setColor(color)
        .setAuthor(msg.author.tag, msg.author.avatarURL())
        .setDescription(text)
        .setFooter("Aufgerufen von: " + msg.author.tag)
        .setTimestamp()
    return emb
}

async function sendGlobal(msg, emb) {
    let cache = await client.database.server_cache.getChannels()
    for (entry of cache) {
        if (entry.channel == 0) return
        let channel = client.channels.resolve(entry.channel)
        if (!channel) return
        channel.send(emb).catch()
    }
}
