/**
 * Lab Auth — xin access token Smart Class từ trang cha (lab chạy trong iframe).
 *
 * Lab -> cha:  { type: 'NB_AUTH_REQUEST', nonce }
 * Cha -> lab:  { type: 'NB_AUTH', nonce, token }
 *
 * Token chỉ lấy ngay trước mỗi lần ghi, không lưu lại. Không có cha / cha không trả lời
 * trong AUTH_TIMEOUT_MS -> null (server lab trả 401 với thông báo rõ ràng).
 */
(function () {
  'use strict';
  if (window.__nbGetAuthToken) return;

  var AUTH_TIMEOUT_MS = 3000;

  function createNonce() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  window.__nbGetAuthToken = function () {
    if (!window.parent || window.parent === window) {
      return Promise.resolve(null);
    }

    return new Promise(function (resolve) {
      var nonce = createNonce();
      var settled = false;
      var timer = null;

      function finish(token) {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        resolve(token);
      }

      function onMessage(event) {
        if (event.source !== window.parent) return;
        var data = event.data;
        if (!data || data.type !== 'NB_AUTH' || data.nonce !== nonce) return;
        finish(typeof data.token === 'string' && data.token ? data.token : null);
      }

      window.addEventListener('message', onMessage);
      timer = setTimeout(function () { finish(null); }, AUTH_TIMEOUT_MS);
      // Yêu cầu không chứa bí mật nên gửi '*'; cha tự kiểm tra origin + source trước khi trả token.
      window.parent.postMessage({ type: 'NB_AUTH_REQUEST', nonce: nonce }, '*');
    });
  };

  window.__nbAuthHeaders = function (headers) {
    return window.__nbGetAuthToken().then(function (token) {
      var result = Object.assign({}, headers || {});
      if (token) result.Authorization = 'Bearer ' + token;
      return result;
    });
  };
})();
