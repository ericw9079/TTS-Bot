# TTS-Bot
Powerful Text to speech for your discord voice chat. Powered by the Google translate text to speech.

## Features
* Give the users who can't speak a voice with the integrated support for discord text channels.
* Know what's going on in twitch chat with the integrated twitch chat feature.
* Supports ignoring specific twitch users. (useful for bots that repeat messages)
* Mappings for common abbreviations and emojis.
* Replaces common swear words with alternatives.
* Support for fixing the pronounciation of names.
* Simultanious support for multiple discord channels and twitch chats.

## Usage
Arguments wrapped in <> are required.

### Enable TTS for a discord channel
```
$$join
```
Bot will start to read aloud all messages sent in the channel the command was run in. If the bot is not in a voice chat it will join the chat.

### Connect to Twitch chat
```
$$twitch <twitch channel>
```
Bot will join your voice chat if needed and start reading aloud what's happening in the twitch chat of the channel provided.

### Disconnect from Twitch chat
```
$$leavetwitch <twitch channel>
```
Bot will stop reading what's happening in the given channels twitch chat but will not leave the voice chat.

### Disconnect the bot
```
$$leave
```
The bot will stop reading the twitch and discord chats and leave the voice chat. This is currently the only way to make the bot stop reading from discord.

# How to host
Please don't
if you'd like to use the bot please contact me.

# Credits
© 2024 ericw9079
