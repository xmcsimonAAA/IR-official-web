'use strict';
// Abort both headers and body reads; never log URLs containing provider keys.
module.exports = function fetchUpstream(url, options = {}) {
  return fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(12000) });
};
