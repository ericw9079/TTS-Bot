const tmi = require('tmi.js');
const { Client, Intents, MessageEmbed } = require('discord.js');
const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS,Intents.FLAGS.GUILD_VOICE_STATES,Intents.FLAGS.GUILD_MESSAGES] });
const gtts = require('node-gtts')('en-uk');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const logger = require('@ericw9079/logger');
const config = require("./config.json");
const prefix = config.prefix;
const logChannel = config.log;

// Define configuration options
const opts = {
  connection: {
	secure: true
  }
};

let firstLogin    = 0;
const streamQueues  = {};
const players		  = {};
const channelMaps   = {};
let ttsStrings    = {};
let twitchIgnore  = {};
let censoredWords = {};
let nameMappings  = {};
const channelNames  = {};

// Create a client with our options
const client = new tmi.client(opts);

client.on('chat', onChatHandler);
client.on('action', onActionHandler);
client.on('connected', onConnectedHandler);
client.on('cheer', onCheerHandler);
client.on('raided', onRaidedHandler);
client.on('sub', onSubHandler);
client.on('subgift', onSubGiftHandler);
client.on('resub', onResubHandler);
client.on('anongiftpaidupgrade', onAnonGiftPaidUpgradeHandler);
client.on('giftpaidupgrade', onGiftPaidUpgradeHandler);
client.on('primepaidupgrade', onPrimePaidUpgradeHandler);

// Connect to Twitch:
client.connect();

// Called every time a chat message comes in
function onChatHandler(target, context, msg, self) {
	// Don't listen to my own messages..
    if (self) return;
	if(twitchIgnore[target.substring(1)] && twitchIgnore[target.substring(1)].includes(context["user-id"]) || twitchIgnore["_global"].includes(context["user-id"])){
		// Ignore messages from bots
		return;
	}
	let username = context['username'];
	msg = prepEmotes(context,msg.trim());
	say("Twitch:"+target.substring(1),username,msg);
}

// Called every time an action message comes in (/me)
function onActionHandler(target, context, msg, self) {
    // Don't listen to my own messages..
    if (self) return;
	if(twitchIgnore[target.substring(1)] && twitchIgnore[target.substring(1)].includes(context["user-id"]) || twitchIgnore["_global"].includes(context["user-id"])){
		// Ignore messages from bots
		return;
	}
	let username = context['username'];
	msg = prepEmotes(context,msg.trim());
	sendTTS("Twitch:"+target.substring(1),`${username} is ${msg}.`);
}

// Called every time someone cheers on a channel
function onCheerHandler(channel, userstate, message) {
	const cheermotes = ["cheer","biblethump","cheerwhal1","corgo","uni","showlove","party","seemsgood","pride","kappa","frankerz","heyguys","dansgame","elegiggle","trihard","kreygasm","4head","swiftrage","notlikethis","failfish","vohiyo","pjsalt","mrdestructoid","bday","ripcheer","shamrock"];
    let username = userstate['username'];
	message = message.trim();
	for(let key in cheermotes){
		let regexp = new RegExp(`(?<=^| )(${cheermotes[key]}\\d+ |${cheermotes[key]}\\d+$)`,"gi");
		message = message.replace(regexp,"");
	}
	msg = `${username} cheered X ${userstate.bits}: ${message.trim()}`;
	sendTTS("Twitch:"+channel.substring(1),msg);
}

// Called every time the channel is raided
function onRaidedHandler(channel, username, viewers) {
    sendTTS("Twitch:"+channel.substring(1),`${username} raided with a party of ${viewers}`);
}

// Called every time a user contines their gift sub from Anon
function onAnonGiftPaidUpgradeHandler(channel, username, userstate) {
    sendTTS("Twitch:"+channel.substring(1),`${username} is continuing the gift sub they got from an anonymous user`);
}

// Called every time a user continues their gift sub
function onGiftPaidUpgradeHandler(channel, username, sender, userstate) {
    sendTTS("Twitch:"+channel.substring(1),`${username} is continuing the gift sub they got from ${sender}`);
}

function onPrimePaidUpgradeHandler(channel, username, methods, tags) {
	switch(methods['plan']){
		case "1000":
			sendTTS("Twitch:"+channel.substring(1),`${username} converted their prime sub to a tier 1 sub.`);
			break;
		case "2000":
			sendTTS("Twitch:"+channel.substring(1),`${username} converted their prime sub to a tier 2 sub.`);
			break;
		case "3000":
			sendTTS("Twitch:"+channel.substring(1),`${username} converted their prime sub to a tier 3 sub.`);
			break;
		default:
			// We don't know what plan this is
			logger.log(plan);
			sendTTS("Twitch:"+channel.substring(1),`${username} converted their prime sub to a paid sub.`);
	}
}

// Called every time a user subscribes
function onSubHandler(channel, username, method, message, userstate) {
    let plan = method['plan'];
	months = ~~userstate["msg-param-cumulative-months"];
	let monthMessage = "";
	if(months > 1){
		monthMessage = `. They have been subscribed for ${months} months`;
	}
	if(!message){
		message = "";
	}
	switch(plan){
		case "Prime":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed with prime${monthMessage}:${message.trim()}`);
			break;
		case "1000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed at tier 1${monthMessage}:${message.trim()}`);
			break;
		case "2000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed at tier 2${monthMessage}:${message.trim()}`);
			break;
		case "3000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed at tier 3${monthMessage}:${message.trim()}`);
			break;
		default:
			// We don't know what plan this is
			logger.log(plan);
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed${monthMessage}:${message.trim()}`);
	}
}

// Called every time a user resubscribes
function onResubHandler(channel, username, months, message, userstate, method) {
    let plan = method['plan'];
	months = ~~userstate["msg-param-cumulative-months"];
	let monthMessage = "";
	if(months > 1){
		monthMessage = `. They have been subscribed for ${months} months`;
	}
	if(!message){
		message = "";
	}
	switch(plan){
		case "Prime":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed with prime${monthMessage}:${message.trim()}`);
			break;
		case "1000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed at tier 1${monthMessage}:${message.trim()}`);
			break;
		case "2000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed at tier 2${monthMessage}:${message.trim()}`);
			break;
		case "3000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed at tier 3${monthMessage}:${message.trim()}`);
			break;
		default:
			// We don't know what plan this is
			logger.log(plan);
			sendTTS("Twitch:"+channel.substring(1),`${username} just subscribed${monthMessage}:${message.trim()}`);
	}
}

function onSubGiftHandler(channel, username, streakMonths, recipient, methods, userstate) {
	let plan = methods['plan'];
	let months = ~~userstate["msg-param-gift-months"] || 1;
	switch(plan){
		case "Prime":
			// Don't believe this is possible but handle it just in case anyway
			sendTTS("Twitch:"+channel.substring(1),`${username} just gifted a ${months} month prime subscription to ${recipient}.`);
			break;
		case "1000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just gifted a ${months} month tier 1 subscription to ${recipient}.`);
			break;
		case "2000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just gifted a ${months} month tier 2 subscription to ${recipient}.`);
			break;
		case "3000":
			sendTTS("Twitch:"+channel.substring(1),`${username} just gifted a ${months} month tier 3 subscription to ${recipient}.`);
			break;
		default:
			// We don't know what plan this is
			logger.log(plan);
			sendTTS("Twitch:"+channel.substring(1),`${username} just gifted a ${months} month subscription to ${recipient}.`);
	}
}

function onConnectedHandler(addr, port) {
  logger.log(`* Connected to ${addr}:${port}`);
}

function say(channel,user,msg) {
	msg = msg.trim();
	if(!/[?.!]$/.test(msg)) {
		if(msg.endsWith(">") && !/<.*>$/g.test(msg)) {
			// Likely a typo
			msg = `${msg.slice(0,-1)}?`;
		}
		else {
			// Missing punctuation
			msg = `${msg}.`;
		}
	}
	if(msg.endsWith("?") && msg.toUpperCase() === msg && msg.toLowerCase() !== msg) {
		// All Caps Question
		sendTTS(channel, `${user} asks loudly: ${msg.toLowerCase()}`);
	}
	else if(msg.endsWith("?")) {
		// Question
		sendTTS(channel, `${user} asks: ${msg}`);
	}
	else if(msg.endsWith("!") && msg.toUpperCase() === msg && msg.toLowerCase() !== msg) {
		// All Caps Question
		sendTTS(channel, `${user} exclaims loudly: ${msg.toLowerCase()}`);
	}
	else if(msg.endsWith("!")) {
		// Exclamation
		sendTTS(channel, `${user} exclaims: ${msg}`);
	}
	else if(msg.toUpperCase() === msg && msg.toLowerCase() !== msg) {
		// All Caps
		sendTTS(channel, `${user} shouts: ${msg}`);
	}
	else {
		// Normal
		sendTTS(channel,`${user} says: ${msg}`);
	}
}

function queueResource(channel, resource) {
	streamQueues[channel].push(resource);
	if(players[channel].state.status == AudioPlayerStatus.Idle && streamQueues[channel].length == 1){
		playResource(channel);
	}
}

async function playResource(channel) {
	const resource = await streamQueues[channel].pop();
	players[channel].play(resource);
};

function sendTTS(channel,msg) {
	if(!channel){
		return;
	}
	if(!channel.startsWith("VC:")){
		channel = channelMaps[channel];
	}
	if(!channel){
		return;
	}
	if(players[channel]){
		const message = cleanMessage(prepForTTS(msg));
		const channelName = channelNames[channel];
		logger.log(`${channelName}: TTS Request: ${message}`);
		const stream = gtts.stream(message);
		const resource = createAudioResource(stream);
		queueResource(channel,resource);
	}
}

function playFile(channel,file) {
	if(!channel){
		return false;
	}
	if(!channel.startsWith("VC:")){
		channel = channelMaps[channel];
	}
	if(!channel){
		return false;
	}
	if(players[channel]){
		let channelName = channelNames[channel];
		logger.log(`${channelName}: File Request: ${file}`);
		if(!fs.existsSync(file)){
			logger.error(`${channelName}: Can not play file ${file} as it does not exist`);
			return false;
		}
		let resource = createAudioResource(fs.createReadStream(file));
		if(players[channel].state.status == AudioPlayerStatus.Idle && streamQueues[channel].length == 0){
			players[channel].play(resource);
			console.log(resource);
			logger.log(`${channelName}: Playing File: ${file}`);
		}
		else{
			streamQueues[channel].push(resource);
			logger.log(`${channelName}: Queued File: ${file}`);
		}
		return true;
	}
}

function prepForTTS(msg) {
	msg = msg.replaceAll(/[a-z]+:\/\/[a-zA-Z0-9@:%._+~#?&//=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%._+~#?&//=]*)/gi,""); // Remove Links
	msg = msg.replaceAll(/(?:^| )(?:\^ ?)+(?: |$)/gi,"^ ");
	for(let str in ttsStrings){
		msg = msg.replaceAll(new RegExp(`(?<=^|[^\\w\\d])${str}(?=$|[^\\w\\d])`,"gi"),ttsStrings[str]);
	}
	for(let str in nameMappings){
		msg = msg.replaceAll(new RegExp(`${str}`,"gi")," "+nameMappings[str]+" ");
	}
	msg = msg.replaceAll(/(?<=^|[^\w\d])ericw9079(?=$|[^\w\d])/gi,"Eric"); // Replace with Eric
	msg = msg.replaceAll(/\n/g,". "); // Replace newlines with periods
	return msg.trim();
}

function cleanMessage(msg) {
	for(let str in censoredWords){
		msg = msg.replaceAll(new RegExp(`${str}`,"gi"),censoredWords[str]);
	}
	return msg.trim();
}

function prepEmotes(userstate,message) {
	let msg = message;
	let emoteTotal = 0;
	let emoteMsg = "";
	for(let emoteId in userstate['emotes']){
		emoteTotal += userstate['emotes'][emoteId].length;
	}
	if(emoteTotal > 5){
		for(let emoteId in userstate['emotes']){
			let indexes = userstate['emotes'][emoteId][0].split("-");
			let emote = message.substring(indexes[0],parseInt(indexes[1])+1);
			msg = msg.replace(new RegExp(`(?<=^|[^\\w\\d])${emote}(?=$|[^\\w\\d])`,"gi"),"");
			if(emoteMsg){
				emoteMsg += ",";
			}
			emoteMsg += ` ${emote} X ${userstate['emotes'][emoteId].length}`;
		}
	}
	return msg.trim()+emoteMsg;
}

function removeFormatting(msg) {
	let message = msg;
	const formatStrings = [/\*(.*?)\*/gs,/`{3}\w*\n(.*?)`{3}/gs,/`{3}(.*?)`{3}/gs,/`(.*?)`/gs,/_(.*?)_/gs,/^>>> (.*?)/gm,/^> (.*?)/gm];
	for(key in formatStrings){
		let formatString = formatStrings[key];
		message = message.replace(formatString,"$1");
	}
	return message;
}

function joinVoice(voiceChannel) {
	return new Promise((resolve, reject) => {
		if(voiceChannel){
			if(voiceChannel.joinable){
				var connection = joinVoiceChannel({
					channelId: voiceChannel.id,
					guildId: voiceChannel.guild.id,
					adapterCreator: voiceChannel.guild.voiceAdapterCreator,
				});
				connection.on('error',logger.error);
				streamQueues["VC:"+voiceChannel.id] = [];
				let player = createAudioPlayer();
				player.on(AudioPlayerStatus.Idle, () => {
					if(streamQueues["VC:"+voiceChannel.guild.me.voice.channelId].length > 0){
						playResource("VC:"+voiceChannel.guild.me.voice.channelId);
					}
				});
				players["VC:"+voiceChannel.id] = player;
				connection.subscribe(player);
				channelNames['VC:'+voiceChannel.id] = `${voiceChannel.guild.name}->${voiceChannel.name}`;
				resolve("VC:"+voiceChannel.id);
			}
			else{
				reject("Can't join given channel");
			}
		}
		else{
			reject("No channel given");
		}
	});
}

function leaveVoice(voiceId,guildId) {
	if(getVoiceConnection(guildId)){
		
		getVoiceConnection(guildId).destroy();
		players["VC:"+voiceId].stop();
		for (let key in channelMaps) {
			if (channelMaps[key] == "VC:"+voiceId){
				if(key.startsWith("Twitch:")){
					client.part(key.substring(7));
				}
				delete channelMaps[key];
			}
		}
		delete streamQueues["VC:"+voiceId];
		delete players["VC:"+voiceId];
	}
}

const loadCensoredWords = () => {
	let rawdata = fs.readFileSync('./censoredWords.json');
	try{
		let dataObj = JSON.parse(rawdata);
		if(JSON.stringify(censoredWords) != "{}" && JSON.stringify(censoredWords) != JSON.stringify(dataObj)){
			logger.log("Censored Words Updated");
		}
		else if(JSON.stringify(censoredWords) == "{}"){
			logger.log("Censored Words Loaded");
		}
		censoredWords = dataObj;
	}
	catch(e){
		if(JSON.stringify(censoredWords) != "{}"){
			logger.log("Error Updating Censored Words");
		}
		else{
			logger.log("Error Loading Censored Words");
		}
		console.log(e);
	}
};
loadCensoredWords();
setInterval(loadCensoredWords,60000);

const loadNameMappings = () => {
	let rawdata = fs.readFileSync('./nameMappings.json');
	try{
		let dataObj = JSON.parse(rawdata);
		if(JSON.stringify(nameMappings) != "{}" && JSON.stringify(nameMappings) != JSON.stringify(dataObj)){
			logger.log("Name Mappings Updated");
		}
		else if(JSON.stringify(nameMappings) == "{}"){
			logger.log("Name Mappings Loaded");
		}
		nameMappings = dataObj;
	}
	catch(e){
		if(JSON.stringify(nameMappings) != "{}"){
			logger.log("Error Updating Name Mappings");
		}
		else{
			logger.log("Error Loading Name Mappings");
		}
		console.log(e);
	}
};
loadNameMappings();
setInterval(loadNameMappings,60000);

const loadIgnoreList = () => {
	let rawdata = fs.readFileSync('./ignoreList.json');
	try{
		let dataObj = JSON.parse(rawdata);
		if(JSON.stringify(twitchIgnore) != "{}" && JSON.stringify(twitchIgnore) != JSON.stringify(dataObj)){
			logger.log("Twitch Ignore list Updated");
		}
		else if(JSON.stringify(twitchIgnore) == "{}"){
			logger.log("Twitch Ignore list Loaded");
		}
		twitchIgnore = dataObj;
	}
	catch(e){
		if(JSON.stringify(twitchIgnore) != "{}"){
			logger.log("Error Updating Twitch Ignore list");
		}
		else{
			logger.log("Error Loading Twitch Ignore list");
		}
		console.log(e);
	}
};
loadIgnoreList();
setInterval(loadIgnoreList,60000);

const loadTTSStrings = () => {
	let rawdata = fs.readFileSync('./ttsStrings.json');
	try{
		let dataObj = JSON.parse(rawdata);
		if(JSON.stringify(ttsStrings) != "{}" && JSON.stringify(ttsStrings) != JSON.stringify(dataObj)){
			logger.log("TTS Strings Updated");
		}
		else if(JSON.stringify(ttsStrings) == "{}"){
			logger.log("TTS Strings Loaded");
		}
		ttsStrings = dataObj;
	}
	catch(e){
		if(JSON.stringify(ttsStrings) != "{}"){
			logger.log("Error Updating TTS Strings");
		}
		else{
			logger.log("Error Loading TTS Strings");
		}
		console.log(e);
	}
};
loadTTSStrings();
setInterval(loadTTSStrings,60000);

setInterval(() => {}, 1 << 30); // Bogus Interval to keep the process alive

const parseDiscordCommand = (msg) => {
  var cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

  if(msg.author.bot === true) {
    return;
  }

  if (!msg.channel.type.startsWith("GUILD")){
    // We should always have send message perms in a dm.
    msg.reply({ content: ":x: This command must be used in a server.", allowedMentions: { repliedUser: true }});
    return;
  }

  if(msg.channel.type !== "GUILD_TEXT"){
    msg.reply({ content: ":x: This command must be used in a text channel.", allowedMentions: { repliedUser: true }});
    return;
  }

  if(cmd.startsWith("JOIN") && !cmd.startsWith("JOINTWITCH")) {
	  if(getVoiceConnection(msg.guild.id) && msg.member.voice.channelId == getVoiceConnection(msg.guild.id).joinConfig.channelId){
		channelMaps["Channel:"+msg.channel.id] = "VC:"+getVoiceConnection(msg.guild.id).joinConfig.channelId;
		sendTTS("VC:"+getVoiceConnection(msg.guild.id).joinConfig.channelId,"TTS activated for "+msg.channel.name);
	}
	else{
		if(getVoiceConnection(msg.guild.id)){
			msg.reply({ content: "This bot is currently being used by another VC", allowedMentions: { repliedUser: true }});
		}
		else{
			if(msg.member.voice.channel){
				if(msg.member.voice.channel.joinable){
					joinVoice(msg.member.voice.channel).then((streamId) =>{
						channelMaps["Channel:"+msg.channel.id] = streamId;
						sendTTS(streamId,"TTS activated for "+msg.channel.name);
					}).catch((reason) =>{
						logger.log(reason);
						msg.reply({ content: `:x: Failed to join voice: ${reason}`, allowedMentions: { repliedUser: true }});
					});
				}
				else{
					msg.reply({ content: ":x: It appears I am not able to join the voice channel you are in :sob:", allowedMentions: { repliedUser: true }});
				}
			}
			else{
				msg.reply({ content: ":x: You must be in a voice channel to use this command", allowedMentions: { repliedUser: true }});
			}
		}
	}
  }
  else if(cmd.startsWith("TWITCH") && !cmd.startsWith("TWITCHLEAVE")){
	let str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "TWITCH ", "");
    let args = str.split(" ");
	if(args[0] && args[0].startsWith(prefix.toUpperCase() + "TWITCH")){
		args[0] = args[1];
	}
    if(!args[0]){
      msg.reply({ content: ":x: Please specify the twitch channel.", allowedMentions: { repliedUser: true }});
      return;
    }
	if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.reply({ content: ":x: The channel entered is invalid", allowedMentions: { repliedUser: true }});
        return;
    }
	if(getVoiceConnection(msg.guild.id) && msg.member.voice.channelId == getVoiceConnection(msg.guild.id).joinConfig.channelId){
		channelMaps["Twitch:"+args[0].toLowerCase()] = "VC:"+getVoiceConnection(msg.guild.id).joinConfig.channelId;
		client.join(args[0].toLowerCase());
		logger.log(`Joined twitch room for ${args[0].toLowerCase()}`);
		sendTTS("VC:"+getVoiceConnection(msg.guild.id).joinConfig.channelId,"TTS active in twitch chat for "+args[0].toLowerCase());
	}
	else{
		if(getVoiceConnection(msg.guild.id)){
			msg.reply({ content: "This bot is currently being used by another VC", allowedMentions: { repliedUser: true }});
		}
		else{
			if(msg.member.voice.channel){
				if(msg.member.voice.channel.joinable){
					joinVoice(msg.member.voice.channel).then((streamId) =>{
						channelMaps["Twitch:"+args[0].toLowerCase()] = streamId;
						client.join(args[0].toLowerCase());
						sendTTS(streamId,"TTS active in twitch chat for "+args[0].toLowerCase());
					}).catch((reason) =>{
						msg.reply({ content: `:x: Failed to join voice: ${reason}`, allowedMentions: { repliedUser: true }});
					});
				}
				else{
					msg.reply({ content: ":x: It appears I am not able to join the voice channel you are in :sob:", allowedMentions: { repliedUser: true }});
				}
			}
			else{
				msg.reply({ content: ":x: You must be in a voice channel to use this command", allowedMentions: { repliedUser: true }});
			}
		}
	}
  }
  else if(cmd.startsWith("LEAVETWITCH") || cmd.startsWith("TWITCHLEAVE")){
	let str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "LEAVETWITCH ", "").replace(prefix.toUpperCase() + "TWITCHLEAVE ", "");
    let args = str.split(" ");
    if(args[0] && (args[0].startsWith(prefix.toUpperCase() + "TWITCHLEAVE") || args[0].startsWith(prefix.toUpperCase() + "LEAVETWITCH"))){
		args[0] = args[1];
	}
    if(!args[0]){
      msg.reply({ content: ":x: Please specify the twitch channel.", allowedMentions: { repliedUser: true }});
      return;
    }
	if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.reply({ content: ":x: The channel entered is invalid", allowedMentions: { repliedUser: true }});
        return;
    }
	if(getVoiceConnection(msg.guild.id) && msg.member.voice.channelId == getVoiceConnection(msg.guild.id).joinConfig.channelId){
		let streamId = channelMaps["Twitch:"+args[0].toLowerCase()];
		if(!streamId){
			msg.reply({ content: ":x: The bot isn't currently connected to that twitch channel", allowedMentions: { repliedUser: true }});
			return;
		}
		delete channelMaps["Twitch:"+args[0].toLowerCase()];
		client.part(args[0].toLowerCase());
		logger.log(`Left twitch room for ${args[0].toLowerCase()}`);
		sendTTS(streamId,"TTS no longer active in twitch chat for "+args[0].toLowerCase());
	}
	else{
		msg.reply({ content: ":x: You must be in VC with the bot to use this command", allowedMentions: { repliedUser: true }});
	}
  }
  else if(cmd.startsWith("LEAVE")){
	  if(getVoiceConnection(msg.guild.id) && msg.member.voice.channelId == getVoiceConnection(msg.guild.id).joinConfig.channelId){
		leaveVoice(msg.member.voice.channel.id,msg.guild.id);
	  }
	  else{
		  msg.reply({ content: ":x: You must be in VC with the bot to use this command", allowedMentions: { repliedUser: true }});
	  }
  }
  else if(cmd.startsWith("HELP")){
	msg.reply({ embeds: [new MessageEmbed()
		.setTitle('Commands for Discord TTS')
		.addFields(
		  {name:`${prefix}join`,value:"Join a voice channel and bind tts to current text channel",inline:true},
		  {name:`${prefix}twitch <twitch channel>`,value:"Connect TTS to the provided twitch chat, joining a voice channel if needed",inline:true},
		  {name:`${prefix}leavetwitch <twitch channel>`,value:"Disconnect TTS from the provided twitch chat. Does nothing if not in the twitch chat. Does not disconnect from voice channels",inline:true},
		  {name:`${prefix}leave`,value:"Disconnect from a voice channel",inline:true},
		  {name:`${prefix}help [command]`,value:"Shows this help message",inline:true}
		)
		.setFooter("Don't add the <> to the command")], allowedMentions: { repliedUser: true }}
	);
  }
};

discordClient.on('voiceStateUpdate', (oldMember, newMember) => {
	if(oldMember.id != oldMember.guild.me.id){
		// We only care if we change voice states
		return;
	}
	let newUserChannel = newMember.channel;
	let oldUserChannel = oldMember.channel;

	if(oldUserChannel === newUserChannel){
		// State change within the same VC
		return;
	}

	if (oldUserChannel === null) {
		// Joining VC
		// Don't care
		logger.log("Connected to:"+newUserChannel.name+" in "+newMember.guild.name);
	} else if (newUserChannel === null) {
		// Leaving VC
		// Reset the bot for reuse if it gets disconnected
		leaveVoice(oldMember.channelId,oldMember.guild.id);
		logger.log("Disconnected from:"+oldUserChannel.name+" in "+oldMember.guild.name);
		delete channelNames['VC:'+oldUserChannel.id];
	} else if (oldUserChannel !== null && newUserChannel !== null) {
		// Moving VC
		logger.log("Moved from "+oldUserChannel.name+" to "+newUserChannel.name);
		players["VC:"+newMember.channelId] = players["VC:"+oldMember.channelId]; // Migrate the stream obj so we can leave properly
		streamQueues["VC:"+newMember.channelId] = streamQueues["VC:"+oldMember.channelId];
		// Migrate any channels mapped to the old vc to the new vc
		for (let key in channelMaps) {
			if (channelMaps[key] == "VC:"+oldMember.channelId){
				channelMaps[key] = "VC:"+newMember.channelId;
			}
		}
		delete streamQueues["VC:"+oldMember.channelId]; // Clear out the old vc stream reference
		delete players["VC:"+oldMember.channelId];
	}
});

discordClient.on("ready", () => {
	if(firstLogin !== 1) {
	  firstLogin = 1;
	  logger.log("Discord client connected successfully.");
	  discordClient.user.setActivity(`tts to discord - ${prefix}help`,{ type: 'STREAMING' });
	}
	else{
		logger.log("Discord client reconnected.");
	}

});

discordClient.once("ready", async () => {
	const channel = discordClient.channels.cache.get(logChannel);
	try {
		const webhooks = await channel.fetchWebhooks();
		let webhook = webhooks.find(wh => wh.token);
		if(!webhook) {
			webhook = await channel.createWebhook("TTS Logging", {reason: "TTS logging"});
		}
		logger.init(webhook);
	}
	catch (error) {
		logger.error("Error trying to configure discord logger");
		console.log(error);
	}
});

discordClient.on('shardResume', (id,replayedEvents) => {
	discordClient.user.setActivity(`tts to discord - ${prefix}help`,{ type: 'STREAMING' });
});

discordClient.on("disconnect", (event) => {
	if(event.code !== 1000) {
	  logger.log("Discord client disconnected with reason: " + event.reason + " (" + event.code + ").");
	  
	  if(event.code === 4004) {
		  logger.log("Please double-check the configured token and try again.");
		  process.exit();
		  return;
	  }

	  logger.log("Attempting to reconnect in 6s...");
	  setTimeout(() => { discordClient.login(config.DISCORD_TOKEN); }, 6000);
	}
});

discordClient.on("error", (err) => {
	logger.log(`Discord client error '${err.code}' (${err.message}). Attempting to reconnect in 6s...`);
	discordClient.destroy();
	setTimeout(() => { discordClient.login(config.DISCORD_TOKEN); }, 6000);
});

discordClient.on("messageCreate", (msg) => {
	if(msg.author === discordClient.user){
		// Ignore our own messages
		return;
	}
	if(msg.content.toUpperCase().startsWith(prefix.toUpperCase())) {
		parseDiscordCommand(msg);
	}
	else if(msg.channel.type === "GUILD_TEXT" && channelMaps["Channel:"+msg.channel.id]){
		let name = msg.member.displayName;
		if(msg.author.id == config.OWNER_DISCORD){
			name = "Eric";
		}
		match = name.match(/^[\w \d_]+/);
		if(match){
			name = match[0];
		}
		let message = msg.cleanContent;
		if(msg.mentions.members && msg.mentions.members.has(config.OWNER_DISCORD)){
			let botOwner = msg.mentions.members.get(config.OWNER_DISCORD);
			if(botOwner){
				message = message.replace(botOwner.displayName,"Eric");
			}
		}
		message = message.replace(/<a?:(.*?):\d+>/g,"$1"); // Clean up emotes
		let linklessMsg = message.replace(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/gi,""); // Remove Links
		if(message.trim() && linklessMsg.trim()){
			if(message.trim() == "🤔" && playFile("Channel:"+msg.channel.id,"./villager/Villager_idle2.ogg")){
				return;
			}
			if(message.trim() == "👍" && playFile("Channel:"+msg.channel.id,"./villager/Villager_accept2.ogg")){
				return;
			}
			if(message.trim() == "👎" && playFile("Channel:"+msg.channel.id,"./villager/Villager_deny1.ogg")){
				return;
			}
			if(message.trim() == "💀" && playFile("Channel:"+msg.channel.id,"./villager/Villager_death.ogg")){
				return;
			}
			if(message.trim() == "☠️" && playFile("Channel:"+msg.channel.id,"./villager/Villager_death.ogg")){
				return;
			}
			if(message.trim() == "❓" && playFile("Channel:"+msg.channel.id,"./villager/Villager_trade1.ogg")){
				// Red Question mark
				return;
			}
			if(message.trim() == "❔" && playFile("Channel:"+msg.channel.id,"./villager/Villager_trade1.ogg")){
				// Grey question mark
				return;
			}
			if(/^\?+$/.test(message.trim()) && playFile("Channel:"+msg.channel.id,"./villager/Villager_trade1.ogg")){
				return;
			}
			if(message.trim() == "🤐") {
				say("Channel:"+msg.channel.id,name,"My lips are sealed");
				return;
			}
			say("Channel:"+msg.channel.id,name,removeFormatting(message.trim()));
		}
		else{
			let files = 0;
			let images = 0;
			let videos = 0;
			let gifvs = 0;
			let articles = 0;
			let links = 0;
			let stickers = msg.stickers.size;
			for(let attachment of msg.attachments){
				if(attachment[1].contentType.startsWith("image/")){
					images++;
				}
				else{
					console.log(attachment[1]);
				}
			}
			for(let embed of msg.embeds){
				switch(embed.type){
					case "image":
						images++;
						break;
					case "video":
						videos++;
						break;
					case "gifv":
						gifvs++;
						break;
					case "article":
						articles++;
						break;
					case "link":
						links++;
						break;
				}
			}
			message = ""; // Ensure the message variable is empty (it should be)
			if(files > 0){
				if(files > 1){
					message = `${name} shared ${files} files`;
				}
				else{
					message = `${name} shared a file`;
				}
			}
			if(images > 0){
				if(message == ""){
					message = `${name} shared `;
				}
				else{
					message += " and ";
				}
				if(images > 1){
					message += `${images} images`;
				}
				else{
					message += "an image";
				}
			}
			if(videos > 0){
				if(message == ""){
					message = `${name} shared `;
				}
				else{
					message += " and ";
				}
				if(videos > 1){
					message += `${videos} videos`;
				}
				else{
					message += "a video";
				}
			}
			if(gifvs > 0){
				if(message == ""){
					message = `${name} shared `;
				}
				else{
					message += " and ";
				}
				if(gifvs > 1){
					message += `${gifvs} gifs`;
				}
				else{
					message += "a gif";
				}
			}
			if(articles > 0){
				if(message == ""){
					message = `${name} shared `;
				}
				else{
					message += " and ";
				}
				if(articles > 1){
					message += `${articles} articles`;
				}
				else{
					message += "an article";
				}
			}
			if(links > 0){
				if(message == ""){
					message = `${name} shared `;
				}
				else{
					message += " and ";
				}
				if(links > 1){
					message += `${links} links`;
				}
				else{
					message += "a link";
				}
			}
			if(stickers > 0){
				if(message == ""){
					message = `${name} shared `;
				}
				else{
					message += " and ";
				}
				if(stickers > 1){
					message += `${stickers} stickers`;
				}
				else{
					message += "a sticker";
				}
			}
			if(message){
				sendTTS("Channel:"+msg.channel.id,message);
			}
		}
	}
});

discordClient.on("guildCreate", (guild) => {
	discordClient.users.fetch(config.OWNER_DISCORD).then((user) => {
      user.createDM().then((channel) => {
		channel.send(`Joined ${guild.name}`);
      }).catch((e)=>{logger.error(e)});
    }).catch((e)=>{logger.error(e)});
	logger.log(`Joined ${guild.name}`);
});

discordClient.on("guildDelete", (guild) => {
	discordClient.users.fetch(config.OWNER_DISCORD).then((user) => {
      user.createDM().then((channel) => {
		channel.send(`Left ${guild.name}`);
      }).catch((e)=>{logger.error(e)});
    }).catch((e)=>{logger.error(e)});
	logger.log(`Left ${guild.name}`);
});

process.on("exit",  () => {
	discordClient.destroy();
});

discordClient.login(config.DISCORD_TOKEN);