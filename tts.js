const escapeStringRegexp = require('escape-string-regexp').default;
const fs = require('fs');
const { PassThrough, Readable, pipeline } = require('stream');
const MultiStream = require('multistream');
const fakeUa = require('fake-useragent');
const logger = require('@ericw9079/logger');

const GOOGLE_TTS_URL = 'http://translate.google.com/translate_tts';
const MAX_CHARS = 100;
const LANGUAGES = {
  'en': 'English',
  'en-au': 'English (Australia)',
  'en-uk': 'English (United Kingdom)',
  'en-us': 'English (United States)',
  'cy': 'Welsh'
}

function Text2Speech(_lang, _debug) {
  let lang = _lang || 'en';
  const debug = _debug || false;
  lang = lang.toLowerCase();

  if (!LANGUAGES[lang])
    throw new Error('Language not supported: ' + lang);

  const getArgs = getArgsFactory(lang);

  return {
    tokenize: tokenize,
    stream: (text) => stream(getArgs, text)
  }
}

function stream(getArgs, text) {
  const text_parts = tokenize(text);
  const total = text_parts.length;

  return new MultiStream(text_parts.map(function(part, index) {
    const headers = getHeader();
    const args = getArgs(part, index, total);
    const fullUrl = GOOGLE_TTS_URL + args;
	
	const pass = new PassThrough();
    const ac = new AbortController();
    const signal = ac.signal;
	
	// Abort fetch if consumer closes/destroys the PassThrough
    pass.once('close', () => ac.abort());
    pass.once('error', () => ac.abort());
    pass.once('end', () => ac.abort());

    // Start fetch immediately and pipe into the PassThrough
    (async () => {
      try {
        const res = await fetch(fullUrl, { method: 'GET', headers, signal });
        if (!res.ok) {
          pass.destroy(new Error(`Fetch failed: ${res.status} ${res.statusText}`));
          return;
        }

        const body = res.body;
        if (!body) { // e.g., 204/HEAD
          pass.end();
          return;
        }

        if (typeof body.pipe === 'function') {
          // Node Readable
          pipeline(body, pass, err => { if (err) pass.destroy(err); });
          return;
        }

        if (typeof Readable.fromWeb === 'function' && typeof body.getReader === 'function') {
          // WHATWG ReadableStream -> Node Readable
          const nodeStream = Readable.fromWeb(body);
          pipeline(nodeStream, pass, err => { if (err) pass.destroy(err); });
          return;
        }
      } catch (err) {
		logger.error('tts error', err);
        pass.destroy(err);
      }
    })();

    return pass;
  }));
}

function getHeader() {
  const headers = {
    "User-Agent": fakeUa()
  };
  return headers;
}

function getArgsFactory(lang){
  return function (text, index, total) {
    const textlen = text.length;
    const encodedText = encodeURIComponent(text);
    const language = lang || 'en';
    return `?ie=UTF-8&tl=${language}&q=${encodedText}&total=${total}&idx=${index}&client=tw-ob&textlen=${textlen}`
  }
}

function tokenize(text) {
  const text_parts = [];
  if (!text)
    throw new Error('No text to speak');

  const punc = '¡!()[]¿?.,;:—«»\n ';
  const punc_list = punc.split('').map(function(char) {
    return escapeStringRegexp(char);
  });

  const pattern = punc_list.join('|');
  let parts = text.split(new RegExp(pattern));
  parts = parts.filter(p => p.length > 0);

  const output = [];
  let i = 0;
  for (let p of parts) {
    if (!output[i]) {
      output[i] = '';
    }
    if (output[i].length + p.length < MAX_CHARS) {
      output[i] += ' ' + p;
    } else {
      i++;
      output[i] = p;
    }
  }
  output[0] = output[0].substr(1);
  return output;
}

module.exports = Text2Speech;