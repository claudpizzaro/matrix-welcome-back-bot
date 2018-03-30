const LogService = require("./LogService");
const WelcomeStore = require("./WelcomeStore");
const moment = require("moment");

class WelcomeHandler {
    constructor() {
        // { roomId: { userId: lastActive } }
        this._recentUsers = WelcomeStore.loadLastActiveMap();
    }

    start(client) {
        this._client = client;

        client.on('event', event => {
            if (event.getStateKey() === this._client.credentials.userId) return;
            if (event.getSender() === this._client.credentials.userId) return;

            this._tryWelcome(event);
        });
    }

    _tryWelcome(event) {
        if (event.getType() !== "m.room.message") return;
        if (event.getContent().msgtype !== "m.text" && event.getContent().msgtype !== "m.emote") return;

        var userTree = this._recentUsers[event.getRoomId()];
        if (!userTree) {
            this._recentUsers[event.getRoomId()] = {};
            this._recentUsers[event.getRoomId()][event.getSender()] = moment().valueOf();
            WelcomeStore.storeLastActiveMap(this._recentUsers);
            return;
        }

        var lastActiveMs = userTree[event.getSender()];
        if (lastActiveMs && (moment().valueOf() - lastActiveMs) > (WelcomeStore.getWelcomeTimeout(event.getRoomId()) * 60000)) {
            LogService.info("WelcomeHandler", "Welcoming " + event.getSender() + " back in room " + event.getRoomId());
            this._client.getProfileInfo(event.getSender(), "displayname").then(result => {
                if (!result.displayname) result.displayname = event.getSender();
                const pilled = 'Welcome back, <a href="https://matrix.to/#/' + event.getSender() + '">' + result.displayname + "</a>";
                const plain = "Welcome back, " + result.displayname;
                this._client.sendMessage(event.getRoomId(), {
                    msgtype: "m.notice",
                    body: plain,
                    format: "org.matrix.custom.html",
                    formatted_body: pilled,
                });
            }).catch(err => {
                LogService.error("WelcomeHandler", err);
                this._client.sendNotice(event.getRoomId(), "Welcome back, " + event.getSender());
            });
        } else LogService.info("WelcomeHandler", "User " + event.getSender() + " was active recently in " + event.getRoomId());
        userTree[event.getSender()] = moment().valueOf();
        WelcomeStore.storeLastActiveMap(this._recentUsers);
    }
}

module.exports = new WelcomeHandler();