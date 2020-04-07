const io = require("socket.io-client")

let store
let socket

function connect() {
    if(process.env.VUE_APP_IS_WEBTEST === 'TRUE' || process.env.VUE_APP_USE_LIVE === 'FALSE') {
        socket = io.connect("ws://localhost:8000")
    } else {
        socket = io.connect("wss://maker-auctions.io:8000")
    }

    store.dispatch('wsSetSocket', socket)

}

exports.init = (st) => {
    store = st
    connect()
}