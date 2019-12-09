'use strict';
const util = require('./util.js');

module.exports = function(RED) {

    function Proofpoint(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const principal = node.credentials.principal;
        const secret = node.credentials.secret;

        this.poll = function (params, callback) {

            // if (!config.server) {
            //     callback(new Error('Missing Proofpoint Hostname/IP'));
            //     return;
            // }
            // server = "tap-api-v2.proofpoint.com"
            if (!principal) {
                callback(new Error('Missing Principal'));
                return;
            }
            if (!secret) {
                callback(new Error('Missing Secret'));
                return;
            }

            util.pollProofpointSIEM(/* server, */principal, secret, params, callback);
        }
    }

    RED.nodes.registerType("proofpoint service", Proofpoint, {
        credentials: {
            principal: { type:"text" },
            secret: { type:"password" }
        }
    });
};
