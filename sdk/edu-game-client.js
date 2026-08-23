/**
 * EDU Network — Game Client SDK
 * <script src="/sdk/edu-game-client.js"></script>
 * Absolute: https://ea29118c.edu-network.pages.dev/sdk/edu-game-client.js
 *
 * Origin di-detect dari window.__EDU_ORIGIN__ (middleware) atau location.origin.
 */
(function (global) {
  "use strict";

  function detectBase() {
    try {
      if (typeof window !== "undefined") {
        if (window.__EDU_ORIGIN__) return String(window.__EDU_ORIGIN__).replace(/\/$/, "");
        if (window.location && window.location.origin) return window.location.origin;
      }
    } catch (_) {}
    return "https://ea29118c.edu-network.pages.dev";
  }

  var DEFAULT_BASE = detectBase();

  function uid(prefix) {
    var a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return (prefix || "p") + "_" + Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function loadPlayerId(storageKey) {
    try {
      var k = storageKey || "edu_player_id";
      var id = localStorage.getItem(k);
      if (!id || !/^[a-zA-Z0-9_-]{3,64}$/.test(id)) {
        id = uid("player");
        localStorage.setItem(k, id);
      }
      return id;
    } catch (e) {
      return uid("player");
    }
  }

  function EduGameClient(opts) {
    opts = opts || {};
    this.baseUrl = (opts.baseUrl || detectBase()).replace(/\/$/, "");
    this.gameId = opts.gameId || (typeof window !== "undefined" && window.__EDU_GAME_ID__) || "default";
    this.playerId = opts.playerId || loadPlayerId(opts.storageKey);
    this.sessionId = null;
    this.config = null;
    this.player = null;
    this._listeners = {};
  }

  EduGameClient.prototype.on = function (event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
    return this;
  };

  EduGameClient.prototype._emit = function (event, data) {
    (this._listeners[event] || []).forEach(function (fn) { try { fn(data); } catch (_) {} });
  };

  EduGameClient.prototype._req = function (method, path, body) {
    var self = this;
    var init = {
      method: method,
      headers: { "Content-Type": "application/json", Accept: "application/json" }
    };
    if (body != null) init.body = JSON.stringify(body);
    return fetch(self.baseUrl + path, init).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "Invalid JSON response" };
      }).then(function (data) {
        if (!data.ok) {
          var err = new Error(data.error || "API error");
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  };

  EduGameClient.prototype.loadConfig = function () {
    var self = this;
    return this._req("GET", "/api/game/config?game_id=" + encodeURIComponent(this.gameId)).then(function (data) {
      self.config = data;
      self._emit("config", data);
      return data;
    });
  };

  EduGameClient.prototype.init = function (initialBalance) {
    var self = this;
    var body = { player_id: this.playerId, game_id: this.gameId };
    if (initialBalance != null) body.initial_balance = initialBalance;
    return this._req("POST", "/api/game/init", body).then(function (data) {
      self.player = data.player;
      self.config = data.config || self.config;
      self._emit("init", data);
      self._emit("balance", data.player);
      return data;
    });
  };

  EduGameClient.prototype.openSession = function () {
    var self = this;
    return this._req("POST", "/api/game/session", {
      player_id: this.playerId,
      game_id: this.gameId
    }).then(function (data) {
      self.sessionId = data.session && data.session.session_id;
      self._emit("session", data.session);
      return data.session;
    });
  };

  EduGameClient.prototype.balance = function () {
    var self = this;
    return this._req("GET", "/api/game/balance?player_id=" + encodeURIComponent(this.playerId)).then(function (data) {
      self.player = {
        player_id: data.player_id,
        balance: data.balance,
        currency: data.currency,
        spins_count: data.spins_count,
        total_bet: data.total_bet,
        total_win: data.total_win
      };
      self._emit("balance", self.player);
      return self.player;
    });
  };

  EduGameClient.prototype.bet = function (amount) {
    var self = this;
    return this._req("POST", "/api/game/bet", {
      player_id: this.playerId,
      game_id: this.gameId,
      session_id: this.sessionId,
      amount: amount
    }).then(function (data) {
      self._emit("bet", data.bet);
      return data.bet;
    });
  };

  EduGameClient.prototype.spin = function (betAmount) {
    var self = this;
    return this._req("POST", "/api/game/spin", {
      player_id: this.playerId,
      game_id: this.gameId,
      session_id: this.sessionId,
      bet: betAmount
    }).then(function (data) {
      if (data.player) {
        self.player = data.player;
        self._emit("balance", data.player);
      }
      self._emit("spin", data);
      return data;
    });
  };

  EduGameClient.prototype.result = function (spinId) {
    var path = "/api/game/result?";
    if (spinId != null) path += "spin_id=" + encodeURIComponent(spinId);
    else path += "player_id=" + encodeURIComponent(this.playerId) + "&limit=1";
    return this._req("GET", path);
  };

  EduGameClient.prototype.history = function (limit) {
    return this._req(
      "GET",
      "/api/game/history?player_id=" + encodeURIComponent(this.playerId) +
        "&game_id=" + encodeURIComponent(this.gameId) +
        "&limit=" + (limit || 20)
    );
  };

  EduGameClient.prototype.collect = function () {
    var self = this;
    return this._req("POST", "/api/game/collect", {
      player_id: this.playerId,
      game_id: this.gameId,
      session_id: this.sessionId
    }).then(function (data) {
      if (data.player) {
        self.player = data.player;
        self._emit("balance", data.player);
      }
      self.sessionId = null;
      self._emit("collect", data);
      return data;
    });
  };

  EduGameClient.prototype.bonus = function (type, amount) {
    var self = this;
    var body = {
      player_id: this.playerId,
      game_id: this.gameId,
      session_id: this.sessionId,
      type: type || "daily"
    };
    if (amount != null) body.amount = amount;
    return this._req("POST", "/api/game/bonus", body).then(function (data) {
      if (data.player) {
        self.player = data.player;
        self._emit("balance", data.player);
      }
      self._emit("bonus", data);
      return data;
    });
  };

  EduGameClient.prototype.start = function (opts) {
    var self = this;
    opts = opts || {};
    return self.loadConfig()
      .then(function () { return self.init(opts.initialBalance); })
      .then(function () { return self.openSession(); })
      .then(function () {
        return {
          playerId: self.playerId,
          sessionId: self.sessionId,
          player: self.player,
          config: self.config
        };
      });
  };

  global.EduGameClient = EduGameClient;
  global.EDU_API_BASE = DEFAULT_BASE;
})(typeof window !== "undefined" ? window : globalThis);
