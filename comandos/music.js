const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    createAudioResource, getVoiceConnection,
    joinVoiceChannel, createAudioPlayer,
    NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const COOKIE = 'VISITOR_INFO1_LIVE=-b2w8wPrero; _ga=GA1.2.1972042504.1630901362; YSC=B9EVGU0s9Nk; wide=1; LOGIN_INFO=AFmmF2swRQIgeB8MAANvYC2h1xEz_1DIxVi2e7GjWA2tP0BoEksLb1ACIQDwXProJ6AHX8ziIIiJCtryNihvlKkfgAZdW2KDAlzN3A:QUQ3MjNmejdSRkRBQmdMZVAxT0lDU21yTExVMy1TT2d2MUlvTXlySzJHZWlweUptQXg5ak01QzJGd0wzeVc4VVZrbVBvSlAwdGlJcnV5Mmt1RU5VbTQ5ejlJQ0NrZHJENnpuN1pWajVMaDBET0FEWl9CRXdyMzJySjNNckJTS0FzWG54Z2QtZC12R0N6dWtSdldFMUE1OHNLdXdDc2QycHlR; SID=CAiZWh7Ha9qwiq6ObMyPtdo5NOR6NfV1zQ3T_wSajSIFKInpLOKzWLFDmW6MZDgyz51Xjw.; __Secure-1PSID=CAiZWh7Ha9qwiq6ObMyPtdo5NOR6NfV1zQ3T_wSajSIFKInp_9SMPmYNnOmntOItditV3w.; __Secure-3PSID=CAiZWh7Ha9qwiq6ObMyPtdo5NOR6NfV1zQ3T_wSajSIFKInpuCqbOEpdhbZNVSZTxmH6Vg.; HSID=AtcTyfVirc8yE21W3; SSID=Aj2-v8PAwUapmAKyF; APISID=jcay-52czoWTXJPl/A2JEglKvxI-DsAB9v; SAPISID=8rH7zuraTnzTWYZd/AM2rljq7eaK1SjcDv; __Secure-1PAPISID=8rH7zuraTnzTWYZd/AM2rljq7eaK1SjcDv; __Secure-3PAPISID=8rH7zuraTnzTWYZd/AM2rljq7eaK1SjcDv; PREF=tz=America.Santiago&f6=400; SIDCC=AJi4QfEmq43Ho2g_ephx9hSegOVRFqMo6jQSnnnettrTY4JtHlkEjhLYvGh3SNBxLZr3EkJYeLo; __Secure-3PSIDCC=AJi4QfFOpSg-AYuHItDDu2qW1oButwrhEDVDtc5JWd36WsllaMBL2WNkl-G4fQWvrOx0u_OzOg';
//Global queue for your bot. Every server will have a key and value pair in this map. { guild.id, queue_constructor{} }
const queue = new Map();
module.exports = {
    data: new SlashCommandBuilder()
    .setName('sos')
    .setDescription('Música de YouTube')
    .addStringOption(option =>
        option.setName('busqueda')
        .setRequired(true)
        .setDescription('SKIP: saltar STOP: detener COLA: ver cola actual')),
    async execute(interaction, client){
        await interaction.deferReply();
        const url = interaction.options.getString('busqueda');
        const Guild = client.guilds.cache.get(interaction.member.guild.id);
        const Member = Guild.members.cache.get(interaction.member.id);
        const voice_channel = Member.voice.channel;
        if (!voice_channel) return interaction.editReply('¡Necesitas estar en un canal para ejecutar este comando!');
        const permissions = voice_channel.permissionsFor(interaction.client.user);
        if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) return interaction.editReply('No tienes los permisos correctos');
        //This is our server queue. We are getting this server queue from the global queue.
        const server_queue = queue.get(interaction.guild.id);
        if(url.toLowerCase() == 'skip'){
            skip_song(interaction, server_queue, voice_channel);
            return;
        }
        else if(url.toLowerCase() == 'stop'){
            stop_song(interaction, server_queue, voice_channel);
            return;
        }
        else if(url.toLowerCase() == 'cola'){
            cola(interaction, server_queue, voice_channel);
            return;
        }
        //If the user has used the play command
        let song = {};
        //interaction.editReply('calmao oe');
        if (ytdl.validateURL(url)){
            const song_info = await ytdl.getInfo(url);
            song = {
                title: song_info.videoDetails.title,
                url: song_info.videoDetails.video_url,
                views: agregarPuntos(song_info.videoDetails.viewCount),
                author: song_info.videoDetails.ownerChannelName,
                duration: new Date(song_info.videoDetails.lengthSeconds*1000).toISOString().substr(14, 5),
                user: interaction.member.user.tag
            }
        }
        else{
            const video_finder = async (url) =>{
                const video_result = await ytSearch(url);
                return (video_result.videos.length > 1) ? video_result.videos[0] : null;
            }
            const video = await video_finder(url);
            if(!video) return interaction.editReply(`No se encuentró resultados de ${url}`);
            song = {
                title: video.title,
                url: video.url,
                views: agregarPuntos(video.views),
                author: video.author.name,
                duration: new Date(video.seconds*1000).toISOString().substr(14, 5),
                user: interaction.member.user.tag
            }
        }
        if (!server_queue){
            const queue_constructor = {
                voice_channel: voice_channel,
                text_channel: interaction.channel,
                connection: null,
                songs: []
            }
        //Add our key and value pair into the global queue. We then use this to get our server queue.
        queue.set(interaction.guild.id, queue_constructor);
        queue_constructor.songs.push(song);

        //Establish a connection and play the song with the video_player function.
        try {
            let connection = joinVoiceChannel({
                channelId: interaction.member.voice.channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
            connection = getVoiceConnection(interaction.guild.id);
            queue_constructor.connection = connection;
            video_player(interaction.guild, queue_constructor.songs[0], connection, interaction);
        }
        catch(err){
            queue.delete(interaction.guild.id);
            return interaction.editReply('Ocurrió un error al conectar!');
        }
        }
        else{
            server_queue.songs.push(song);
            return interaction.editReply(`**${song.title}** agregada a la cola`);
        }
}}

function agregarPuntos(nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + '.' + '$2');
    }
    return x1 + x2;
}

const video_player = async (guild, song, connection, interaction) => {
    const song_queue = queue.get(guild.id);
    if (!song){
        connection.destroy();
        queue.delete(guild.id);
        return;
    }
    const video = ytdl(song.url, options);
    const stream = createAudioResource(video);
    player = createAudioPlayer();
    connection.subscribe(player);
    interaction.editReply(`Está sonando: **${song.title}**\nSubido por: **${song.author}**\n**${song.views}** visitas\nDuración: **${song.duration}**\nAgregado por: **${song.user}**`);
    player.play(stream, {highWaterMark: 1});
    player.on('error', e => {
       console.error(e);
       return interaction.editReply(e.message);
    });
    player.on(AudioPlayerStatus.Idle, () => {
        song_queue.songs.shift();
        video_player(guild, song_queue.songs[0], connection, interaction);
    });
}


var options = {
    requestOptions: {
          headers: {
            cookie: COOKIE,
            // Optional. If not given, ytdl-core will try to find it.
            // You can find this by going to a video's watch page, viewing the source,
            // and searching for "ID_TOKEN".
            // 'x-youtube-identity-token': 1324,
          },
        },
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1<<25
    };      

const skip_song = (interaction, server_queue, voice_channel) => {
    if (!voice_channel) return interaction.editReply('¡Necesitas estar en un canal para ejecutar este comando!');
    else if (!server_queue) return interaction.editReply('No hay canciones en la cola u.u');
    player.stop();
    interaction.editReply(`Se ha saltado **${server_queue.songs[0].title}**`);
}

const stop_song = (interaction, server_queue, voice_channel) => {
    if (!voice_channel) return interaction.editReply('¡Necesitas estar en un canal para ejecutar este comando!');
    else if (!server_queue) return interaction.editReply('No hay canciones en la cola u.u');
    server_queue.songs = [];
    player.stop();
    return interaction.editReply(`Xhao`);
}

const cola = (interaction, server_queue, voice_channel) => {
    if (!voice_channel) return interaction.editReply('¡Necesitas estar en un canal para ejecutar este comando!');
    else if (!server_queue) return interaction.editReply('No hay canciones en la cola u.u');
    let videos = [];
    server_queue.songs.forEach(song => {
        videos.push(`${song.title}\nAgregado por: **${song.user}**`);
    });
    return interaction.editReply(`Videos actuales en la cola: **${(server_queue.songs).length}**\n\n${videos.join('\n')}`);
}