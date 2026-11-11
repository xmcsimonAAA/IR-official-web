'use strict';
const sanitize = require('sanitize-html');
const tags = ['p','br','ul','ol','li','strong','b','em','i','u','a','img','table','thead','tbody','tr','td','th','h2','h3','h4','h5','blockquote','sup','sub','hr','pre'];
function safeUrl(value, { mail = false } = {}) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f\\]/.test(value)) return '';
  if (/^\/files\/[^?#]+(?:[?#].*)?$/.test(value)) {
    try { const u = new URL(value, 'https://local.invalid'); const p = decodeURIComponent(u.pathname); return p.startsWith('/files/') && !p.split('/').includes('..') ? value : ''; } catch { return ''; }
  }
  try { const u = new URL(value); return (['http:','https:'].includes(u.protocol) && !u.username && !u.password) || (mail && u.protocol === 'mailto:') ? value : ''; } catch { return ''; }
}
function cleanBody(html, transform) {
  return sanitize(String(html || ''), {
    allowedTags: tags,
    allowedAttributes: { a: ['href','target','rel'], img: ['src','alt'], td: ['colspan','rowspan'], th: ['colspan','rowspan'] },
    allowedSchemes: ['http','https','mailto'], allowProtocolRelative: false,
    transformTags: { '*': (tagName, input) => {
      const attribs = { ...input };
      for (const key of ['href','src']) if (key in attribs) {
        if (transform) attribs[key] = transform(attribs[key]);
        attribs[key] = safeUrl(attribs[key], { mail: key === 'href' });
      }
      if (tagName === 'a') { attribs.target = '_blank'; attribs.rel = 'noopener noreferrer nofollow'; }
      return { tagName, attribs };
    } },
  });
}
module.exports = { cleanBody, safeUrl };
