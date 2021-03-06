const BigNumber = require('bignumber.js')
const moment = require('moment')

const state = {
    flapAuctions: [],
    flapHistory: [],
    flapAuctionsInitialized: false,
}

const getters = {
    getFlapAuctions: (state) => (state.flapAuctions),
    getFlapHistory: (state) => (state.flapHistory),
    flapAuctionsInitialized: (state) => (state.flapAuctionsInitialized),
}

const actions = {
    setFlapAuctionsFromWS({ commit, rootState }, msg) {

        const parsedAuctions = []
        let parsedHistory = []

        if(msg.auctions) {
            Object.keys(msg.auctions).forEach(function(id) {
                parsedAuctions.push(makeAuctionFromRaw(rootState, id, msg.auctions[id]))
            })
        }

        if(msg.histories) {
            Object.keys(msg.histories).forEach(function(id) {
                parsedHistory.push(makeHistoryFromRaw(id, msg.histories[id]))
            })
        }

        // Check for invalid entries
        for(let i = 0; i < parsedAuctions.length; i++) {

            let prev
            // Do we have a previous valid entry?
            for(let c = 0; c < state.flapAuctions.length; c++) {
                if(state.flapAuctions[c].id === parsedAuctions[i].id) {
                    prev = state.flapAuctions[c]
                    break
                }
            }

            if(prev) {
                parsedAuctions[i] = prev
            }
        }

        const append = []
        for(let i = 0; i < state.flapHistory.length; i++) {
            let found = false
            for(let c = 0; c < parsedHistory.length; c++) {
                if(state.flapHistory[i].id === parsedHistory[c].id) {
                    found = true
                    break
                }
            }

            if(found) {
                continue
            }

            append.push(state.flapHistory[i])
        }

        parsedHistory = parsedHistory.concat(...append)
        parsedHistory.sort((lhs, rhs) => {return parseInt(rhs.id) - parseInt(lhs.id)})

        parsedAuctions.sort((lhs, rhs) => {return parseInt(rhs.id) - parseInt(lhs.id)})

        commit('setFlapAuctionsInitialized', true)
        commit('setFlapAuctions', parsedAuctions)
        commit('setFlapHistory', parsedHistory)
    },

    setFlapHistoryFromWS({ commit, state }, msg) {
        let parsed = []

        Object.keys(msg.histories).forEach(function(id) {
            parsed.push(makeHistoryFromRaw(id, msg.histories[id]))
        })

        const append = []
        for(let i = 0; i < state.flapHistory.length; i++) {
            let found = false
            for(let c = 0; c < parsed.length; c++) {
                if(state.flapHistory[i].id === parsed[c].id) {
                    found = true
                    break
                }
            }

            if(found) {
                continue
            }

            append.push(state.flapHistory[i])
        }

        parsed = parsed.concat(...append)
        parsed.sort((lhs, rhs) => {return parseInt(rhs.id) - parseInt(lhs.id)})

        commit('setFlapHistory', parsed)
    },

    requestMoreFlapHistory({state, dispatch}) {

        const len = state.flapHistory.length
        if(len === 0) {
            return
        }

        const lastID = state.flapHistory[len - 1].id
        const msg = {
            topic: 'flapHistory',
            content: {
                lastID: parseInt(lastID),
            },
        }

        dispatch('wsSendMsg', JSON.stringify(msg))
    }
}

const mutations = {
    setFlapAuctions: (state, auctions) => (state.flapAuctions = auctions),
    setFlapHistory: (state, history) => (state.flapHistory = history),
    setFlapAuctionsInitialized: (state, b) => (state.flapAuctionsInitialized = b),
}

function makeAuctionFromRaw(rootState, id, raw) {

    let amount = BigNumber(raw.lot).div(BigNumber(10).pow(45)).toFixed(2)
    let end
    if(parseInt(raw.end) < parseInt(raw.tic) || parseInt(raw.tic) === 0) {
        end = raw.end
    } else {
        end = raw.tic
    }

    return {
        id: id,
        phase: shortPhaseToLongPhase(raw.phase),
        amount: amount,
        bid: BigNumber(raw.bid).div(BigNumber(10).pow(rootState.contracts.mkr.decimals)).toFixed(4),
        bidder: raw.guy.substring(0, 6) + '...' + raw.guy.substring(raw.guy.length - 4),
        end: moment.unix(end).fromNow(),
        raw: {
            phase: raw.phase,
            lot: BigNumber(raw.lot),
            bid: BigNumber(raw.bid),
            usr: raw.usr,
            gal: raw.gal,
            guy: raw.guy,
            tic: raw.tic,
            end: raw.end,
            isValid: raw.isValid,
        },
    }
}

function makeHistoryFromRaw(id, raw) {
    const amount = BigNumber(raw.lot).div(BigNumber(10).pow(45)).toFixed(2)

    return {
        id: id,
        amount: amount,
        bid: BigNumber(raw.bid).div(BigNumber(10).pow(18)).toFixed(4),
        bidder: raw.guy.substring(0, 6) + '...' + raw.guy.substring(raw.guy.length - 4),
        end: moment.unix(parseInt(raw.end)).fromNow(),
        raw: {
            lot: BigNumber(raw.lot),
            bid: BigNumber(raw.bid),
            guy: raw.guy,
            end: raw.end,
        },
    }
}

function shortPhaseToLongPhase(phase) {
    switch(phase) {
        case 'RUN':
            return 'RUNNING'
        case 'RES':
            return 'RESTART'
        case 'FIN':
            return 'FINISHED'
        default:
            return 'INVALID'
    }
}

export default {
    state,
    getters,
    actions,
    mutations,
}