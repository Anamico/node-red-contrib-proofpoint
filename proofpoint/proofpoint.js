'use strict';
const util = require('./util.js');

module.exports = function(RED) {

    function Proofpoint(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const principal = node.credentials.principal;
        const secret = node.credentials.secret;

        this.poll = function (params, callback) {

            if (!config.server) {
                callback(new Error('Missing Proofpoint Hostname/IP'));
                return;
            }
            if (!config.principal) {
                callback(new Error('Missing Principal'));
                return;
            }
            if (!config.secret) {
                callback(new Error('Missing Secret'));
                return;
            }

            util.pollProofpointSIEM(principal, secret, params, callback);
        }
    }

    RED.nodes.registerType("proofpoint service", Proofpoint, {
        credentials: {
            principal: { type:"text" },
            secret: { type:"password" }
        }
    });
};
